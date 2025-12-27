// src/client/pages/BrowserPage.tsx
import { FolderUp } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  EmptyStates,
  FileListContainer,
  MultiSelectActionBar,
  SelectionBox,
  Toolbar,
  WarningBanner
} from "../components/browserpage";
import { CreateFileDialog } from "../components/dialogs/CreateFileDialog";
import { CreateFolderDialog } from "../components/dialogs/CreateFolderDialog";
import { DeleteDialog } from "../components/dialogs/DeleteDialog";
import { GetInfoDialog } from "../components/dialogs/GetInfoDialog";
import { RenameDialog } from "../components/dialogs/RenameDialog";
import { FileContextMenu } from "../components/files/FileContextMenu";
import { mountsApi, type Mount } from "../lib/api";
import { useFileUpload } from "../lib/useFileUpload";
import { useAuthStore } from "../stores/authStore";
import { useFileStore } from "../stores/fileStore";
import { useSelectionStore } from "../stores/selectionStore";
import { useUIStore } from "../stores/uiStore";

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

  const [mounts, setMounts] = useState<Mount[]>([]);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const dragDepthRef = useRef(0);
  const { uploadFiles } = useFileUpload();

  // Ref for infinite scroll observer
  const loadMoreTriggerRef = useRef<HTMLDivElement>(null);

  // Refs for lasso selection
  const containerRef = useRef<HTMLDivElement>(null);
  const filesRef = useRef(files);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const isDraggingRef = useRef(false);
  const [selectionBox, setSelectionBox] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);

  // Update files ref
  useEffect(() => {
    filesRef.current = files;
  }, [files]);

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

        if (urlPath) {
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
    if (currentPath) {
      loadFiles();
      clearSelection();
    }
  }, [currentPath, loadFiles, clearSelection]);

  // Update URL query string when currentPath changes (but not during initial load)
  useEffect(() => {
    if (!isInitializing && currentPath) {
      const currentUrlPath = searchParams.get("path");
      const encodedPath = encodeURIComponent(currentPath);

      // Only update if URL is different to avoid unnecessary navigation
      if (currentUrlPath !== encodedPath) {
        setSearchParams({ path: encodedPath }, { replace: true });
      }
    }
  }, [currentPath, isInitializing, searchParams, setSearchParams]);

  // Infinite scroll observer
  useEffect(() => {
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
  }, [hasMore, isLoading, loadMore]);

  // Handle lasso selection
  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!dragStartRef.current) return;

      const startX = dragStartRef.current.x;
      const startY = dragStartRef.current.y;
      const currentX = e.clientX;
      const currentY = e.clientY;

      // Minimum drag distance to start selecting
      if (
        !isDraggingRef.current &&
        (Math.abs(currentX - startX) > 5 || Math.abs(currentY - startY) > 5)
      ) {
        isDraggingRef.current = true;
        clearSelection();
      }

      if (isDraggingRef.current) {
        const x = Math.min(startX, currentX);
        const y = Math.min(startY, currentY);
        const width = Math.abs(currentX - startX);
        const height = Math.abs(currentY - startY);

        setSelectionBox({ x, y, width, height });

        if (containerRef.current) {
          const elements = containerRef.current.querySelectorAll("[data-path]");
          const selectedItems: typeof files = [];
          const boxRect = {
            left: x,
            right: x + width,
            top: y,
            bottom: y + height
          };

          elements.forEach((el) => {
            const rect = el.getBoundingClientRect();
            // Check intersection
            if (
              rect.left < boxRect.right &&
              rect.right > boxRect.left &&
              rect.top < boxRect.bottom &&
              rect.bottom > boxRect.top
            ) {
              const path = el.getAttribute("data-path");
              const item = filesRef.current.find((f) => f.path === path);
              if (item) selectedItems.push(item);
            }
          });

          selectAll(selectedItems);
        }
      }
    },
    [clearSelection, selectAll]
  );

  const handleMouseUp = useCallback(() => {
    // If we finished a click without dragging, clear selection
    if (!isDraggingRef.current && dragStartRef.current) {
      clearSelection();
    }

    dragStartRef.current = null;
    setSelectionBox(null);
    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseup", handleMouseUp);

    setTimeout(() => {
      isDraggingRef.current = false;
    }, 0);
  }, [handleMouseMove, clearSelection]);

  const handleMouseDown = (e: React.MouseEvent) => {
    // Ignore if clicking on a file item or if right button or scrollbar
    // Check if target is the container or a direct child that isn't a file item
    if (e.button !== 0) return;

    // Check if we clicked on a file item
    if ((e.target as Element).closest("[data-path]")) return;

    dragStartRef.current = { x: e.clientX, y: e.clientY };
    isDraggingRef.current = false;

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  // Handle Escape key to clear selection
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        clearSelection();
        setSelectionBox(null);
        dragStartRef.current = null;
        isDraggingRef.current = false;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [clearSelection]);

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
    if (isDraggingRef.current) return;
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
    e.preventDefault();
    e.stopPropagation();

    // Only show drop zone if dragging files from outside
    if (e.dataTransfer.types.includes("Files")) {
      dragDepthRef.current++;
      setIsDraggingOver(true);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Set the dropEffect to copy
    if (e.dataTransfer.types.includes("Files")) {
      e.dataTransfer.dropEffect = "copy";
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
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
    e.preventDefault();
    e.stopPropagation();
    dragDepthRef.current = 0;
    setIsDraggingOver(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;

    await uploadFiles(files);
  };

  // Render loading state
  if (isInitializing) {
    return <EmptyStates type="loading" />;
  }

  // Render no mounts state
  if (mounts.length === 0) {
    return <EmptyStates type="noMounts" isAdmin={user?.isAdmin} />;
  }

  // Render no path selected state
  if (!currentPath) {
    return (
      <EmptyStates
        type="noPath"
        mounts={mounts}
        onNavigateToMount={navigateToPath}
      />
    );
  }

  // Render error state
  if (error) {
    return (
      <EmptyStates type="error" errorMessage={error} onRefresh={refresh} />
    );
  }

  // Render file browser
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
      {warning && <WarningBanner message={warning} />}

      {/* File list */}
      <FileListContainer
        files={files}
        isLoading={isLoading}
        hasMore={hasMore}
        viewMode={viewMode}
        containerRef={containerRef}
        loadMoreTriggerRef={loadMoreTriggerRef}
        onContextMenu={handleBackgroundContextMenu}
        onMouseDown={handleMouseDown}
        onCreateFolder={openCreateFolderDialog}
        searchQuery={searchQuery}
      />

      {/* Drag and Drop Overlay */}
      {isDraggingOver && (
        <div className="absolute inset-0 bg-accent/10 border-2 border-dashed border-accent z-50 flex items-center justify-center pointer-events-none">
          <div className="bg-surface rounded-lg shadow-elevated p-8 text-center">
            <div className="text-4xl mb-4">
              <FolderUp className="h-10 w-10 text-accent" />
            </div>
            <div className="text-lg font-semibold text-content mb-2">
              Drop files to upload
            </div>
            <div className="text-sm text-content-secondary">
              Files will be uploaded to {currentPath}
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

      {/* Context menu */}
      <FileContextMenu />
    </div>
  );
}
