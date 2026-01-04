import {
  and,
  asc,
  count,
  desc,
  eq,
  inArray,
  like,
  ne,
  or,
  sql
} from "drizzle-orm";
import { db, schema } from "../db";
import { generateId } from "../utils";
import { fileService, type FileItem } from "./fileService";

const { virtualCollections, virtualCollectionItems } = schema;

type VirtualCollection = typeof virtualCollections.$inferSelect;

export interface CollectionSummary extends VirtualCollection {
  itemCount: number;
}

export interface VirtualCollectionFile extends FileItem {
  virtualItemId: string;
  virtualCollectionId: string;
  virtualLabel: string | null;
  virtualAddedAt: Date;
}

export interface CollectionItemsResult {
  items: VirtualCollectionFile[];
  total: number;
  page: number;
  limit: number;
}

export interface AddItemPayload {
  path: string;
  label?: string;
}

export class VirtualFolderService {
  async listCollections(userId: string): Promise<CollectionSummary[]> {
    const rows = await db
      .select({
        id: virtualCollections.id,
        userId: virtualCollections.userId,
        name: virtualCollections.name,
        sortOrder: virtualCollections.sortOrder,
        createdAt: virtualCollections.createdAt,
        updatedAt: virtualCollections.updatedAt,
        itemCount: sql<number>`count(${virtualCollectionItems.id})`
      })
      .from(virtualCollections)
      .leftJoin(
        virtualCollectionItems,
        eq(virtualCollectionItems.collectionId, virtualCollections.id)
      )
      .where(eq(virtualCollections.userId, userId))
      .groupBy(virtualCollections.id)
      .orderBy(
        asc(virtualCollections.sortOrder),
        asc(virtualCollections.createdAt)
      );

    return rows as CollectionSummary[];
  }

  async getCollectionById(
    id: string,
    userId: string
  ): Promise<typeof virtualCollections.$inferSelect | undefined> {
    const result = await db
      .select()
      .from(virtualCollections)
      .where(
        and(
          eq(virtualCollections.id, id),
          eq(virtualCollections.userId, userId)
        )
      )
      .limit(1);

    return result[0];
  }

