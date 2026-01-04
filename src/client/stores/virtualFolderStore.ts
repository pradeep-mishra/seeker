import { create } from "zustand";
import {
  type AddVirtualFolderEntry,
  type VirtualCollection,
  type VirtualCollectionItem,
  type VirtualCollectionItemsResponse,
  type VirtualCollectionSummary,
  virtualFoldersApi
} from "../lib/api";

interface CollectionItemsMeta {
  total: number;
  page: number;
  limit: number;
  lastFetchedAt: number;
}

interface VirtualFolderState {
  collections: VirtualCollectionSummary[];
  collectionsLoading: boolean;
  collectionsError: string | null;
  activeCollectionId: string | null;

  itemsByCollection: Record<string, VirtualCollectionItem[]>;
  itemsMeta: Record<string, CollectionItemsMeta>;
  itemsLoading: Record<string, boolean>;

  loadCollections: () => Promise<void>;
  createCollection: (name: string) => Promise<VirtualCollection>;
  renameCollection: (id: string, name: string) => Promise<boolean>;
  deleteCollection: (id: string) => Promise<boolean>;
  reorderCollections: (orderedIds: string[]) => Promise<boolean>;
  setActiveCollection: (id: string | null) => void;

  loadCollectionItems: (
    id: string,
    options?: { force?: boolean }
  ) => Promise<void>;
  addItemsToCollection: (
    id: string,
    entries: AddVirtualFolderEntry[]
  ) => Promise<VirtualCollectionItem[]>;
  removeItemFromCollection: (id: string, itemId: string) => Promise<void>;
  removeItemByPath: (id: string, path: string) => Promise<void>;
  cleanupCollection: (id: string) => Promise<number>;
  handlePathChange: (oldPath: string, newPath?: string) => void;
}

const DEFAULT_ITEMS_LIMIT = 1000;

async function fetchCollectionItems(
  id: string,
  params?: { page?: number; limit?: number; search?: string }
): Promise<VirtualCollectionItemsResponse> {
  return virtualFoldersApi.listItems(id, {
    page: params?.page ?? 1,
    limit: params?.limit ?? DEFAULT_ITEMS_LIMIT,
    search: params?.search
  });
}

