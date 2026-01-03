import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Download,
  Loader2,
  Maximize2,
  Minimize2,
  X,
  ZoomIn,
  ZoomOut
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "../components/common/Button";
import type { FileItem } from "../lib/api";
import { filesApi } from "../lib/api";
import { formatFileSize, isImage } from "../lib/utils";
import { useFileStore } from "../stores/fileStore";

type ZoomMode = "fit" | "actual" | "custom";

type NeighborState = {
  items: FileItem[];
  hasPrevious: boolean;
  hasNext: boolean;
  previousPath?: string;
  nextPath?: string;
};

const NEIGHBOR_BEFORE = 25;
const NEIGHBOR_AFTER = 25;

export default function ImagePreviewPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const path = searchParams.get("path");
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const {
    files,
    hasMore,
    loadMore,
    isLoading: isLoadingFiles
  } = useFileStore();

  const [imageInfo, setImageInfo] = useState<{
    width: number;
    height: number;
    size: number;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState(100);
  const [zoomMode, setZoomMode] = useState<ZoomMode>("fit");
  const [pendingNavigation, setPendingNavigation] = useState(false);
  const [neighborState, setNeighborState] = useState<NeighborState>({
    items: [],
    hasPrevious: false,
    hasNext: false,
    previousPath: undefined,
    nextPath: undefined
  });

  // Get list of image files in current directory
  const imageFiles = useMemo(() => {
    return files.filter((f) => !f.isDirectory && isImage(f.mimeType));
  }, [files]);

  const neighborImages = neighborState.items;
  const activeImages = neighborImages.length > 0 ? neighborImages : imageFiles;

  // Find current image index
  const currentIndex = useMemo(() => {
    return activeImages.findIndex((f) => f.path === path);
  }, [activeImages, path]);

  const usingNeighbors = neighborImages.length > 0 && currentIndex !== -1;

  const hasPrevious = usingNeighbors
    ? currentIndex > 0 || Boolean(neighborState.previousPath)
    : currentIndex > 0;

  // Check if there's a next image available (neighbors or fallback store)
  const hasNext = usingNeighbors
    ? (currentIndex !== -1 && currentIndex < activeImages.length - 1) ||
      Boolean(neighborState.nextPath)
    : currentIndex < imageFiles.length - 1 ||
      (currentIndex === imageFiles.length - 1 && hasMore);

  // Get current file info
  const currentFile = useMemo(() => {
    return activeImages[currentIndex];
  }, [activeImages, currentIndex]);

  // Simple image URL - browser handles auth cookies automatically
  const imageUrl = path ? filesApi.download(path, true) : "";

  // Navigate to next image after loading more files (fallback when neighbor data is unavailable)
  useEffect(() => {
    if (
      neighborImages.length === 0 &&
      pendingNavigation &&
      !isLoadingFiles &&
      imageFiles.length > 0
    ) {
      const nextImageIndex = currentIndex + 1;
      if (nextImageIndex < imageFiles.length) {
        const nextFile = imageFiles[nextImageIndex];
        setSearchParams({ path: nextFile.path });
      }
      setPendingNavigation(false);
    }
  }, [
    neighborImages.length,
    pendingNavigation,
    isLoadingFiles,
    imageFiles,
    currentIndex,
    setSearchParams
  ]);

  const loadNeighbors = useCallback(async (targetPath: string | null) => {
    if (!targetPath) {
      setNeighborState({
        items: [],
        hasPrevious: false,
        hasNext: false,
        previousPath: undefined,
        nextPath: undefined
      });
      return;
    }

    try {
      const response = await filesApi.neighbors({
        path: targetPath,
        before: NEIGHBOR_BEFORE,
        after: NEIGHBOR_AFTER,
        mediaType: "image"
      });
      setNeighborState({
        items: response.items,
        hasPrevious: response.hasPrevious,
        hasNext: response.hasNext,
        previousPath: response.previousPath,
        nextPath: response.nextPath
      });
    } catch (err) {
      console.error("Failed to load image neighbors", err);
      setNeighborState({
        items: [],
        hasPrevious: false,
        hasNext: false,
        previousPath: undefined,
        nextPath: undefined
      });
    }
  }, []);

  useEffect(() => {
    loadNeighbors(path);
  }, [path, loadNeighbors]);

  // Load image metadata
  useEffect(() => {
    if (!path) {
      setError("No file path provided");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    const img = new Image();
    img.onload = () => {
      setImageInfo({
        width: img.naturalWidth,
        height: img.naturalHeight,
        size: currentFile?.size || 0
      });
      setIsLoading(false);
    };
    img.onerror = () => {
      setError("Failed to load image");
      setIsLoading(false);
    };
    img.src = imageUrl;
  }, [path, imageUrl, currentFile]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isLoading || error) return;

      switch (e.key) {
        case "Escape":
          handleClose();
          break;
        case "ArrowLeft":
          if (hasPrevious) navigateToPrevious();
          break;
        case "ArrowRight":
          if (hasNext) navigateToNext();
          break;
        case "+":
        case "=":
          handleZoomIn();
          break;
        case "-":
        case "_":
          handleZoomOut();
          break;
        case "0":
          handleFitToScreen();
          break;
        case "1":
          handleActualSize();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, error, hasPrevious, hasNext]);

  const navigateToPrevious = useCallback(() => {
    if (!path) return;

    if (currentIndex > 0 && activeImages[currentIndex - 1]) {
      const prevFile = activeImages[currentIndex - 1];
      setSearchParams({ path: prevFile.path });
      return;
    }

    if (usingNeighbors && neighborState.previousPath) {
      setSearchParams({ path: neighborState.previousPath });
    }
  }, [
    activeImages,
    currentIndex,
    neighborState.previousPath,
    path,
    setSearchParams,
    usingNeighbors
  ]);

  const navigateToNext = useCallback(async () => {
    if (!path) return;

    if (currentIndex !== -1 && currentIndex < activeImages.length - 1) {
      const nextFile = activeImages[currentIndex + 1];
      setSearchParams({ path: nextFile.path });
      return;
    }

    if (usingNeighbors && neighborState.nextPath) {
      setSearchParams({ path: neighborState.nextPath });
      return;
    }

    if (
      !usingNeighbors &&
      currentIndex === imageFiles.length - 1 &&
      hasMore &&
      !isLoadingFiles
    ) {
      setPendingNavigation(true);
      await loadMore();
    }
  }, [
    activeImages,
    currentIndex,
    neighborState.nextPath,
    usingNeighbors,
    path,
    setSearchParams,
    imageFiles.length,
    hasMore,
    isLoadingFiles,
    loadMore
  ]);

  const handleZoomIn = useCallback(() => {
    setZoomMode("custom");
    setZoomLevel((prev) => {
      const newZoom = Math.min(prev + 25, 400);
      return newZoom;
    });
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoomMode("custom");
    setZoomLevel((prev) => {
      const newZoom = Math.max(prev - 25, 25);
      return newZoom;
    });
  }, []);

  const clampZoom = useCallback((value: number) => {
    return Math.min(Math.max(value, 25), 400);
  }, []);

  const handleFitToScreen = useCallback(() => {
    setZoomMode("fit");
    setZoomLevel(100);
  }, []);

  const handleActualSize = useCallback(() => {
    setZoomMode("actual");
    setZoomLevel(100);
  }, []);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleWheel = (event: WheelEvent) => {
      if (!(event.ctrlKey || event.metaKey)) {
        return;
      }

      event.preventDefault();
      setZoomMode("custom");
      const delta = event.deltaY > 0 ? -15 : 15;
      setZoomLevel((prev) => clampZoom(prev + delta));
    };

    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => container.removeEventListener("wheel", handleWheel);
  }, [clampZoom, isLoading, error, path]);

  const handleDownload = () => {
    if (path) {
      window.open(filesApi.download(path, false), "_blank");
    }
  };

  const handleClose = () => {
    if (path) {
      // Navigate to the folder containing this image
      const folderPath = path.substring(0, path.lastIndexOf("/"));
      navigate(`/?path=${encodeURIComponent(folderPath)}`);
    } else {
      navigate("/");
    }
  };

  return (
    <div className="flex flex-col h-full bg-surface-base">
      {/* Top Toolbar - Match browser toolbar height */}
      <header className="flex items-center justify-between gap-4 px-4 py-2 border-b border-border bg-surface-secondary">
        {/* Left: Back button */}
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          <span className="hidden sm:inline">Back</span>
        </Button>

        {/* Center: File info */}
        <div className="flex items-center gap-2 flex-1 min-w-0 justify-center">
          <h1 className="text-sm font-medium text-content truncate max-w-full">
            {path ? path.split("/").pop() : "Image Preview"}
          </h1>
          {imageInfo && !isLoading && !error && (
            <>
              <span className="text-content-muted hidden sm:inline">•</span>
              <span className="text-xs text-content-muted whitespace-nowrap hidden sm:inline">
                {imageInfo.width} × {imageInfo.height}
              </span>
              <span className="text-content-muted hidden md:inline">•</span>
              <span className="text-xs text-content-muted whitespace-nowrap hidden md:inline">
                {formatFileSize(imageInfo.size)}
              </span>
              {imageFiles.length > 1 && (
                <>
                  <span className="text-content-muted hidden lg:inline">•</span>
                  <span className="text-xs text-content-muted whitespace-nowrap hidden lg:inline">
                    {currentIndex + 1} / {imageFiles.length} locally loaded
                  </span>
                </>
              )}
            </>
          )}
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDownload}
            disabled={isLoading || !!error}
            title="Download">
            <Download className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClose}
            title="Close (Esc)">
            <X className="w-4 h-4" />
          </Button>
        </div>
      </header>

      {/* Main Image Area */}
      <div className="flex-1 relative bg-surface-base overflow-hidden">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-full">
            <Loader2 className="h-8 w-8 animate-spin text-accent mb-4" />
            <p className="text-content-secondary text-sm">Loading image...</p>
          </div>
        ) : error || !path ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <h2 className="text-xl font-bold text-error mb-2">Error</h2>
            <p className="text-content-muted mb-4">
              {error || "No file path provided"}
            </p>
          </div>
        ) : (
          <>
            {/* Image Container */}
            <div
              ref={scrollContainerRef}
              className="absolute inset-0 overflow-auto overscroll-contain">
              <div className="flex items-center justify-center min-h-full min-w-full p-4">
                <img
                  src={imageUrl}
                  alt={path.split("/").pop()}
                  className={`transition-all duration-200 ${
                    zoomMode === "fit"
                      ? "max-w-full max-h-full object-contain"
                      : zoomMode === "actual"
                      ? "max-w-none"
                      : "max-w-none"
                  }`}
                  style={
                    zoomMode === "custom"
                      ? {
                          transform: `scale(${zoomLevel / 100})`,
                          transformOrigin: "center"
                        }
                      : undefined
                  }
                />
              </div>
            </div>

            {/* Navigation Arrows */}
            {(hasPrevious || hasNext) && (
              <>
                {hasPrevious && (
                  <button
                    onClick={navigateToPrevious}
                    className="absolute left-4 top-1/2 -translate-y-1/2 bg-surface-secondary/70 hover:bg-surface-secondary/90 backdrop-blur-sm border border-border/50 rounded-lg p-3 shadow-lg transition-all hover:scale-110"
                    title="Previous (←)">
                    <ChevronLeft className="w-6 h-6 text-content" />
                  </button>
                )}
                {hasNext && (
                  <button
                    onClick={navigateToNext}
                    disabled={pendingNavigation || isLoadingFiles}
                    className="absolute right-4 top-1/2 -translate-y-1/2 bg-surface-secondary/70 hover:bg-surface-secondary/90 backdrop-blur-sm border border-border/50 rounded-lg p-3 shadow-lg transition-all hover:scale-110 disabled:opacity-50 disabled:cursor-wait"
                    title="Next (→)">
                    {pendingNavigation || isLoadingFiles ? (
                      <Loader2 className="w-6 h-6 text-content animate-spin" />
                    ) : (
                      <ChevronRight className="w-6 h-6 text-content" />
                    )}
                  </button>
                )}
              </>
            )}

            {/* Floating Zoom Controls */}
            <div className="absolute bottom-4 right-4 bg-surface-secondary/70 backdrop-blur-sm border border-border/50 rounded-lg shadow-lg">
              <div className="flex flex-col gap-1 p-2 relative">
                <div className="absolute -top-8 right-1">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-medium tracking-wide border border-border/60 text-content shadow-sm">
                    {zoomMode === "custom"
                      ? `${Math.round(zoomLevel)}%`
                      : "FIT"}
                  </span>
                </div>
                {/* Zoom In */}
                <button
                  onClick={handleZoomIn}
                  disabled={zoomMode === "custom" && zoomLevel >= 400}
                  className="p-2 hover:bg-surface-hover/50 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  title="Zoom In (+)">
                  <ZoomIn className="w-4 h-4 text-content" />
                </button>

                {/* Zoom Level / Fit Toggle */}
                <button
                  onClick={
                    zoomMode === "fit" ? handleActualSize : handleFitToScreen
                  }
                  className="p-2 hover:bg-surface-hover/50 rounded transition-colors"
                  title={
                    zoomMode === "fit" ? "Actual Size (1)" : "Fit to Screen (0)"
                  }>
                  {zoomMode === "fit" ? (
                    <Maximize2 className="w-4 h-4 text-content" />
                  ) : (
                    <Minimize2 className="w-4 h-4 text-content" />
                  )}
                </button>

                {/* Zoom Out */}
                <button
                  onClick={handleZoomOut}
                  disabled={zoomMode === "custom" && zoomLevel <= 25}
                  className="p-2 hover:bg-surface-hover/50 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  title="Zoom Out (-)">
                  <ZoomOut className="w-4 h-4 text-content" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
