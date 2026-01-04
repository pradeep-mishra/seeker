import { FilePlus, FolderPlus, Plus, RefreshCw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useFileStore } from "../../stores/fileStore";
import { useSelectionStore } from "../../stores/selectionStore";
import { useUIStore } from "../../stores/uiStore";
import { useVirtualFolderStore } from "../../stores/virtualFolderStore";
import { toast } from "../common/Toast";
import { Breadcrumb } from "../files/Breadcrumb";

export function Toolbar() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { files, isLoading, hasMore, refresh } = useFileStore();
  const { selectedPaths } = useSelectionStore();
  const { openCreateFolderDialog, openCreateFileDialog } = useUIStore();
  const {
    collections,
    itemsByCollection,
    itemsLoading,
    loadCollectionItems,
    setActiveCollection
  } = useVirtualFolderStore();

  const [showNewMenu, setShowNewMenu] = useState(false);
  const newMenuRef = useRef<HTMLDivElement>(null);
  const virtualCollectionId = searchParams.get("virtual");
  const isVirtualView = Boolean(virtualCollectionId);
  const virtualItems = virtualCollectionId
    ? itemsByCollection[virtualCollectionId] || []
    : [];
  const virtualIsLoading = virtualCollectionId
    ? itemsLoading[virtualCollectionId] || false
    : false;
  const displayCount = isVirtualView ? virtualItems.length : files.length;
  const displayHasMore = isVirtualView ? false : hasMore;
  const displayIsLoading = isVirtualView ? virtualIsLoading : isLoading;
  const activeCollection = isVirtualView
    ? collections.find((c) => c.id === virtualCollectionId)
    : undefined;

  // Close new menu on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        newMenuRef.current &&
        !newMenuRef.current.contains(e.target as Node)
      ) {
        setShowNewMenu(false);
      }
    };

    if (showNewMenu) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showNewMenu]);

  const handleRefresh = () => {
    if (isVirtualView && virtualCollectionId) {
      loadCollectionItems(virtualCollectionId, { force: true }).catch(() => {
        toast.error("Failed to refresh virtual folder");
      });
      return;
    }
    refresh();
  };

  const handleExitVirtualView = () => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("virtual");
    setActiveCollection(null);
    setSearchParams(nextParams);
  };

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 px-4 py-2 border-b border-border bg-surface-secondary flex-shrink-0 transition-all">
      {/* Breadcrumb navigation */}
      <div className="flex-1 min-w-0 w-full max-sm:border-b max-sm:border-border max-sm:pb-2">
        {isVirtualView && (
          <div className="flex items-center gap-2 text-sm text-content-tertiary mb-2">
            <span>Virtual Folder:</span>
            <span className="px-2 py-0.5 rounded-full bg-accent/10 text-accent text-sm font-medium">
              {activeCollection?.name || "Collection"}
            </span>
            <button
              onClick={handleExitVirtualView}
              className="text-xs px-2 py-0.5 rounded-full border border-border hover:bg-surface-hover text-content-secondary transition-colors">
              Exit view
            </button>
          </div>
        )}
        <Breadcrumb isVirtualView={isVirtualView} />
      </div>

      {/* Actions and count */}
      <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 w-full sm:w-auto">
        <span className="text-sm text-content-tertiary truncate">
          {/* selectedPaths.size > 0 ? (
            <>
              <span className="text-accent font-medium">
                {selectedPaths.size} selected
              </span>
              <span className="mx-2 text-border">|</span>
            </>
          ) : null */}
          {displayCount}{" "}
          {displayCount === 1
            ? `item`
            : `items ${displayHasMore ? "loaded" : ""}`}
          {displayHasMore && (
            <span className="ml-1 text-accent hidden sm:inline">
              (more available)
            </span>
          )}
        </span>
        <div className="flex items-center gap-3 shrink-0">
          <div className="hidden sm:block w-px h-5 bg-border" />
          {!isVirtualView && (
            <div className="relative" ref={newMenuRef}>
              <button
                onClick={() => setShowNewMenu(!showNewMenu)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-content-secondary hover:text-content hover:bg-surface-hover rounded transition-colors">
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">New</span>
              </button>
              {showNewMenu && (
                <div className="absolute top-full mt-1 right-0 bg-surface border border-border rounded-lg shadow-lg py-1 min-w-[160px] z-50">
                  <button
                    onClick={() => {
                      openCreateFolderDialog();
                      setShowNewMenu(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-content hover:bg-surface-hover transition-colors">
                    <FolderPlus className="h-4 w-4" />
                    <span>New Folder</span>
                  </button>
                  <button
                    onClick={() => {
                      openCreateFileDialog();
                      setShowNewMenu(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-content hover:bg-surface-hover transition-colors">
                    <FilePlus className="h-4 w-4" />
                    <span>New File</span>
                  </button>
                </div>
              )}
            </div>
          )}
          <button
            onClick={handleRefresh}
            disabled={displayIsLoading}
            className="p-1.5 text-content-secondary hover:text-content hover:bg-surface-hover rounded transition-colors disabled:opacity-50"
            aria-label="Refresh">
            <RefreshCw
              className={`h-4 w-4 ${displayIsLoading ? "animate-spin" : ""}`}
            />
          </button>
        </div>
      </div>
    </div>
  );
}
