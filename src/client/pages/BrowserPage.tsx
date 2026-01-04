import { FolderUp } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  EmptyStates,
  FileListContainer,
  MultiSelectActionBar,
  SelectionBox,
  Toolbar,
  WarningBanner
} from "../components/browserpage";
import { LoadingSpinner } from "../components/common/LoadingScreen";
import { toast } from "../components/common/Toast";
import { CreateFileDialog } from "../components/dialogs/CreateFileDialog";
import { CreateFolderDialog } from "../components/dialogs/CreateFolderDialog";
import { DeleteDialog } from "../components/dialogs/DeleteDialog";
import { GetInfoDialog } from "../components/dialogs/GetInfoDialog";
import { RenameDialog } from "../components/dialogs/RenameDialog";
import { VirtualFolderDialog } from "../components/dialogs/VirtualFolderDialog";
import { FileContextMenu } from "../components/files/FileContextMenu";
import { mountsApi, type Mount } from "../lib/api";
import { collectUploadItemsFromDataTransfer } from "../lib/uploadUtils";
import { useFileUpload } from "../lib/useFileUpload";
import { useLassoSelection } from "../lib/useLassoSelection";
import { useAuthStore } from "../stores/authStore";
import { useFileStore } from "../stores/fileStore";
import { useSelectionStore } from "../stores/selectionStore";
import { useUIStore } from "../stores/uiStore";
import { useVirtualFolderStore } from "../stores/virtualFolderStore";

/**
 * Find the mount that a path belongs to.
 * Returns the mount with the longest matching path to handle nested mounts correctly.
 */
function findMountForPath(path: string, mounts: Mount[]): Mount | null {
  if (!path || mounts.length === 0) return null;

  // Normalize path (remove trailing slashes for comparison)
  const normalizedPath = path.replace(/\/+$/, "");

  let bestMatch: Mount | null = null;
  let bestMatchLength = 0;

  for (const mount of mounts) {
    const normalizedMountPath = mount.path.replace(/\/+$/, "");

    // Check for exact match first
    if (normalizedPath === normalizedMountPath) {
      return mount;
    }

    // Check if path starts with mount path
    if (normalizedPath.startsWith(normalizedMountPath + "/")) {
      // Use the longest matching mount (handles nested mounts)
      if (normalizedMountPath.length > bestMatchLength) {
        bestMatch = mount;
        bestMatchLength = normalizedMountPath.length;
      }
    }
  }

  return bestMatch;
}

