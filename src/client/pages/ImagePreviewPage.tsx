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
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "../components/common/Button";
import { filesApi } from "../lib/api";
import { formatFileSize, isImage } from "../lib/utils";
import { useFileStore } from "../stores/fileStore";

type ZoomMode = "fit" | "actual" | "custom";

export default function ImagePreviewPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const path = searchParams.get("path");

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

  // Get list of image files in current directory
  const imageFiles = useMemo(() => {
    return files.filter((f) => !f.isDirectory && isImage(f.mimeType));
  }, [files]);

  // Find current image index
  const currentIndex = useMemo(() => {
    return imageFiles.findIndex((f) => f.path === path);
  }, [imageFiles, path]);

  const hasPrevious = currentIndex > 0;
  // Check if there's a next image locally OR if there might be more on the server
  const hasNext =
    currentIndex < imageFiles.length - 1 ||
    (currentIndex === imageFiles.length - 1 && hasMore);

  // Get current file info
  const currentFile = useMemo(() => {
    return imageFiles[currentIndex];
  }, [imageFiles, currentIndex]);

  // Simple image URL - browser handles auth cookies automatically
  const imageUrl = path ? filesApi.download(path, true) : "";

  // Navigate to next image after loading more files
  useEffect(() => {
    if (pendingNavigation && !isLoadingFiles && imageFiles.length > 0) {
      // Find the next image file after the current one
      const nextImageIndex = currentIndex + 1;
      if (nextImageIndex < imageFiles.length) {
        const nextFile = imageFiles[nextImageIndex];
        setSearchParams({ path: nextFile.path });
      }
      setPendingNavigation(false);
    }
  }, [
    pendingNavigation,
    isLoadingFiles,
    imageFiles,
    currentIndex,
    setSearchParams
  ]);

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
    if (hasPrevious) {
      const prevFile = imageFiles[currentIndex - 1];
      setSearchParams({ path: prevFile.path });
    }
  }, [hasPrevious, imageFiles, currentIndex, setSearchParams]);

  const navigateToNext = useCallback(async () => {
    // If there's a next image locally loaded, navigate to it
    if (currentIndex < imageFiles.length - 1) {
      const nextFile = imageFiles[currentIndex + 1];
      setSearchParams({ path: nextFile.path });
    }
    // If we're at the last locally loaded image but there are more on server
    else if (
      currentIndex === imageFiles.length - 1 &&
      hasMore &&
      !isLoadingFiles
    ) {
      // Set flag to navigate after loading
      setPendingNavigation(true);
      // Load more files from server
      await loadMore();
    }
  }, [
    currentIndex,
    imageFiles,
    hasMore,
    isLoadingFiles,
    loadMore,
    setSearchParams
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

  const handleFitToScreen = useCallback(() => {
    setZoomMode("fit");
    setZoomLevel(100);
  }, []);

  const handleActualSize = useCallback(() => {
    setZoomMode("actual");
    setZoomLevel(100);
  }, []);

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
      <div className="flex-1 relative overflow-hidden bg-surface-base">
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
            <div className="flex items-center justify-center h-full w-full p-4">
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

            {/* Navigation Arrows */}
            {imageFiles.length > 1 && (
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
              <div className="flex flex-col gap-1 p-2">
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

                {/* Zoom Percentage (only show in custom mode) */}
                {zoomMode === "custom" && (
                  <div className="text-xs text-center text-content-muted py-1 px-2 border-t border-border/50">
                    {zoomLevel}%
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
