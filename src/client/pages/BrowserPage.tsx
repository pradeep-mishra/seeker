// src/client/pages/BrowserPage.tsx
import { useCallback, useEffect, useRef, useState } from "react";
import {
  EmptyStates,
  FileListContainer,
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
import { useAuthStore } from "../stores/authStore";
import { useFileStore } from "../stores/fileStore";
import { useSelectionStore } from "../stores/selectionStore";
import { useUIStore } from "../stores/uiStore";

export default function BrowserPage() {
  //const navigate = useNavigate();
  const { user } = useAuthStore();
  const {
    currentPath,
    files,
    isLoading,
    error,
    warning,
    loadFiles,
    loadMore,
    hasMore,
    navigateToPath,
    refresh
  } = useFileStore();
  const { viewMode, loadSettings, dialogs, openCreateFolderDialog } =
    useUIStore();
  const { clearSelection, selectAll, selectedPaths } = useSelectionStore();

  const [mounts, setMounts] = useState<Mount[]>([]);
  const [isInitializing, setIsInitializing] = useState(true);

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

        // If no current path and mounts exist, navigate to first mount
        if (!currentPath && mountList.length > 0) {
          navigateToPath(mountList[0].path, mountList[0]);
        }
      } catch (error) {
        console.error("Failed to initialize:", error);
      } finally {
        setIsInitializing(false);
      }
    };

    init();
  }, []);

  // Load files when currentPath changes
  useEffect(() => {
    if (currentPath) {
      loadFiles();
      clearSelection();
    }
  }, [currentPath]);

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
    <div className="h-full flex flex-col" onClick={handleBackgroundClick}>
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
      />

      {/* Selection Box */}
      {selectionBox && <SelectionBox {...selectionBox} />}

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
