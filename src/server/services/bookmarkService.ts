// src/server/services/bookmarkService.ts
import { db, schema } from "../db";
import { eq, and, asc } from "drizzle-orm";
import { generateId } from "../utils";
import { fileService } from "./fileService";

const { bookmarks } = schema;

/**
 * Bookmark Service
 * Handles user bookmarks (quick access/pinned folders)
 */
export class BookmarkService {
  /**
   * Get all bookmarks for a user
   */
  async getUserBookmarks(userId: string): Promise<typeof bookmarks.$inferSelect[]> {
    return await db
      .select()
      .from(bookmarks)
      .where(eq(bookmarks.userId, userId))
      .orderBy(asc(bookmarks.sortOrder));
  }

  /**
   * Get a bookmark by ID
   */
  async getBookmarkById(
    id: string,
    userId: string
  ): Promise<typeof bookmarks.$inferSelect | undefined> {
    const result = await db
      .select()
      .from(bookmarks)
      .where(and(eq(bookmarks.id, id), eq(bookmarks.userId, userId)))
      .limit(1);

    return result[0];
  }

  /**
   * Check if a path is already bookmarked
   */
  async isBookmarked(path: string, userId: string): Promise<boolean> {
    const result = await db
      .select()
      .from(bookmarks)
      .where(and(eq(bookmarks.path, path), eq(bookmarks.userId, userId)))
      .limit(1);

    return result.length > 0;
  }

  /**
   * Add a new bookmark
   */
  async addBookmark(
    userId: string,
    path: string,
    name: string
  ): Promise<{ success: boolean; bookmark?: typeof bookmarks.$inferSelect; error?: string }> {
    // Validate path
    const validation = await fileService.validatePath(path);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    // Check if path exists
    const exists = await fileService.exists(path);
    if (!exists) {
      return { success: false, error: "Path does not exist" };
    }

    // Check if already bookmarked
    const alreadyBookmarked = await this.isBookmarked(path, userId);
    if (alreadyBookmarked) {
      return { success: false, error: "Path is already bookmarked" };
    }

    // Get the highest sort order
    const userBookmarks = await this.getUserBookmarks(userId);
    const maxOrder = userBookmarks.reduce(
      (max, b) => Math.max(max, b.sortOrder),
      -1
    );

    try {
      const id = generateId();
      await db.insert(bookmarks).values({
        id,
        userId,
        path,
        name: name.trim(),
        sortOrder: maxOrder + 1,
        createdAt: new Date(),
      });

      const bookmark = await this.getBookmarkById(id, userId);
      return { success: true, bookmark };
    } catch (error) {
      console.error("Error adding bookmark:", error);
      return { success: false, error: "Failed to add bookmark" };
    }
  }

  /**
   * Remove a bookmark
   */
  async removeBookmark(
    id: string,
    userId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const bookmark = await this.getBookmarkById(id, userId);
      if (!bookmark) {
        return { success: false, error: "Bookmark not found" };
      }

      await db
        .delete(bookmarks)
        .where(and(eq(bookmarks.id, id), eq(bookmarks.userId, userId)));

      return { success: true };
    } catch (error) {
      console.error("Error removing bookmark:", error);
      return { success: false, error: "Failed to remove bookmark" };
    }
  }

  /**
   * Update bookmark name
   */
  async updateBookmarkName(
    id: string,
    userId: string,
    name: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const bookmark = await this.getBookmarkById(id, userId);
      if (!bookmark) {
        return { success: false, error: "Bookmark not found" };
      }

      await db
        .update(bookmarks)
        .set({ name: name.trim() })
        .where(and(eq(bookmarks.id, id), eq(bookmarks.userId, userId)));

      return { success: true };
    } catch (error) {
      console.error("Error updating bookmark:", error);
      return { success: false, error: "Failed to update bookmark" };
    }
  }

  /**
   * Reorder bookmarks
   */
  async reorderBookmarks(
    userId: string,
    orderedIds: string[]
  ): Promise<{ success: boolean; error?: string }> {
    try {
      for (let i = 0; i < orderedIds.length; i++) {
        await db
          .update(bookmarks)
          .set({ sortOrder: i })
          .where(and(eq(bookmarks.id, orderedIds[i]), eq(bookmarks.userId, userId)));
      }

      return { success: true };
    } catch (error) {
      console.error("Error reordering bookmarks:", error);
      return { success: false, error: "Failed to reorder bookmarks" };
    }
  }

  /**
   * Delete all bookmarks for a user
   */
  async deleteUserBookmarks(userId: string): Promise<void> {
    await db.delete(bookmarks).where(eq(bookmarks.userId, userId));
  }
}

// Export singleton instance
export const bookmarkService = new BookmarkService();
