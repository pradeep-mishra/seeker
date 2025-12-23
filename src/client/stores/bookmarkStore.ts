// src/client/stores/bookmarkStore.ts
import { create } from "zustand";
import { bookmarksApi, type Bookmark } from "../lib/api";

interface BookmarkState {
  bookmarks: Bookmark[];
  isLoading: boolean;
  error: string | null;

  // Actions
  loadBookmarks: () => Promise<void>;
  addBookmark: (path: string, name: string) => Promise<void>;
  removeBookmark: (id: number) => Promise<void>;
}

export const useBookmarkStore = create<BookmarkState>((set, get) => ({
  bookmarks: [],
  isLoading: false,
  error: null,

  loadBookmarks: async () => {
    set({ isLoading: true, error: null });
    try {
      const result = await bookmarksApi.list();
      set({ bookmarks: result.bookmarks, isLoading: false });
    } catch (error) {
      set({
        error:
          error instanceof Error ? error.message : "Failed to load bookmarks",
        isLoading: false
      });
    }
  },

  addBookmark: async (path: string, name: string) => {
    try {
      await bookmarksApi.add(path, name);
      // Reload bookmarks to get the fresh list
      await get().loadBookmarks();
    } catch (error) {
      throw error;
    }
  },

  removeBookmark: async (id: number) => {
    try {
      await bookmarksApi.remove(id.toString());
      // Reload bookmarks to get the fresh list
      await get().loadBookmarks();
    } catch (error) {
      throw error;
    }
  }
}));
