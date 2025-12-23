// src/client/stores/selectionStore.ts
import { create } from "zustand";
import type { FileItem } from "../lib/api";

type ClipboardAction = "copy" | "cut";

interface SelectionState {
  // Selected files
  selectedPaths: Set<string>;
  selectedItems: Map<string, FileItem>;
  lastSelectedPath: string | null;

  // Clipboard
  clipboardPaths: string[];
  clipboardAction: ClipboardAction | null;
  clipboardSourcePath: string | null;

  // Actions
  select: (item: FileItem) => void;
  toggleSelect: (item: FileItem) => void;
  rangeSelect: (items: FileItem[], targetItem: FileItem) => void;
  selectAll: (items: FileItem[]) => void;
  clearSelection: () => void;
  isSelected: (path: string) => boolean;
  getSelectedItems: () => FileItem[];
  getSelectedPaths: () => string[];

  // Clipboard actions
  copyToClipboard: (sourcePath: string) => void;
  cutToClipboard: (sourcePath: string) => void;
  clearClipboard: () => void;
  hasClipboard: () => boolean;
  getClipboardInfo: () => { paths: string[]; action: ClipboardAction | null; sourcePath: string | null };
}

export const useSelectionStore = create<SelectionState>((set, get) => ({
  // Initial state
  selectedPaths: new Set<string>(),
  selectedItems: new Map<string, FileItem>(),
  lastSelectedPath: null,

  clipboardPaths: [],
  clipboardAction: null,
  clipboardSourcePath: null,

  // Select a single item (replaces selection)
  select: (item) => {
    const selectedPaths = new Set([item.path]);
    const selectedItems = new Map([[item.path, item]]);
    set({
      selectedPaths,
      selectedItems,
      lastSelectedPath: item.path,
    });
  },

  // Toggle selection of an item (Ctrl/Cmd+click)
  toggleSelect: (item) => {
    const { selectedPaths, selectedItems } = get();
    const newSelectedPaths = new Set(selectedPaths);
    const newSelectedItems = new Map(selectedItems);

    if (newSelectedPaths.has(item.path)) {
      newSelectedPaths.delete(item.path);
      newSelectedItems.delete(item.path);
    } else {
      newSelectedPaths.add(item.path);
      newSelectedItems.set(item.path, item);
    }

    set({
      selectedPaths: newSelectedPaths,
      selectedItems: newSelectedItems,
      lastSelectedPath: item.path,
    });
  },

  // Range select (Shift+click)
  rangeSelect: (items, targetItem) => {
    const { lastSelectedPath } = get();

    if (!lastSelectedPath) {
      get().select(targetItem);
      return;
    }

    // Find indices
    const lastIndex = items.findIndex((i) => i.path === lastSelectedPath);
    const targetIndex = items.findIndex((i) => i.path === targetItem.path);

    if (lastIndex === -1 || targetIndex === -1) {
      get().select(targetItem);
      return;
    }

    // Get range
    const start = Math.min(lastIndex, targetIndex);
    const end = Math.max(lastIndex, targetIndex);
    const rangeItems = items.slice(start, end + 1);

    // Create new selection
    const newSelectedPaths = new Set<string>();
    const newSelectedItems = new Map<string, FileItem>();

    for (const item of rangeItems) {
      newSelectedPaths.add(item.path);
      newSelectedItems.set(item.path, item);
    }

    set({
      selectedPaths: newSelectedPaths,
      selectedItems: newSelectedItems,
      // Keep lastSelectedPath the same for range selection
    });
  },

  // Select all items
  selectAll: (items) => {
    const selectedPaths = new Set<string>();
    const selectedItems = new Map<string, FileItem>();

    for (const item of items) {
      selectedPaths.add(item.path);
      selectedItems.set(item.path, item);
    }

    set({
      selectedPaths,
      selectedItems,
      lastSelectedPath: items.length > 0 ? items[items.length - 1].path : null,
    });
  },

  // Clear selection
  clearSelection: () => {
    set({
      selectedPaths: new Set(),
      selectedItems: new Map(),
      lastSelectedPath: null,
    });
  },

  // Check if path is selected
  isSelected: (path) => {
    return get().selectedPaths.has(path);
  },

  // Get all selected items
  getSelectedItems: () => {
    return Array.from(get().selectedItems.values());
  },

  // Get all selected paths
  getSelectedPaths: () => {
    return Array.from(get().selectedPaths);
  },

  // Copy selected items to clipboard
  copyToClipboard: (sourcePath) => {
    const { selectedPaths } = get();
    set({
      clipboardPaths: Array.from(selectedPaths),
      clipboardAction: "copy",
      clipboardSourcePath: sourcePath,
    });
  },

  // Cut selected items to clipboard
  cutToClipboard: (sourcePath) => {
    const { selectedPaths } = get();
    set({
      clipboardPaths: Array.from(selectedPaths),
      clipboardAction: "cut",
      clipboardSourcePath: sourcePath,
    });
  },

  // Clear clipboard
  clearClipboard: () => {
    set({
      clipboardPaths: [],
      clipboardAction: null,
      clipboardSourcePath: null,
    });
  },

  // Check if clipboard has items
  hasClipboard: () => {
    return get().clipboardPaths.length > 0;
  },

  // Get clipboard info
  getClipboardInfo: () => {
    const { clipboardPaths, clipboardAction, clipboardSourcePath } = get();
    return {
      paths: clipboardPaths,
      action: clipboardAction,
      sourcePath: clipboardSourcePath,
    };
  },
}));
