// src/client/stores/uiStore.ts
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { settingsApi } from "../lib/api";

type ViewMode = "list" | "thumbnail" | "card";
type SortBy = "name" | "date" | "size" | "type";
type SortOrder = "asc" | "desc";

interface ContextMenuState {
  isOpen: boolean;
  x: number;
  y: number;
  type: "file" | "folder" | "background" | "multi";
  targetPath?: string;
}

interface DialogState {
  createFolder: boolean;
  createFile: boolean;
  rename: { isOpen: boolean; path: string; currentName: string };
  delete: { isOpen: boolean; paths: string[] };
  conflict: {
    isOpen: boolean;
    paths: string[];
    destination: string;
    action: "copy" | "move";
    onResolve?: (action: "overwrite" | "skip" | "rename") => void;
  };
  settings: boolean;
  getInfo: { isOpen: boolean; path: string };
}

interface UIState {
  // Settings
  viewMode: ViewMode;
  sortBy: SortBy;
  sortOrder: SortOrder;
  showHiddenFiles: boolean;
  theme: "light" | "dark";

  // Video player settings
  videoVolume: number;

  // Sidebar
  isSidebarOpen: boolean;
  isSidebarCollapsed: boolean;
  mountsRefreshKey: number;

  // Context menu
  contextMenu: ContextMenuState;

  // Dialogs
  dialogs: DialogState;

  // Loading states
  isSettingsLoading: boolean;

  // Actions - Settings
  setViewMode: (mode: ViewMode) => void;
  setSortBy: (sortBy: SortBy) => void;
  setSortOrder: (order: SortOrder) => void;
  toggleSortOrder: () => void;
  setShowHiddenFiles: (show: boolean) => void;
  setTheme: (theme: "light" | "dark") => void;
  setVideoVolume: (volume: number) => void;
  loadSettings: () => Promise<void>;
  saveSettings: () => Promise<void>;

  // Actions - Sidebar
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  refreshMounts: () => void;

  // Actions - Context menu
  openContextMenu: (
    x: number,
    y: number,
    type: ContextMenuState["type"],
    targetPath?: string
  ) => void;
  closeContextMenu: () => void;

