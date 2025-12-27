// src/client/components/files/FileCardView.tsx
import { File, FileText, Folder, Play } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { FileItem } from "../../lib/api";
import { filesApi } from "../../lib/api";
import {
  formatFileSize,
  formatRelativeTime,
  isImage,
  isModifierPressed,
  isPdf,
  isTextFile,
  isVideo
} from "../../lib/utils";
import { useFileStore } from "../../stores/fileStore";
import { useSelectionStore } from "../../stores/selectionStore";
import { useUIStore } from "../../stores/uiStore";

interface FileCardViewProps {
  files: FileItem[];
}

export function FileCardView({ files }: FileCardViewProps) {
  const navigate = useNavigate();
  const { navigateToPath } = useFileStore();
  const { select, toggleSelect, rangeSelect, isSelected } = useSelectionStore();
  const { openContextMenu } = useUIStore();
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile device
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768 || "ontouchstart" in window);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const handleClick = useCallback(
    (e: React.MouseEvent, item: FileItem) => {
      e.stopPropagation();

      if (e.shiftKey) {
        rangeSelect(files, item);
      } else if (isModifierPressed(e as unknown as KeyboardEvent)) {
        toggleSelect(item);
      } else {
        select(item);
      }
    },
    [files, select, toggleSelect, rangeSelect]
  );

  const handleDoubleClick = useCallback(
    (item: FileItem) => {
      if (item.isDirectory) {
        navigateToPath(item.path);
      } else if (isTextFile(item.mimeType, item.extension, item.name)) {
        navigate(`/editor?path=${encodeURIComponent(item.path)}`);
      } else if (isImage(item.mimeType)) {
        navigate(`/preview?path=${encodeURIComponent(item.path)}`);
      } else if (isVideo(item.mimeType)) {
        navigate(`/video?path=${encodeURIComponent(item.path)}`);
      } else {
        window.open(filesApi.download(item.path), "_blank");
      }
    },
    [navigateToPath, navigate]
  );

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, item: FileItem) => {
      e.preventDefault();
      e.stopPropagation();

      if (!isSelected(item.path)) {
        select(item);
      }

      openContextMenu(
        e.clientX,
        e.clientY,
        item.isDirectory ? "folder" : "file",
        item.path
      );
    },
    [isSelected, select, openContextMenu]
  );

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  }, []);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent, item: FileItem) => {
      if (!touchStartRef.current) return;

      const touch = e.changedTouches[0];
      const deltaX = Math.abs(touch.clientX - touchStartRef.current.x);
      const deltaY = Math.abs(touch.clientY - touchStartRef.current.y);

      // If movement is minimal (tap, not swipe), trigger double-click behavior
      if (deltaX < 10 && deltaY < 10) {
        e.preventDefault();
        handleDoubleClick(item);
      }

      touchStartRef.current = null;
    },
    [handleDoubleClick]
  );

  const handleCheckboxChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>, item: FileItem) => {
      e.stopPropagation();
      toggleSelect(item);
    },
    [toggleSelect]
  );

  const handleCheckboxClick = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      e.stopPropagation();
    },
    []
  );

  const handleCheckboxTouchStart = useCallback((e: React.TouchEvent) => {
    e.stopPropagation();
  }, []);

  const handleCheckboxTouchEnd = useCallback((e: React.TouchEvent) => {
    e.stopPropagation();
  }, []);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 min-h-0">
      {files.map((item) => {
        const selected = isSelected(item.path);
        const showThumbnail = isImage(item.mimeType) || isPdf(item.mimeType);
        const showVideoOverlay = isVideo(item.mimeType);

        return (
          <div
            key={item.path}
            data-path={item.path}
            onClick={(e) => handleClick(e, item)}
            onDoubleClick={() => handleDoubleClick(item)}
            onContextMenu={(e) => handleContextMenu(e, item)}
            onTouchStart={handleTouchStart}
            onTouchEnd={(e) => handleTouchEnd(e, item)}
            className={`
              group relative flex flex-col rounded-lg border overflow-hidden
              cursor-pointer transition-all select-none
              ${
                selected
                  ? "border-accent bg-primary-50 dark:bg-primary-950 ring-2 ring-accent"
                  : "border-border bg-surface hover:border-border-secondary hover:shadow-subtle"
              }
            `}>
            {/* Checkbox for mobile */}
            {isMobile && (
              <div
                className="absolute top-4 left-4 z-10 p-1 rounded-md"
                onClick={handleCheckboxClick}
                onTouchStart={handleCheckboxTouchStart}
                onTouchEnd={handleCheckboxTouchEnd}>
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={(e) => handleCheckboxChange(e, item)}
                  className="w-5 h-5 rounded border-2 border-border text-accent focus:ring-2 focus:ring-accent cursor-pointer m-0.5"
                />
              </div>
            )}

            {/* Thumbnail / Icon area */}
            <div className="h-32 bg-surface-secondary flex items-center justify-center">
              {item.isDirectory ? (
                <Folder className="h-16 w-16 text-accent" />
              ) : showThumbnail ? (
                <CardThumbnail path={item.path} name={item.name} />
              ) : showVideoOverlay ? (
                <div className="relative w-full h-full flex items-center justify-center bg-gray-900">
                  <Play className="h-12 w-12 text-white" />
                </div>
              ) : (
                <File className="h-16 w-16 text-content-tertiary" />
              )}
            </div>

            {/* Info */}
            <div className="p-3">
              <p
                className="font-medium text-content truncate"
                title={item.name}>
                {item.name}
              </p>
              <div className="flex items-center justify-between mt-1 text-xs text-content-tertiary">
                <span>
                  {item.isDirectory ? "Folder" : formatFileSize(item.size)}
                </span>
                <span>{formatRelativeTime(item.modifiedAt)}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Card thumbnail image component
function CardThumbnail({ path, name }: { path: string; name: string }) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  if (error) {
    return <FileText className="h-16 w-16 text-content-tertiary" />;
  }

  return (
    <div className="relative w-full h-full">
      {!loaded && <div className="absolute inset-0 skeleton" />}
      <img
        src={filesApi.thumbnail(path)}
        alt={name}
        className={`w-full h-full object-cover transition-opacity ${
          loaded ? "opacity-100" : "opacity-0"
        }`}
        onLoad={() => setLoaded(true)}
        onError={() => setError(true)}
        loading="lazy"
      />
    </div>
  );
}
