// src/client/components/files/FileListView.tsx
import {
  File,
  FileArchive,
  FileAudio,
  FileCode,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileVideo,
  Folder
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { FileItem } from "../../lib/api";
import {
  formatDate,
  formatFileSize,
  getFileIconType,
  isModifierPressed
} from "../../lib/utils";
import { useFileStore } from "../../stores/fileStore";
import { useSelectionStore } from "../../stores/selectionStore";
import { useUIStore } from "../../stores/uiStore";

interface FileListViewProps {
  files: FileItem[];
}

export function FileListView({ files }: FileListViewProps) {
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
      } else {
        // TODO: Open file preview or download
        window.open(
          `/api/files/download?path=${encodeURIComponent(item.path)}`,
          "_blank"
        );
      }
    },
    [navigateToPath]
  );

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, item: FileItem) => {
      e.preventDefault();
      e.stopPropagation();

      // If not already selected, select this item
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

  const getIcon = (item: FileItem) => {
    if (item.isDirectory) {
      return <Folder className="h-5 w-5 text-accent" />;
    }

    const iconType = getFileIconType(item.mimeType, item.extension);
    const iconClass = "h-5 w-5 text-content-tertiary";

    switch (iconType) {
      case "image":
        return <FileImage className={iconClass} />;
      case "video":
        return <FileVideo className={iconClass} />;
      case "audio":
        return <FileAudio className={iconClass} />;
      case "archive":
        return <FileArchive className={iconClass} />;
      case "code":
        return <FileCode className={iconClass} />;
      case "text":
        return <FileText className={iconClass} />;
      case "excel":
        return <FileSpreadsheet className={iconClass} />;
      default:
        return <File className={iconClass} />;
    }
  };

  return (
    <div className="w-full min-h-0">
      {/* Header */}
      <div className="flex items-center gap-4 px-3 py-2 border-b border-border text-xs font-medium text-content-tertiary uppercase tracking-wider">
        {isMobile && <div className="w-8 flex-shrink-0" />}
        <div className="flex-1 min-w-0">Name</div>
        <div className="w-24 text-right hidden sm:block">Size</div>
        <div className="w-40 text-right hidden md:block">Modified</div>
      </div>

      {/* File list */}
      <div className="divide-y divide-border min-h-0">
        {files.map((item) => {
          const selected = isSelected(item.path);

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
                flex items-center gap-4 px-3 py-2 cursor-pointer
                transition-colors select-none
                ${
                  selected
                    ? "bg-primary-100 dark:bg-primary-900"
                    : "hover:bg-surface-hover"
                }
              `}>
              {/* Checkbox for mobile */}
              {isMobile && (
                <div
                  className="w-8 flex-shrink-0 flex items-center justify-center"
                  onClick={handleCheckboxClick}
                  onTouchStart={handleCheckboxTouchStart}
                  onTouchEnd={handleCheckboxTouchEnd}>
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={(e) => handleCheckboxChange(e, item)}
                    className="w-5 h-5 rounded border-2 border-border text-accent focus:ring-2 focus:ring-accent cursor-pointer"
                  />
                </div>
              )}

              {/* Icon and name */}
              <div className="flex items-center gap-3 flex-1 min-w-0">
                {getIcon(item)}
                <span className="truncate text-sm text-content">
                  {item.name}
                </span>
              </div>

              {/* Size */}
              <div className="w-24 text-right text-sm text-content-secondary hidden sm:block">
                {item.isDirectory ? "—" : formatFileSize(item.size)}
              </div>

              {/* Modified date */}
              <div className="w-40 text-right text-sm text-content-secondary hidden md:block">
                {formatDate(item.modifiedAt)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