  // Actions - Dialogs
  openCreateFolderDialog: () => void;
  closeCreateFolderDialog: () => void;
  openCreateFileDialog: () => void;
  closeCreateFileDialog: () => void;
  openRenameDialog: (path: string, currentName: string) => void;
  closeRenameDialog: () => void;
  openDeleteDialog: (paths: string[]) => void;
  closeDeleteDialog: () => void;
  openConflictDialog: (
    paths: string[],
    destination: string,
    action: "copy" | "move",
    onResolve: (action: "overwrite" | "skip" | "rename") => void
  ) => void;
  closeConflictDialog: () => void;
  openSettingsDialog: () => void;
  closeSettingsDialog: () => void;
  openGetInfoDialog: (path: string) => void;
  closeGetInfoDialog: () => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set, get) => ({
      // Initial state
      viewMode: "list",
      sortBy: "name",
      sortOrder: "asc",
      showHiddenFiles: true,
      theme: "light",
      videoVolume: 1.0,

      isSidebarOpen: true,
      isSidebarCollapsed: false,
      mountsRefreshKey: 0,

      contextMenu: {
        isOpen: false,
        x: 0,
        y: 0,
        type: "background"
      },

      dialogs: {
        createFolder: false,
        createFile: false,
        rename: { isOpen: false, path: "", currentName: "" },
        delete: { isOpen: false, paths: [] },
        conflict: {
          isOpen: false,
          paths: [],
          destination: "",
          action: "copy"
        },
        settings: false,
        getInfo: { isOpen: false, path: "" }
      },

      isSettingsLoading: false,

      // Settings actions
      setViewMode: (mode) => {
        set({ viewMode: mode });
        get().saveSettings();
      },

      setSortBy: (sortBy) => {
        set({ sortBy });
        get().saveSettings();
      },

      setSortOrder: (order) => {
        set({ sortOrder: order });
        get().saveSettings();
      },

      toggleSortOrder: () => {
        const { sortOrder } = get();
        set({ sortOrder: sortOrder === "asc" ? "desc" : "asc" });
        get().saveSettings();
      },

      setShowHiddenFiles: (show) => {
        set({ showHiddenFiles: show });
        get().saveSettings();
      },

      setTheme: (theme) => {
        set({ theme });
        // Apply theme to document
        if (theme === "dark") {
          document.documentElement.classList.add("dark");
        } else {
          document.documentElement.classList.remove("dark");
        }
        get().saveSettings();
      },

      setVideoVolume: (volume) => {
        set({ videoVolume: Math.max(0, Math.min(1, volume)) });
      },

      loadSettings: async () => {
        set({ isSettingsLoading: true });
        try {
          const { settings } = await settingsApi.get();
          set({
            viewMode: settings.viewMode,
            sortBy: settings.sortBy,
            sortOrder: settings.sortOrder,
            showHiddenFiles: settings.showHiddenFiles,
            theme: settings.theme as "light" | "dark",
            isSettingsLoading: false
          });

          // Apply theme
          if (settings.theme === "dark") {
            document.documentElement.classList.add("dark");
          } else {
            document.documentElement.classList.remove("dark");
          }
        } catch (error) {
          console.error("Failed to load settings:", error);
          set({ isSettingsLoading: false });
        }
      },

      saveSettings: async () => {
        const { viewMode, sortBy, sortOrder, showHiddenFiles, theme } = get();
        try {
          await settingsApi.update({
            viewMode,
            sortBy,
            sortOrder,
            showHiddenFiles,
            theme
          });
        } catch (error) {
          console.error("Failed to save settings:", error);
        }
      },

      // Sidebar actions
      toggleSidebar: () => {
        const { isSidebarOpen } = get();
        set({ isSidebarOpen: !isSidebarOpen });
      },

      setSidebarOpen: (open) => {
        set({ isSidebarOpen: open });
      },

      setSidebarCollapsed: (collapsed) => {
        set({ isSidebarCollapsed: collapsed });
      },

      refreshMounts: () => {
        set({ mountsRefreshKey: get().mountsRefreshKey + 1 });
      },

      // Context menu actions
      openContextMenu: (x, y, type, targetPath) => {
        set({
          contextMenu: {
            isOpen: true,
            x,
            y,
            type,
            targetPath
          }
        });
      },

      closeContextMenu: () => {
        set({
          contextMenu: {
            ...get().contextMenu,
            isOpen: false
          }
        });
      },

      // Dialog actions
      openCreateFolderDialog: () => {
        set({
          dialogs: { ...get().dialogs, createFolder: true }
        });
      },

      closeCreateFolderDialog: () => {
        set({
          dialogs: { ...get().dialogs, createFolder: false }
        });
      },

      openCreateFileDialog: () => {
        set({
          dialogs: { ...get().dialogs, createFile: true }
        });
      },

      closeCreateFileDialog: () => {
        set({
          dialogs: { ...get().dialogs, createFile: false }
        });
      },

      openRenameDialog: (path, currentName) => {
        set({
          dialogs: {
            ...get().dialogs,
            rename: { isOpen: true, path, currentName }
          }
        });
      },

      closeRenameDialog: () => {
        set({
          dialogs: {
            ...get().dialogs,
            rename: { isOpen: false, path: "", currentName: "" }
          }
        });
      },

      openDeleteDialog: (paths) => {
        set({
          dialogs: {
            ...get().dialogs,
            delete: { isOpen: true, paths }
          }
        });
      },

      closeDeleteDialog: () => {
        set({
          dialogs: {
            ...get().dialogs,
            delete: { isOpen: false, paths: [] }
          }
        });
      },

      openConflictDialog: (paths, destination, action, onResolve) => {
        set({
          dialogs: {
            ...get().dialogs,
            conflict: { isOpen: true, paths, destination, action, onResolve }
          }
        });
      },

      closeConflictDialog: () => {
        set({
          dialogs: {
            ...get().dialogs,
            conflict: {
              isOpen: false,
              paths: [],
              destination: "",
              action: "copy",
              onResolve: undefined
            }
          }
        });
      },

      openSettingsDialog: () => {
        set({
          dialogs: { ...get().dialogs, settings: true }
        });
      },

      closeSettingsDialog: () => {
        set({
          dialogs: { ...get().dialogs, settings: false }
        });
      },

      openGetInfoDialog: (path) => {
        set({
          dialogs: { ...get().dialogs, getInfo: { isOpen: true, path } }
        });
      },

      closeGetInfoDialog: () => {
        set({
          dialogs: { ...get().dialogs, getInfo: { isOpen: false, path: "" } }
        });
      }
    }),
    {
      name: "seeker-ui-storage",
      partialize: (state) => ({
        isSidebarCollapsed: state.isSidebarCollapsed,
        videoVolume: state.videoVolume
      })
    }
  )
);
