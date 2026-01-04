import {
  Clipboard,
  Copy,
  Download,
  FilePlus,
  FileText,
  Folder,
  FolderOpen,
  FolderPlus,
  Image,
  Info,
  Pencil,
  Plus,
  Scissors,
  Star,
  Trash2,
  Video,
  X
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useSearchParams } from "react-router-dom";
import { filesApi } from "../../lib/api";
import { getFileName, isImage, isTextFile, isVideo } from "../../lib/utils";
import { useBookmarkStore } from "../../stores/bookmarkStore";
import { useFileStore } from "../../stores/fileStore";
import { useSelectionStore } from "../../stores/selectionStore";
import { useUIStore } from "../../stores/uiStore";
import { useVirtualFolderStore } from "../../stores/virtualFolderStore";
import { toast } from "../common/Toast";

export function FileContextMenu() {
  const menuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [adjustedPosition, setAdjustedPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const {
    contextMenu,
    closeContextMenu,
    openRenameDialog,
    openDeleteDialog,
    openCreateFolderDialog,
    openCreateFileDialog,
    openGetInfoDialog,
    openVirtualFolderDialog
  } = useUIStore();
  const {
    getSelectedPaths,
    copyToClipboard,
    cutToClipboard,
    hasClipboard,
    getClipboardInfo,
    clearClipboard
  } = useSelectionStore();
  const { files, currentPath, navigateToPath, refresh } = useFileStore();
  const { addBookmark } = useBookmarkStore();
  const { collections, addItemsToCollection, removeItemByPath } =
    useVirtualFolderStore();

  // Reset adjusted position when context menu opens
  useEffect(() => {
    if (contextMenu.isOpen) {
      setAdjustedPosition(null);
    }
  }, [contextMenu.isOpen, contextMenu.x, contextMenu.y]);

  // Adjust position if menu goes off-screen
  useEffect(() => {
    if (contextMenu.isOpen && menuRef.current && !adjustedPosition) {
      const rect = menuRef.current.getBoundingClientRect();
      const padding = 10;

      let newX = contextMenu.x;
      let newY = contextMenu.y;
      let needsAdjustment = false;

      // Check if menu goes off bottom edge - if so, position above cursor
      if (newY + rect.height > window.innerHeight - padding) {
        newY = contextMenu.y - rect.height;
        needsAdjustment = true;
      }

      // Check if menu goes off right edge
      if (newX + rect.width > window.innerWidth - padding) {
        newX = window.innerWidth - rect.width - padding;
        needsAdjustment = true;
      }

      // Check if menu goes off left edge
      if (newX < padding) {
        newX = padding;
        needsAdjustment = true;
      }

      // Check if menu goes off top edge
      if (newY < padding) {
        newY = padding;
        needsAdjustment = true;
      }

      if (needsAdjustment) {
        setAdjustedPosition({ x: newX, y: newY });
      }
    }
  }, [contextMenu.isOpen, contextMenu.x, contextMenu.y, adjustedPosition]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        closeContextMenu();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeContextMenu();
      }
    };

    if (contextMenu.isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleEscape);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [contextMenu.isOpen, closeContextMenu]);

  const handleOpen = useCallback(() => {
    if (contextMenu.targetPath) {
      navigateToPath(contextMenu.targetPath);
    }
    closeContextMenu();
  }, [contextMenu.targetPath, navigateToPath, closeContextMenu]);

  const handleOpenInEditor = useCallback(() => {
    if (contextMenu.targetPath) {
      navigate(`/editor?path=${encodeURIComponent(contextMenu.targetPath)}`);
    }
    closeContextMenu();
  }, [contextMenu.targetPath, navigate, closeContextMenu]);

  const handleOpenInPreview = useCallback(() => {
    if (contextMenu.targetPath) {
      navigate(`/preview?path=${encodeURIComponent(contextMenu.targetPath)}`);
    }
    closeContextMenu();
  }, [contextMenu.targetPath, navigate, closeContextMenu]);

  const handleOpenInVideoPlayer = useCallback(() => {
    if (contextMenu.targetPath) {
      navigate(`/video?path=${encodeURIComponent(contextMenu.targetPath)}`);
    }
    closeContextMenu();
  }, [contextMenu.targetPath, navigate, closeContextMenu]);

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

    closeContextMenu();
  }, [getSelectedPaths, closeContextMenu]);

  const handleCopy = useCallback(() => {
    copyToClipboard(currentPath);
    toast.info("Copied to clipboard");
    closeContextMenu();
  }, [copyToClipboard, currentPath, closeContextMenu]);

  const handleCut = useCallback(() => {
    cutToClipboard(currentPath);
    toast.info("Cut to clipboard");
    closeContextMenu();
  }, [cutToClipboard, currentPath, closeContextMenu]);

  const handlePaste = useCallback(async () => {
    const { paths, action, sourcePath } = getClipboardInfo();
    if (!paths.length || !action) return;

    try {
      if (action === "copy") {
        await filesApi.copy(paths, currentPath);
        toast.success("Files copied successfully");
      } else {
        await filesApi.move(paths, currentPath);
        toast.success("Files moved successfully");
        clearClipboard();
      }
      refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Operation failed");
    }
    closeContextMenu();
  }, [
    getClipboardInfo,
    currentPath,
    refresh,
    clearClipboard,
    closeContextMenu
  ]);

  const handleRename = useCallback(() => {
    const paths = getSelectedPaths();
    if (paths.length === 1) {
      const path = paths[0];
      const name = getFileName(path);
      openRenameDialog(path, name);
    }
    closeContextMenu();
  }, [getSelectedPaths, openRenameDialog, closeContextMenu]);

  const handleDelete = useCallback(() => {
    const paths = getSelectedPaths();
    if (paths.length > 0) {
      openDeleteDialog(paths);
    }
    closeContextMenu();
  }, [getSelectedPaths, openDeleteDialog, closeContextMenu]);

  const handleAddBookmark = useCallback(async () => {
    const paths = getSelectedPaths();
    if (paths.length === 1) {
      const path = paths[0];
      const name = getFileName(path);
      try {
        await addBookmark(path, name);
        toast.success("Added to bookmarks");
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to add bookmark"
        );
      }
    }
    closeContextMenu();
  }, [getSelectedPaths, addBookmark, closeContextMenu]);

  const handleNewFolder = useCallback(() => {
    openCreateFolderDialog();
    closeContextMenu();
  }, [openCreateFolderDialog, closeContextMenu]);

  const handleNewFile = useCallback(() => {
    openCreateFileDialog();
    closeContextMenu();
  }, [openCreateFileDialog, closeContextMenu]);

  const handleGetInfo = useCallback(() => {
    const paths = getSelectedPaths();
    if (paths.length === 1) {
      openGetInfoDialog(paths[0]);
    } else if (contextMenu.type === "background" && currentPath) {
      openGetInfoDialog(currentPath);
    } else if (paths.length > 1) {
      toast.info("Select a single item to get info");
    }
    closeContextMenu();
  }, [
    getSelectedPaths,
    openGetInfoDialog,
    closeContextMenu,
    contextMenu.type,
    currentPath
  ]);

  const handleAddToVirtualFolder = useCallback(
    async (collectionId: string) => {
      const paths = getSelectedPaths();
      if (!paths.length) return;

      try {
        await addItemsToCollection(
          collectionId,
          paths.map((path) => ({ path }))
        );
        toast.success("Added to virtual folder");
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Failed to add to virtual folder"
        );
      }
      closeContextMenu();
    },
    [getSelectedPaths, addItemsToCollection, closeContextMenu]
  );

  const handleRemoveFromVirtualFolder = useCallback(async () => {
    const currentVirtualId = searchParams.get("virtual");
    if (!currentVirtualId) return;

    const paths = getSelectedPaths();
    if (!paths.length) return;

    try {
      await Promise.all(
        paths.map((path) => removeItemByPath(currentVirtualId, path))
      );
      toast.success("Removed from virtual folder");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to remove from virtual folder"
      );
    }
    closeContextMenu();
  }, [searchParams, getSelectedPaths, removeItemByPath, closeContextMenu]);

  const handleCreateVirtualFolder = useCallback(() => {
    const paths = getSelectedPaths();
    if (!paths.length) return;

    const initialName = paths.length === 1 ? getFileName(paths[0]) || "" : "";

    openVirtualFolderDialog({
      mode: "create",
      initialName,
      pendingPaths: paths
    });
    closeContextMenu();
  }, [getSelectedPaths, openVirtualFolderDialog, closeContextMenu]);

  if (!contextMenu.isOpen) return null;

  const selectedCount = getSelectedPaths().length;
  const isMultiple = selectedCount > 1;
  const isVirtualView = Boolean(searchParams.get("virtual"));
  const canPaste = hasClipboard() && !isVirtualView;

  // Check if the target file is a text file, image file, or video file
  const targetFile = contextMenu.targetPath
    ? files.find((f) => f.path === contextMenu.targetPath)
    : null;
  const isTargetTextFile =
    targetFile && !targetFile.isDirectory
      ? isTextFile(targetFile.mimeType, targetFile.extension, targetFile.name)
      : false;
  const isTargetImageFile =
    targetFile && !targetFile.isDirectory
      ? isImage(targetFile.mimeType)
      : false;
  const isTargetVideoFile =
    targetFile && !targetFile.isDirectory
      ? isVideo(targetFile.mimeType)
      : false;

  // Use adjusted position if available, otherwise use original position
  const x = adjustedPosition?.x ?? contextMenu.x;
  const y = adjustedPosition?.y ?? contextMenu.y;

  return createPortal(
    <div
      key={`${x}-${y}`}
      ref={menuRef}
      className="context-menu"
      style={{ position: "fixed", left: `${x}px`, top: `${y}px` }}>
      {/* File/Folder specific items */}
      {contextMenu.type === "folder" && (
        <button onClick={handleOpen} className="context-menu-item">
          <FolderOpen className="h-4 w-4" />
          Open
        </button>
      )}

      {/* Text file open option */}
      {contextMenu.type === "file" && isTargetTextFile && !isMultiple && (
        <button onClick={handleOpenInEditor} className="context-menu-item">
          <FileText className="h-4 w-4" />
          Open
        </button>
      )}

      {/* Image file open option */}
      {contextMenu.type === "file" && isTargetImageFile && !isMultiple && (
        <button onClick={handleOpenInPreview} className="context-menu-item">
          <Image className="h-4 w-4" />
          Open
        </button>
      )}

      {/* Video file open option */}
      {contextMenu.type === "file" && isTargetVideoFile && !isMultiple && (
        <button onClick={handleOpenInVideoPlayer} className="context-menu-item">
          <Video className="h-4 w-4" />
          Open
        </button>
      )}

      {contextMenu.type !== "background" && (
        <>
          <button onClick={handleDownload} className="context-menu-item">
            <Download className="h-4 w-4" />
            Download{isMultiple ? ` (${selectedCount})` : ""}
          </button>

          <div className="context-menu-separator" />

          <button onClick={handleCopy} className="context-menu-item">
            <Copy className="h-4 w-4" />
            Copy
          </button>

          <button onClick={handleCut} className="context-menu-item">
            <Scissors className="h-4 w-4" />
            Cut
          </button>
        </>
      )}

      {canPaste && (
        <button onClick={handlePaste} className="context-menu-item">
          <Clipboard className="h-4 w-4" />
          Paste
        </button>
      )}

      {contextMenu.type !== "background" && !isMultiple && (
        <>
          <div className="context-menu-separator" />

          <button onClick={handleRename} className="context-menu-item">
            <Pencil className="h-4 w-4" />
            Rename
          </button>

          {contextMenu.type === "folder" && (
            <button onClick={handleAddBookmark} className="context-menu-item">
              <Star className="h-4 w-4" />
              Add to Bookmarks
            </button>
          )}

          <button onClick={handleGetInfo} className="context-menu-item">
            <Info className="h-4 w-4" />
            Get Info
          </button>
        </>
      )}

      {/* Background context menu items */}
      {contextMenu.type === "background" && !isVirtualView && (
        <>
          <button onClick={handleNewFolder} className="context-menu-item">
            <FolderPlus className="h-4 w-4" />
            New Folder
          </button>

          <button onClick={handleNewFile} className="context-menu-item">
            <FilePlus className="h-4 w-4" />
            New File
          </button>

          <div className="context-menu-separator" />

          <button onClick={handleGetInfo} className="context-menu-item">
            <Info className="h-4 w-4" />
            Get Info
          </button>
        </>
      )}
      {contextMenu.type === "background" && isVirtualView && (
        <button onClick={handleGetInfo} className="context-menu-item">
          <Info className="h-4 w-4" />
          Get Info
        </button>
      )}

      {contextMenu.type !== "background" && (
        <>
          <div className="context-menu-separator" />
          {collections.length > 0 && (
            <>
              <div className="px-3 py-1 text-[10px] uppercase text-content-tertiary">
                Virtual Folders
              </div>
              {collections.slice(0, 6).map((collection) => (
                <button
                  key={collection.id}
                  onClick={() => handleAddToVirtualFolder(collection.id)}
                  className="context-menu-item">
                  <Folder className="h-4 w-4" />
                  Add to {collection.name}
                </button>
              ))}
            </>
          )}

          <button
            onClick={handleCreateVirtualFolder}
            className="context-menu-item">
            <Plus className="h-4 w-4" />
            Add to new virtual folder
          </button>

          {searchParams.get("virtual") && (
            <button
              onClick={handleRemoveFromVirtualFolder}
              className="context-menu-item">
              <X className="h-4 w-4" />
              Remove from this virtual folder
            </button>
          )}
        </>
      )}

      {/* Delete option */}
      {contextMenu.type !== "background" && (
        <>
          <div className="context-menu-separator" />
          <button onClick={handleDelete} className="context-menu-item danger">
            <Trash2 className="h-4 w-4" />
            Delete{isMultiple ? ` (${selectedCount})` : ""}
          </button>
        </>
      )}
    </div>,
    document.body
  );
}