export const useVirtualFolderStore = create<VirtualFolderState>((set, get) => ({
  collections: [],
  collectionsLoading: false,
  collectionsError: null,
  activeCollectionId: null,
  itemsByCollection: {},
  itemsMeta: {},
  itemsLoading: {},

  loadCollections: async () => {
    set({ collectionsLoading: true, collectionsError: null });
    try {
      const { collections } = await virtualFoldersApi.list();
      set({ collections, collectionsLoading: false });
    } catch (error) {
      set({
        collectionsLoading: false,
        collectionsError:
          error instanceof Error ? error.message : "Failed to load collections"
      });
    }
  },

  createCollection: async (name: string) => {
    const result = await virtualFoldersApi.create(name);
    if (!result.success || !result.collection) {
      throw new Error(result.error || "Failed to create collection");
    }

    const created = result.collection;
    set((state) => ({
      collections: [...state.collections, { ...created, itemCount: 0 }],
      activeCollectionId: created.id
    }));

    return created;
  },

  renameCollection: async (id: string, name: string) => {
    const response = await virtualFoldersApi.rename(id, name);
    if (!response.success) {
      return false;
    }

    set((state) => ({
      collections: state.collections.map((collection) =>
        collection.id === id ? { ...collection, name } : collection
      )
    }));

    return true;
  },

  deleteCollection: async (id: string) => {
    const response = await virtualFoldersApi.remove(id);
    if (!response.success) {
      return false;
    }

    set((state) => {
      const { [id]: _items, ...restItems } = state.itemsByCollection;
      const { [id]: _meta, ...restMeta } = state.itemsMeta;
      const { [id]: _loading, ...restLoading } = state.itemsLoading;
      const removedActive = state.activeCollectionId === id;

      return {
        collections: state.collections.filter(
          (collection) => collection.id !== id
        ),
        itemsByCollection: restItems,
        itemsMeta: restMeta,
        itemsLoading: restLoading,
        activeCollectionId: removedActive ? null : state.activeCollectionId
      };
    });

    return true;
  },

  reorderCollections: async (orderedIds: string[]) => {
    const response = await virtualFoldersApi.reorder(orderedIds);
    if (!response.success) {
      return false;
    }

    set((state) => {
      const collectionMap = new Map(state.collections.map((c) => [c.id, c]));
      const orderedCollections = orderedIds
        .map((id) => collectionMap.get(id))
        .filter((c): c is VirtualCollectionSummary => Boolean(c));

      // Append any collections missing from orderedIds to preserve them
      const remaining = state.collections.filter(
        (collection) => !orderedIds.includes(collection.id)
      );

      return {
        collections: [
          ...orderedCollections.map((collection, index) => ({
            ...collection,
            sortOrder: index
          })),
          ...remaining
        ]
      };
    });

    return true;
  },

  setActiveCollection: (id: string | null) => {
    set({ activeCollectionId: id });
  },

  loadCollectionItems: async (id: string, options?: { force?: boolean }) => {
    const { itemsByCollection, itemsLoading } = get();
    if (itemsByCollection[id] && !options?.force) {
      return;
    }
    if (itemsLoading[id]) {
      return;
    }

    set((state) => ({
      itemsLoading: { ...state.itemsLoading, [id]: true }
    }));

    try {
      const data = await fetchCollectionItems(id);
      set((state) => ({
        itemsByCollection: { ...state.itemsByCollection, [id]: data.items },
        itemsMeta: {
          ...state.itemsMeta,
          [id]: {
            total: data.total,
            page: data.page,
            limit: data.limit,
            lastFetchedAt: Date.now()
          }
        },
        itemsLoading: { ...state.itemsLoading, [id]: false },
        collections: state.collections.map((collection) =>
          collection.id === id
            ? { ...collection, itemCount: data.total }
            : collection
        )
      }));
    } catch (error) {
      set((state) => ({
        itemsLoading: { ...state.itemsLoading, [id]: false }
      }));
      throw error;
    }
  },

  addItemsToCollection: async (
    id: string,
    entries: AddVirtualFolderEntry[]
  ) => {
    const result = await virtualFoldersApi.addItems(id, entries);
    if (!result.success) {
      throw new Error(result.error || "Failed to add items");
    }

    const addedItems = result.added ?? [];
    if (addedItems.length === 0) {
      return [];
    }

    set((state) => {
      const prevItems = state.itemsByCollection[id] || [];
      return {
        itemsByCollection: {
          ...state.itemsByCollection,
          [id]: [...prevItems, ...addedItems]
        },
        itemsMeta: {
          ...state.itemsMeta,
          [id]: {
            total:
              (state.itemsMeta[id]?.total ?? prevItems.length) +
              addedItems.length,
            page: 1,
            limit: DEFAULT_ITEMS_LIMIT,
            lastFetchedAt: Date.now()
          }
        },
        collections: state.collections.map((collection) =>
          collection.id === id
            ? {
                ...collection,
                itemCount:
                  (state.itemsMeta[id]?.total ?? prevItems.length) +
                  addedItems.length
              }
            : collection
        )
      };
    });

    return addedItems;
  },

  removeItemFromCollection: async (id: string, itemId: string) => {
    const response = await virtualFoldersApi.removeItem(id, itemId);
    if (!response.success) {
      throw new Error(response.error || "Failed to remove item");
    }

    set((state) => {
      const currentItems = state.itemsByCollection[id] || [];
      const updatedItems = currentItems.filter(
        (item) => item.virtualItemId !== itemId
      );
      const meta = state.itemsMeta[id];
      const removedCount = currentItems.length - updatedItems.length;
      const nextTotal = meta
        ? Math.max(meta.total - removedCount, 0)
        : Math.max(currentItems.length - removedCount, 0);

      return {
        itemsByCollection: { ...state.itemsByCollection, [id]: updatedItems },
        itemsMeta: meta
          ? {
              ...state.itemsMeta,
              [id]: { ...meta, total: nextTotal }
            }
          : state.itemsMeta,
        collections: state.collections.map((collection) =>
          collection.id === id
            ? {
                ...collection,
                itemCount: Math.max(collection.itemCount - 1, 0)
              }
            : collection
        )
      };
    });
  },

  removeItemByPath: async (id: string, path: string) => {
    const items = get().itemsByCollection[id] || [];
    const target = items.find((item) => item.path === path);
    if (!target) return;

    await get().removeItemFromCollection(id, target.virtualItemId);
  },

  cleanupCollection: async (id: string) => {
    const result = await virtualFoldersApi.cleanup(id);
    if (!result.success) {
      throw new Error(result.error || "Failed to clean collection");
    }

    if (result.removed > 0) {
      await get().loadCollectionItems(id, { force: true });
    }

    return result.removed;
  },

  handlePathChange: (oldPath: string, newPath?: string) => {
    set((state) => {
      const deltas: Record<string, number> = {};
      const updatedItemsByCollection = Object.fromEntries(
        Object.entries(state.itemsByCollection).map(([collectionId, items]) => {
          const updatedItems = items
            .map((item) => {
              if (item.path !== oldPath) {
                return item;
              }
              if (!newPath) {
                return null;
              }
              return { ...item, path: newPath };
            })
            .filter((item): item is VirtualCollectionItem => Boolean(item));

          const removedCount = items.length - updatedItems.length;
          if (removedCount > 0) {
            deltas[collectionId] = removedCount;
          }

          return [collectionId, updatedItems];
        })
      );

      const updatedItemsMeta = { ...state.itemsMeta };
      Object.entries(deltas).forEach(([collectionId, delta]) => {
        const meta = updatedItemsMeta[collectionId];
        if (meta) {
          updatedItemsMeta[collectionId] = {
            ...meta,
            total: Math.max(meta.total - delta, 0)
          };
        }
      });

      return {
        itemsByCollection: updatedItemsByCollection,
        itemsMeta: updatedItemsMeta,
        collections: state.collections.map((collection) => {
          const delta = deltas[collection.id] ?? 0;
          if (!delta) return collection;
          return {
            ...collection,
            itemCount: Math.max(collection.itemCount - delta, 0)
          };
        })
      };
    });
  }
}));
