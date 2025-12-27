// src/client/stores/fileStore.ts
import { create } from "zustand";
import { filesApi, type FileItem, type Mount } from "../lib/api";

interface FileState {
  // Current path state
  currentPath: string;
  currentMount: Mount | null;
  files: FileItem[];
  isLoading: boolean;
  error: string | null;
  warning: string | null; // Warning for large directories

  // Pagination
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;

  // Navigation history
  history: string[];
  historyIndex: number;

  // Search state
  searchQuery: string;
  isSearching: boolean;
  searchResults: FileItem[];

  // Actions
  setCurrentPath: (path: string, addToHistory?: boolean) => void;
  setCurrentMount: (mount: Mount | null) => void;
  loadFiles: () => Promise<void>;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
  goBack: () => void;
  goForward: () => void;
  canGoBack: () => boolean;
  canGoForward: () => boolean;
  navigateToPath: (path: string, mount?: Mount | null) => void;

  // Search
  setSearchQuery: (query: string) => void;
  search: (query: string, recursive?: boolean) => Promise<void>;
  clearSearch: () => void;

  // Optimistic updates
  removeFiles: (paths: string[]) => void;
}

export const useFileStore = create<FileState>((set, get) => ({
  // Initial state
  currentPath: "",
  currentMount: null,
  files: [],
  isLoading: false,
  error: null,
  warning: null,

  page: 1,
  limit: 50,
  total: 0,
  hasMore: false,

  history: [],
  historyIndex: -1,

  searchQuery: "",
  isSearching: false,
  searchResults: [],

  // Set current path
  setCurrentPath: (path, addToHistory = true) => {
    const { history, historyIndex } = get();

    if (addToHistory) {
      // Remove any forward history when navigating to a new path
      const newHistory = history.slice(0, historyIndex + 1);
      newHistory.push(path);
      set({
        currentPath: path,
        history: newHistory,
        historyIndex: newHistory.length - 1,
        page: 1,
        files: [],
        searchQuery: "",
        searchResults: [],
        isSearching: false
      });
    } else {
      set({
        currentPath: path,
        page: 1,
        files: [],
        searchQuery: "",
        searchResults: [],
        isSearching: false
      });
    }
  },

  // Set current mount
  setCurrentMount: (mount) => {
    set({ currentMount: mount });
  },

  // Load files for current path
  loadFiles: async () => {
    const { currentPath, limit, searchQuery } = get();

    if (!currentPath) return;

    set({ isLoading: true, error: null, warning: null });

    try {
      const result = await filesApi.list({
        path: currentPath,
        page: 1,
        limit,
        search: searchQuery || undefined
      });

      set({
        files: result.items,
        page: result.page,
        total: result.total,
        hasMore: result.hasMore,
        warning: result._warning || null,
        isLoading: false
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Failed to load files",
        isLoading: false
      });
    }
  },

  // Load more files (pagination)
  loadMore: async () => {
    const { currentPath, page, limit, hasMore, isLoading, files, searchQuery } =
      get();

    if (!hasMore || isLoading) return;

    set({ isLoading: true });

    try {
      const result = await filesApi.list({
        path: currentPath,
        page: page + 1,
        limit,
        search: searchQuery || undefined
      });

      set({
        files: [...files, ...result.items],
        page: result.page,
        hasMore: result.hasMore,
        warning: result._warning || null,
        isLoading: false
      });
    } catch (error) {
      set({
        error:
          error instanceof Error ? error.message : "Failed to load more files",
        isLoading: false
      });
    }
  },

  // Refresh current directory
  refresh: async () => {
    const { loadFiles } = get();
    await loadFiles();
  },

  // Navigate back in history
  goBack: () => {
    const { history, historyIndex } = get();
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      set({
        historyIndex: newIndex,
        currentPath: history[newIndex],
        page: 1,
        files: []
      });
      get().loadFiles();
    }
  },

  // Navigate forward in history
  goForward: () => {
    const { history, historyIndex } = get();
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      set({
        historyIndex: newIndex,
        currentPath: history[newIndex],
        page: 1,
        files: []
      });
      get().loadFiles();
    }
  },

  // Check if can go back
  canGoBack: () => {
    const { historyIndex } = get();
    return historyIndex > 0;
  },

  // Check if can go forward
  canGoForward: () => {
    const { history, historyIndex } = get();
    return historyIndex < history.length - 1;
  },

  // Navigate to a specific path
  navigateToPath: (path, mount) => {
    const { setCurrentPath, setCurrentMount, loadFiles, currentMount } = get();

    // If mount is explicitly provided, use it
    if (mount !== undefined) {
      setCurrentMount(mount);
    } else if (currentMount && !path.startsWith(currentMount.path)) {
      // If current mount exists but new path doesn't belong to it, clear the mount
      setCurrentMount(null);
    }
    // Otherwise, keep the current mount (navigating within the same mount)

    setCurrentPath(path);
    loadFiles();
  },

  // Set search query
  setSearchQuery: (query) => {
    set({ searchQuery: query });
  },

  // Search files
  search: async (query, recursive = false) => {
    const { currentPath } = get();

    if (!query.trim()) {
      get().clearSearch();
      return;
    }

    set({ isSearching: true, searchQuery: query });

    try {
      const result = await filesApi.search({
        path: currentPath,
        q: query,
        recursive
      });

      set({
        searchResults: result.items,
        isSearching: false
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Search failed",
        isSearching: false
      });
    }
  },

  // Clear search
  clearSearch: () => {
    set({
      searchQuery: "",
      searchResults: [],
      isSearching: false
    });
  },

  // Remove files optimistically
  removeFiles: (paths) => {
    const { files, total, hasMore, loadFiles } = get();
    const newFiles = files.filter((f) => !paths.includes(f.path));

    // If we cleared the current view but there are more files, reload to fetch them
    if (newFiles.length === 0 && hasMore) {
      loadFiles();
      return;
    }

    set({
      files: newFiles,
      total: Math.max(0, total - paths.length)
    });
  }
}));