export default function BrowserPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuthStore();
  const {
    currentPath,
    currentMount,
    files,
    isLoading,
    error,
    warning,
    loadFiles,
    loadMore,
    hasMore,
    navigateToPath,
    refresh,
    searchQuery,
    setCurrentMount
  } = useFileStore();
  const { viewMode, loadSettings, dialogs, openCreateFolderDialog } =
    useUIStore();
  const { clearSelection, selectAll, selectedPaths } = useSelectionStore();
  const {
    activeCollectionId,
    setActiveCollection,
    loadCollectionItems,
    itemsByCollection,
    itemsLoading
  } = useVirtualFolderStore();

  const [mounts, setMounts] = useState<Mount[]>([]);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const dragDepthRef = useRef(0);
  const { uploadFiles } = useFileUpload();

  const virtualCollectionId = searchParams.get("virtual");
  const isVirtualView = Boolean(virtualCollectionId);
  const virtualItemsRaw = virtualCollectionId
    ? itemsByCollection[virtualCollectionId]
    : undefined;
  const hasVirtualItems = Array.isArray(virtualItemsRaw);
  const virtualItems = hasVirtualItems ? virtualItemsRaw! : [];
  const virtualItemsLoading = virtualCollectionId
    ? itemsLoading[virtualCollectionId] || false
    : false;
  const normalizedSearchQuery = searchQuery
    ? searchQuery.toLowerCase().trim()
    : "";
  const displayedFiles = useMemo(() => {
    if (!isVirtualView) {
      return files;
    }

    const source = virtualItems;

    if (!normalizedSearchQuery) {
      return source;
    }

    return source.filter((item) =>
      item.name.toLowerCase().includes(normalizedSearchQuery)
    );
  }, [isVirtualView, files, virtualItems, normalizedSearchQuery]);
  const displayIsLoading = isVirtualView
    ? virtualItemsLoading || !hasVirtualItems
    : isLoading;
  const displayHasMore = isVirtualView ? false : hasMore;
  const effectiveError = isVirtualView ? null : error;
  const showWarning = !isVirtualView ? warning : null;

  // Ref for infinite scroll observer
  const loadMoreTriggerRef = useRef<HTMLDivElement>(null);

  // Ref for file container (used by lasso selection and drag-drop)
  const containerRef = useRef<HTMLDivElement>(null);

  // Lasso selection hook
  const { selectionBox, handleMouseDown, isDragging } = useLassoSelection({
    containerRef,
    files: displayedFiles,
    clearSelection,
    selectAll
  });

  // Load settings and check mounts on mount
  useEffect(() => {
    const init = async () => {
      try {
        await loadSettings();
        const { mounts: mountList } = await mountsApi.list();
        setMounts(mountList);

        if (mountList.length === 0) {
          setIsInitializing(false);
          return;
        }

        // Try to get path from URL query string
        const urlPath = searchParams.get("path");
        const urlVirtual = searchParams.get("virtual");

        if (urlVirtual) {
          setActiveCollection(urlVirtual);
          try {
            await loadCollectionItems(urlVirtual, { force: true });
            setIsInitializing(false);
            return;
          } catch (error) {
            console.error("Failed to load virtual folder from URL:", error);
            const nextParams = new URLSearchParams(searchParams);
            nextParams.delete("virtual");
            setSearchParams(nextParams, { replace: true });
          }
        } else if (urlPath) {
          try {
            const decodedPath = decodeURIComponent(urlPath);

            // Find which mount this path belongs to
            const targetMount = findMountForPath(decodedPath, mountList);

            if (targetMount) {
              // Try to navigate to the path and verify it exists
              navigateToPath(decodedPath, targetMount);

              // Verify the path exists by attempting to load it
              try {
                await loadFiles();
                // If successful, update URL to ensure it's correct and we're done
                const encodedPath = encodeURIComponent(decodedPath);
                if (urlPath !== encodedPath) {
                  setSearchParams({ path: encodedPath }, { replace: true });
                }
                setIsInitializing(false);
                return;
              } catch (error) {
                // Path doesn't exist or failed to load, fallback to mount root
                console.warn(
                  "Path from URL doesn't exist, falling back to mount root:",
                  error
                );
                navigateToPath(targetMount.path, targetMount);
                setSearchParams(
                  { path: encodeURIComponent(targetMount.path) },
                  { replace: true }
                );
                setIsInitializing(false);
                return;
              }
            }
          } catch (error) {
            console.warn("Failed to decode URL path:", error);
          }
        }

        // Fallback: navigate to first mount root if no URL path or path is invalid
        if (mountList.length > 0) {
          const firstMount = mountList[0];
          navigateToPath(firstMount.path, firstMount);
          setSearchParams(
            { path: encodeURIComponent(firstMount.path) },
            { replace: true }
          );
        }
      } catch (error) {
        console.error("Failed to initialize:", error);
      } finally {
        setIsInitializing(false);
      }
    };

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run on mount

  useEffect(() => {
    if (!virtualCollectionId) {
      if (activeCollectionId) {
        setActiveCollection(null);
      }
      return;
    }

    setActiveCollection(virtualCollectionId);
    loadCollectionItems(virtualCollectionId).catch((error) => {
      console.error("Failed to load virtual folder items:", error);
      toast.error("Unable to load virtual folder");
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete("virtual");
      setSearchParams(nextParams, { replace: true });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [virtualCollectionId]);

  // Find mount for path if not set (when navigating from other components)
  useEffect(() => {
    if (!isInitializing && currentPath && mounts.length > 0 && !currentMount) {
      const foundMount = findMountForPath(currentPath, mounts);
      if (foundMount) {
        setCurrentMount(foundMount);
      }
    }
  }, [currentPath, currentMount, mounts, isInitializing, setCurrentMount]);

  // Load files when currentPath changes
  useEffect(() => {
    if (isVirtualView) {
      return;
    }
    if (currentPath) {
      loadFiles();
      clearSelection();
    }
  }, [currentPath, loadFiles, clearSelection, isVirtualView]);

  useEffect(() => {
    if (isVirtualView) {
      clearSelection();
    }
  }, [isVirtualView, clearSelection]);

  // Update URL query string when currentPath changes (but not during initial load)
  useEffect(() => {
    if (isVirtualView || isInitializing || !currentPath) {
      return;
    }

    const currentUrlPath = searchParams.get("path");
    const encodedPath = encodeURIComponent(currentPath);

    if (currentUrlPath !== encodedPath) {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.set("path", encodedPath);
      setSearchParams(nextParams, { replace: true });
    }
  }, [
    currentPath,
    isInitializing,
    searchParams,
    setSearchParams,
    isVirtualView
  ]);

  // Infinite scroll observer
  useEffect(() => {
    if (isVirtualView) return;
    const trigger = loadMoreTriggerRef.current;
    if (!trigger || !hasMore || isLoading) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoading) {
          loadMore();
        }
      },
      { threshold: 0.1, rootMargin: "100px" }
    );

    observer.observe(trigger);

    return () => {
      observer.disconnect();
    };
  }, [hasMore, isLoading, loadMore, isVirtualView]);

  // Handle drag end to reset state if user cancels drag
  useEffect(() => {
    const handleDragEnd = () => {
      dragDepthRef.current = 0;
      setIsDraggingOver(false);
    };

    window.addEventListener("dragend", handleDragEnd);
    return () => window.removeEventListener("dragend", handleDragEnd);
  }, []);

  // Handle click on empty area to deselect
  const handleBackgroundClick = (e: React.MouseEvent) => {
    if (isDragging()) return;
    if (e.target === e.currentTarget) {
      clearSelection();
    }
  };

  // Handle right click on empty area to show context menu
  const handleBackgroundContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    useUIStore.getState().openContextMenu(e.clientX, e.clientY, "background");
  };

  // Handle drag and drop file upload
  const handleDragEnter = (e: React.DragEvent) => {
    if (isVirtualView) return;
    e.preventDefault();
    e.stopPropagation();

    // Only show drop zone if dragging files from outside
    if (e.dataTransfer.types.includes("Files")) {
      dragDepthRef.current++;
      setIsDraggingOver(true);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (isVirtualView) return;
    e.preventDefault();
    e.stopPropagation();

    // Set the dropEffect to copy
    if (e.dataTransfer.types.includes("Files")) {
      e.dataTransfer.dropEffect = "copy";
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (isVirtualView) return;
    e.preventDefault();
    e.stopPropagation();

    // Track nested drag events with counter
    if (e.dataTransfer.types.includes("Files")) {
      dragDepthRef.current--;
      if (dragDepthRef.current === 0) {
        setIsDraggingOver(false);
      }
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    if (isVirtualView) return;
    e.preventDefault();
    e.stopPropagation();
    dragDepthRef.current = 0;
    setIsDraggingOver(false);

    const { items: uploadItems, isUnsupportedDirectory } =
      await collectUploadItemsFromDataTransfer(e.dataTransfer);

    if (isUnsupportedDirectory) {
      toast.info(
        "Folder drag & drop is not supported in this browser. Use the folder picker or switch to Chrome/Edge."
      );
      return;
    }

    if (uploadItems.length === 0) return;

    await uploadFiles(uploadItems);
  };

  // Render loading state
  if (isInitializing) {
    return <EmptyStates type="loading" />;
  }

  // Render no mounts state
  if (mounts.length === 0) {
    return <EmptyStates type="noMounts" isAdmin={user?.isAdmin} />;
  }

  // Render no path selected state (physical mounts only)
  if (!currentPath && !isVirtualView) {
    return (
      <EmptyStates
        type="noPath"
        mounts={mounts}
        onNavigateToMount={navigateToPath}
      />
    );
  }

  // Render file browser (with error state if applicable)
  return (
    <div
      className="h-full flex flex-col relative"
      onClick={handleBackgroundClick}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}>
      {/* Toolbar */}
      <Toolbar />

      {/* Warning banner for large directories */}
      {showWarning && <WarningBanner message={showWarning} />}

      {/* Error state or File list */}
      {effectiveError ? (
        <EmptyStates
          type="error"
          errorMessage={effectiveError}
          onRefresh={refresh}
        />
      ) : isVirtualView && !hasVirtualItems ? (
        <div className="flex-1 flex items-center justify-center">
          <LoadingSpinner size="lg" />
        </div>
      ) : (
        <FileListContainer
          files={displayedFiles}
          isLoading={displayIsLoading}
          hasMore={displayHasMore}
          viewMode={viewMode}
          containerRef={containerRef}
          loadMoreTriggerRef={loadMoreTriggerRef}
          onContextMenu={handleBackgroundContextMenu}
          onMouseDown={handleMouseDown}
          onCreateFolder={isVirtualView ? () => {} : openCreateFolderDialog}
          searchQuery={searchQuery}
          emptyVariant={isVirtualView ? "virtual" : "default"}
        />
      )}

      {/* Drag and Drop Overlay */}
      {isDraggingOver && (
        <div className="absolute inset-0 bg-accent/10 border-2 border-dashed border-accent z-50 flex items-center justify-center pointer-events-none">
          <div className="bg-surface rounded-lg shadow-elevated p-8 text-center">
            <div className="text-4xl mb-4">
              <FolderUp className="h-10 w-10 text-accent" />
            </div>
            <div className="text-lg font-semibold text-content mb-2">
              Drop files or folders to upload
            </div>
            <div className="text-sm text-content-secondary">
              Items will be uploaded to {currentPath}
            </div>
          </div>
        </div>
      )}

      {/* Selection Box */}
      {selectionBox && <SelectionBox {...selectionBox} />}

      {/* Multi-select Action Bar */}
      <MultiSelectActionBar />

      {/* Dialogs */}
      <CreateFolderDialog />
      <CreateFileDialog />
      <RenameDialog />
      <DeleteDialog />
      <GetInfoDialog />
      <VirtualFolderDialog />

      {/* Context menu */}
      <FileContextMenu />
    </div>
  );
}