  async createCollection(
    userId: string,
    name: string
  ): Promise<{
    success: boolean;
    collection?: typeof virtualCollections.$inferSelect;
    error?: string;
  }> {
    const trimmedName = name.trim();
    if (!trimmedName) {
      return { success: false, error: "Name is required" };
    }

    const existing = await db
      .select({ id: virtualCollections.id })
      .from(virtualCollections)
      .where(
        and(
          eq(virtualCollections.userId, userId),
          eq(virtualCollections.name, trimmedName)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      return {
        success: false,
        error: "A collection with this name already exists"
      };
    }

    const maxSortResult = await db
      .select({
        maxOrder: sql<number>`coalesce(max(${virtualCollections.sortOrder}), -1)`
      })
      .from(virtualCollections)
      .where(eq(virtualCollections.userId, userId));

    const sortOrder = (maxSortResult[0]?.maxOrder ?? -1) + 1;

    const id = generateId();
    const now = new Date();

    await db.insert(virtualCollections).values({
      id,
      userId,
      name: trimmedName,
      sortOrder,
      createdAt: now,
      updatedAt: now
    });

    const collection = await this.getCollectionById(id, userId);
    return { success: true, collection };
  }

  async renameCollection(
    id: string,
    userId: string,
    name: string
  ): Promise<{ success: boolean; error?: string }> {
    const collection = await this.getCollectionById(id, userId);
    if (!collection) {
      return { success: false, error: "Collection not found" };
    }

    const trimmedName = name.trim();
    if (!trimmedName) {
      return { success: false, error: "Name is required" };
    }

    // Ensure uniqueness
    const duplicate = await db
      .select({ id: virtualCollections.id })
      .from(virtualCollections)
      .where(
        and(
          eq(virtualCollections.userId, userId),
          eq(virtualCollections.name, trimmedName),
          ne(virtualCollections.id, id)
        )
      )
      .limit(1);

    if (duplicate.length > 0) {
      return {
        success: false,
        error: "Another collection already uses this name"
      };
    }

    await db
      .update(virtualCollections)
      .set({ name: trimmedName, updatedAt: new Date() })
      .where(
        and(
          eq(virtualCollections.id, id),
          eq(virtualCollections.userId, userId)
        )
      );

    return { success: true };
  }

  async reorderCollections(
    userId: string,
    orderedIds: string[]
  ): Promise<{ success: boolean; error?: string }> {
    const collections = await db
      .select({ id: virtualCollections.id })
      .from(virtualCollections)
      .where(eq(virtualCollections.userId, userId));

    const ownedIds = new Set(collections.map((c) => c.id));
    for (const id of orderedIds) {
      if (!ownedIds.has(id)) {
        return { success: false, error: "Invalid collection order" };
      }
    }

    await Promise.all(
      orderedIds.map((id, index) =>
        db
          .update(virtualCollections)
          .set({ sortOrder: index })
          .where(
            and(
              eq(virtualCollections.id, id),
              eq(virtualCollections.userId, userId)
            )
          )
      )
    );

    return { success: true };
  }

  async deleteCollection(
    id: string,
    userId: string
  ): Promise<{ success: boolean; error?: string }> {
    const collection = await this.getCollectionById(id, userId);
    if (!collection) {
      return { success: false, error: "Collection not found" };
    }

    await db.delete(virtualCollections).where(eq(virtualCollections.id, id));
    return { success: true };
  }

  async listItems(
    collectionId: string,
    userId: string,
    options: { page?: number; limit?: number; search?: string } = {}
  ): Promise<{
    success: boolean;
    data?: CollectionItemsResult;
    error?: string;
  }> {
    const collection = await this.getCollectionById(collectionId, userId);
    if (!collection) {
      return { success: false, error: "Collection not found" };
    }

    const { page = 1, limit = 200, search } = options;
    const offset = (page - 1) * limit;

    const filters = [eq(virtualCollectionItems.collectionId, collectionId)];
    if (search) {
      filters.push(like(virtualCollectionItems.path, `%${search}%`));
    }

    const whereClause = filters.length > 1 ? and(...filters) : filters[0];

    const [records, totalResult] = await Promise.all([
      db
        .select()
        .from(virtualCollectionItems)
        .where(whereClause)
        .orderBy(desc(virtualCollectionItems.addedAt))
        .limit(limit)
        .offset(offset),
      db
        .select({ total: count() })
        .from(virtualCollectionItems)
        .where(whereClause)
    ]);

    const hydrated = await Promise.all(
      records.map((record) => this.hydrateVirtualItem(record))
    );

    const missingIds: string[] = [];
    const items = hydrated.filter(
      (item, index): item is VirtualCollectionFile => {
        if (!item) {
          missingIds.push(records[index]?.id);
          return false;
        }
        return true;
      }
    );

    if (missingIds.length > 0) {
      await db
        .delete(virtualCollectionItems)
        .where(inArray(virtualCollectionItems.id, missingIds));
    }

    const total = Math.max((totalResult[0]?.total ?? 0) - missingIds.length, 0);

    return {
      success: true,
      data: {
        items,
        total,
        page,
        limit
      }
    };
  }

  async addItems(
    collectionId: string,
    userId: string,
    entries: AddItemPayload[]
  ): Promise<{
    success: boolean;
    added?: VirtualCollectionFile[];
    skipped?: string[];
    error?: string;
  }> {
    if (entries.length === 0) {
      return { success: false, error: "No entries provided" };
    }

    const collection = await this.getCollectionById(collectionId, userId);
    if (!collection) {
      return { success: false, error: "Collection not found" };
    }

    const existing = await db
      .select({ path: virtualCollectionItems.path })
      .from(virtualCollectionItems)
      .where(eq(virtualCollectionItems.collectionId, collectionId));

    const existingPaths = new Set(existing.map((item) => item.path));
    const skipped: string[] = [];
    const values: (typeof virtualCollectionItems.$inferInsert)[] = [];

    for (const entry of entries) {
      const targetPath = entry.path.trim();
      if (!targetPath) {
        skipped.push(entry.path);
        continue;
      }

      if (existingPaths.has(targetPath)) {
        skipped.push(targetPath);
        continue;
      }

      const validation = await fileService.validatePath(targetPath);
      if (!validation.valid) {
        return { success: false, error: validation.error };
      }

      const pathExists = await fileService.exists(targetPath);
      if (!pathExists) {
        return { success: false, error: "Path does not exist" };
      }

      existingPaths.add(targetPath);
      values.push({
        id: generateId(),
        collectionId,
        path: targetPath,
        label: entry.label?.trim() || null,
        addedAt: new Date()
      });
    }

    if (values.length === 0) {
      return { success: true, added: [], skipped };
    }

    await db.insert(virtualCollectionItems).values(values);

    const insertedIds = values.map((v) => v.id);
    const insertedRecords = await db
      .select()
      .from(virtualCollectionItems)
      .where(
        and(
          eq(virtualCollectionItems.collectionId, collectionId),
          inArray(virtualCollectionItems.id, insertedIds)
        )
      );

    const hydrated = await Promise.all(
      insertedRecords.map((record) => this.hydrateVirtualItem(record))
    );

    return {
      success: true,
      added: hydrated.filter((item): item is VirtualCollectionFile =>
        Boolean(item)
      ),
      skipped
    };
  }

  async removeItem(
    collectionId: string,
    userId: string,
    itemId: string
  ): Promise<{ success: boolean; error?: string }> {
    const collection = await this.getCollectionById(collectionId, userId);
    if (!collection) {
      return { success: false, error: "Collection not found" };
    }

    await db
      .delete(virtualCollectionItems)
      .where(
        and(
          eq(virtualCollectionItems.id, itemId),
          eq(virtualCollectionItems.collectionId, collectionId)
        )
      );

    return { success: true };
  }

  async removeItemByPath(
    collectionId: string,
    userId: string,
    path: string
  ): Promise<{ success: boolean; error?: string }> {
    const collection = await this.getCollectionById(collectionId, userId);
    if (!collection) {
      return { success: false, error: "Collection not found" };
    }

    await db
      .delete(virtualCollectionItems)
      .where(
        and(
          eq(virtualCollectionItems.collectionId, collectionId),
          eq(virtualCollectionItems.path, path)
        )
      );

    return { success: true };
  }

  private async hydrateVirtualItem(
    record: typeof virtualCollectionItems.$inferSelect
  ): Promise<VirtualCollectionFile | null> {
    const stats = await fileService.getStats(record.path);
    if (!stats) {
      return null;
    }

    return {
      ...stats,
      virtualItemId: record.id,
      virtualCollectionId: record.collectionId,
      virtualLabel: record.label ?? null,
      virtualAddedAt: record.addedAt
    };
  }

  async cleanupMissingItems(
    collectionId: string,
    userId: string
  ): Promise<{ success: boolean; removed: number; error?: string }> {
    const collection = await this.getCollectionById(collectionId, userId);
    if (!collection) {
      return { success: false, removed: 0, error: "Collection not found" };
    }

    const items = await db
      .select({
        id: virtualCollectionItems.id,
        path: virtualCollectionItems.path
      })
      .from(virtualCollectionItems)
      .where(eq(virtualCollectionItems.collectionId, collectionId));

    const missingIds: string[] = [];
    for (const item of items) {
      if (!(await fileService.exists(item.path))) {
        missingIds.push(item.id);
      }
    }

    if (missingIds.length > 0) {
      await db
        .delete(virtualCollectionItems)
        .where(inArray(virtualCollectionItems.id, missingIds));
    }

    return { success: true, removed: missingIds.length };
  }

  async handlePathChange(oldPath: string, newPath?: string): Promise<void> {
    const likePattern = `${oldPath}/%`;
    if (!newPath) {
      await db
        .delete(virtualCollectionItems)
        .where(
          or(
            eq(virtualCollectionItems.path, oldPath),
            like(virtualCollectionItems.path, likePattern)
          )
        );
      return;
    }

    await db
      .update(virtualCollectionItems)
      .set({
        path: sql<string>`replace(${virtualCollectionItems.path}, ${oldPath}, ${newPath})`
      })
      .where(
        or(
          eq(virtualCollectionItems.path, oldPath),
          like(virtualCollectionItems.path, likePattern)
        )
      );
  }
}

export const virtualFolderService = new VirtualFolderService();
