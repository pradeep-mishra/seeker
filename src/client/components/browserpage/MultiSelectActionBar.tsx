import {
  Copy,
  Download,
  FolderMinus,
  FolderPlus,
  Plus,
  Scissors,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { filesApi } from "../../lib/api";
import { getFileName } from "../../lib/utils";
import { useFileStore } from "../../stores/fileStore";
import { useSelectionStore } from "../../stores/selectionStore";
import { useUIStore } from "../../stores/uiStore";
import { useVirtualFolderStore } from "../../stores/virtualFolderStore";
import { toast } from "../common/Toast";

export function MultiSelectActionBar() {
  const [searchParams] = useSearchParams();
  const { currentPath } = useFileStore();
  const {
    selectedPaths,
    clearSelection,
    copyToClipboard,
    cutToClipboard,
    getSelectedPaths,
    getSelectedItems,
  } = useSelectionStore();
  const { openDeleteDialog, openVirtualFolderDialog } = useUIStore();
  const { collections, addItemsToCollection, removeItemByPath } =
    useVirtualFolderStore();
  const [showVirtualMenu, setShowVirtualMenu] = useState(false);
  const virtualMenuRef = useRef<HTMLDivElement>(null);

  const selectedCount = selectedPaths.size;
  const hasFolderSelected = useMemo(
    () => getSelectedItems().some((item) => item.isDirectory),
    [getSelectedItems, selectedPaths]
  );
  const currentVirtualId = searchParams.get("virtual");
  const currentVirtualName = currentVirtualId
    ? collections.find((c) => c.id === currentVirtualId)?.name
    : null;

  const handleCopy = useCallback(() => {
    copyToClipboard(currentPath);
    toast.info("Copied to clipboard");
    clearSelection();
  }, [copyToClipboard, currentPath, clearSelection]);

  const handleCut = useCallback(() => {
    cutToClipboard(currentPath);
    toast.info("Cut to clipboard");
    clearSelection();
  }, [cutToClipboard, currentPath, clearSelection]);

  const handleDownload = useCallback(() => {
    const paths = getSelectedPaths();

    // Download files using hidden anchor tags to avoid opening new tabs
    paths.forEach((path, index) => {
      // Slight delay between downloads to avoid browser blocking
      setTimeout(() => {
        const a = document.createElement("a");
        a.href = filesApi.download(path);
        a.download = ""; // Hint browser to download rather than navigate
        a.style.display = "none";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }, index * 100); // 100ms delay between each download
    });

    toast.success(
      `Downloading ${paths.length} ${paths.length === 1 ? "item" : "items"}`
    );
    clearSelection();
  }, [getSelectedPaths, clearSelection]);

  const handleDelete = useCallback(() => {
    const paths = getSelectedPaths();
    if (paths.length > 0) {
      openDeleteDialog(paths);
    }
  }, [getSelectedPaths, openDeleteDialog]);

  const handleAddToVirtualCollection = useCallback(
    async (collectionId: string) => {
      const paths = getSelectedPaths();
      if (!paths.length) return;

      try {
        await addItemsToCollection(
          collectionId,
          paths.map((path) => ({ path }))
        );
        toast.success("Added to virtual folder");
        clearSelection();
        setShowVirtualMenu(false);
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Failed to add to virtual folder"
        );
      }
    },
    [getSelectedPaths, addItemsToCollection, clearSelection]
  );

  const handleCreateVirtualFolder = useCallback(() => {
    const paths = getSelectedPaths();
    if (!paths.length) return;

    const initialName = paths.length === 1 ? getFileName(paths[0]) || "" : "";

    openVirtualFolderDialog({
      pendingPaths: paths,
      initialName,
      clearSelectionOnComplete: true,
    });
    setShowVirtualMenu(false);
  }, [getSelectedPaths, openVirtualFolderDialog]);

  const handleRemoveFromVirtual = useCallback(async () => {
    const currentVirtualId = searchParams.get("virtual");
    if (!currentVirtualId) return;
    const paths = getSelectedPaths();
    if (!paths.length) return;

    try {
      await Promise.all(
        paths.map((path) => removeItemByPath(currentVirtualId, path))
      );
      toast.success("Removed from virtual folder");
      clearSelection();
      setShowVirtualMenu(false);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to remove from virtual folder"
      );
    }
  }, [searchParams, getSelectedPaths, removeItemByPath, clearSelection]);

  useEffect(() => {
    if (!showVirtualMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        virtualMenuRef.current &&
        !virtualMenuRef.current.contains(e.target as Node)
      ) {
        setShowVirtualMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showVirtualMenu]);

  useEffect(() => {
    setShowVirtualMenu(false);
  }, [selectedCount]);

  if (selectedCount <= 1) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 animate-slide-up">
      <div className="bg-accent text-white rounded-full shadow-elevated flex items-center gap-1 px-4 py-2.5">
        {/* Selection count */}
        <div className="px-2 py-1 font-medium text-sm whitespace-nowrap select-none">
          {selectedCount} {selectedCount === 1 ? "item" : "items"} selected
        </div>

        {/* Divider */}
        <div className="w-px h-6 bg-white/20 mx-1" />

        {/* Action buttons */}
        <button
          onClick={handleCopy}
          className="p-2 hover:bg-white/20 rounded-full transition-colors"
          title="Copy"
          aria-label="Copy selected items"
        >
          <Copy className="h-4 w-4" />
        </button>

        <button
          onClick={handleCut}
          className="p-2 hover:bg-white/20 rounded-full transition-colors"
          title="Cut"
          aria-label="Cut selected items"
        >
          <Scissors className="h-4 w-4" />
        </button>

        {!hasFolderSelected && (
          <button
            onClick={handleDownload}
            className="p-2 hover:bg-white/20 rounded-full transition-colors"
            title="Download"
            aria-label="Download selected items"
          >
            <Download className="h-4 w-4" />
          </button>
        )}

        <button
          onClick={handleDelete}
          className="p-2 hover:bg-white/20 rounded-full transition-colors"
          title="Delete"
          aria-label="Delete selected items"
        >
          <Trash2 className="h-4 w-4" />
        </button>

        <div className="relative" ref={virtualMenuRef}>
          <button
            onClick={() => setShowVirtualMenu((prev) => !prev)}
            className={`p-2 rounded-full transition-colors ${
              showVirtualMenu ? "bg-white/30" : "hover:bg-white/20"
            }`}
            title="Virtual folders"
            aria-label="Virtual folders"
          >
            <FolderPlus className="h-4 w-4" />
          </button>

          {showVirtualMenu && (
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-surface text-content rounded-lg shadow-elevated min-w-[220px] p-2 space-y-1">
              {collections.length === 0 ? (
                <div className="text-xs text-content-tertiary px-1 py-1">
                  No virtual folders yet
                </div>
              ) : (
                collections.slice(0, 6).map((collection) => (
                  <button
                    key={collection.id}
                    onClick={() => handleAddToVirtualCollection(collection.id)}
                    className="w-full flex items-center gap-2 px-2 py-1 text-sm rounded hover:bg-surface-hover transition-colors"
                  >
                    <FolderPlus className="h-4 w-4 text-accent" />
                    <span className="truncate select-none">
                      {collection.name}
                    </span>
                  </button>
                ))
              )}

              <button
                onClick={handleCreateVirtualFolder}
                className="select-none w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-surface-hover transition-colors font-medium"
              >
                <Plus className="h-4 w-4 text-accent" />
                New virtual folder
              </button>

              {currentVirtualId && (
                <button
                  onClick={handleRemoveFromVirtual}
                  className="select-none w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-surface-hover transition-colors text-error"
                >
                  <FolderMinus className="h-4 w-4" />
                  Remove from {currentVirtualName || "this virtual folder"}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="w-px h-6 bg-white/20 mx-1" />

        {/* Clear selection button */}
        <button
          onClick={clearSelection}
          className="p-2 hover:bg-white/20 rounded-full transition-colors"
          title="Clear selection"
          aria-label="Clear selection"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
