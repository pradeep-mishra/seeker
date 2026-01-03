import {
  AlertCircle,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Download,
  Loader2,
  X
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "../components/common/Button";
import { VideoPlayer } from "../components/video/VideoPlayer";
import type { FileItem } from "../lib/api";
import { filesApi } from "../lib/api";
import { formatFileSize, getVideoSupportTier, isVideo } from "../lib/utils";
import { useFileStore } from "../stores/fileStore";

// Helper functions outside component to prevent recreation
const formatDuration = (seconds: number): string => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  if (h > 0) {
    return `${h}:${m.toString().padStart(2, "0")}:${s
      .toString()
      .padStart(2, "0")}`;
  }
  return `${m}:${s.toString().padStart(2, "0")}`;
};

const getResolutionLabel = (width: number, height: number): string => {
  if (height >= 2160) return "4K";
  if (height >= 1440) return "1440p";
  if (height >= 1080) return "1080p";
  if (height >= 720) return "720p";
  if (height >= 480) return "480p";
  return `${width}×${height}`;
};

export default function VideoPlayerPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const path = searchParams.get("path");

  const {
    files,
    hasMore,
    loadMore,
    isLoading: isLoadingFiles
  } = useFileStore();

  const [videoInfo, setVideoInfo] = useState<{
    duration: number;
    width: number;
    height: number;
    size: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingNavigation, setPendingNavigation] = useState(false);
  const [isWarningDismissed, setIsWarningDismissed] = useState(false);
  const [neighborState, setNeighborState] = useState<{
    items: FileItem[];
    hasPrevious: boolean;
    hasNext: boolean;
    previousPath?: string;
    nextPath?: string;
  }>({
    items: [],
    hasPrevious: false,
    hasNext: false,
    previousPath: undefined,
    nextPath: undefined
  });
  const [isNeighborSupported, setIsNeighborSupported] = useState(true);

  // Get list of video files in current directory
  const fallbackVideoFiles = useMemo(() => {
    return files.filter((f) => !f.isDirectory && isVideo(f.mimeType));
  }, [files]);

  const activeVideoFiles =
    neighborState.items.length > 0 ? neighborState.items : fallbackVideoFiles;

  // Find current video index
  const currentIndex = useMemo(() => {
    return activeVideoFiles.findIndex((f) => f.path === path);
  }, [activeVideoFiles, path]);

  const usingNeighbors = neighborState.items.length > 0 && currentIndex !== -1;

  const hasPrevious = usingNeighbors
    ? currentIndex > 0 || Boolean(neighborState.previousPath)
    : currentIndex > 0;

  const hasNext = usingNeighbors
    ? (currentIndex !== -1 && currentIndex < activeVideoFiles.length - 1) ||
      Boolean(neighborState.nextPath)
    : currentIndex < fallbackVideoFiles.length - 1 ||
      (currentIndex === fallbackVideoFiles.length - 1 && hasMore);

  // Get current file info
  const currentFile = useMemo(() => {
    return activeVideoFiles[currentIndex];
  }, [activeVideoFiles, currentIndex]);

  // Video stream URL - memoized to prevent recreation
  const videoUrl = useMemo(() => {
    return path ? filesApi.stream(path) : "";
  }, [path]);

  // Video title - memoized
  const videoTitle = useMemo(() => {
    return path ? path.split("/").pop() : "Video Player";
  }, [path]);

  // Check video codec support
  const videoSupportTier = useMemo(() => {
    if (!currentFile) return "native";
    return getVideoSupportTier(currentFile.mimeType);
  }, [currentFile]);

  // Navigate to next video after loading more files (fallback when neighbors aren't available)
  useEffect(() => {
    if (
      neighborState.items.length === 0 &&
      pendingNavigation &&
      !isLoadingFiles &&
      fallbackVideoFiles.length > 0
    ) {
      const nextVideoIndex = currentIndex + 1;
      if (nextVideoIndex < fallbackVideoFiles.length) {
        const nextFile = fallbackVideoFiles[nextVideoIndex];
        setSearchParams({ path: nextFile.path });
      }
      setPendingNavigation(false);
    }
  }, [
    neighborState.items.length,
    pendingNavigation,
    isLoadingFiles,
    fallbackVideoFiles,
    currentIndex,
    setSearchParams
  ]);

  const loadNeighbors = useCallback(
    async (targetPath: string | null) => {
      if (!targetPath || !isNeighborSupported) {
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
          before: 25,
          after: 25,
          mediaType: "video"
        });
        setNeighborState({
          items: response.items,
          hasPrevious: response.hasPrevious,
          hasNext: response.hasNext,
          previousPath: response.previousPath,
          nextPath: response.nextPath
        });
      } catch (err) {
        const status =
          typeof err === "object" &&
          err !== null &&
          "response" in err &&
          (err as { response?: Response }).response?.status;

        if (status === 404) {
          setIsNeighborSupported(false);
        } else {
          console.error("Failed to load video neighbors", err);
        }

        setNeighborState({
          items: [],
          hasPrevious: false,
          hasNext: false,
          previousPath: undefined,
          nextPath: undefined
        });
      }
    },
    [isNeighborSupported]
  );

  useEffect(() => {
    loadNeighbors(path);
  }, [path, loadNeighbors]);

  // Handle video metadata load
  const handleLoadedMetadata = useCallback(
    (duration: number, width: number, height: number) => {
      setVideoInfo({
        duration,
        width,
        height,
        size: currentFile?.size || 0
      });
    },
    [currentFile]
  );

  // Handle video error
  const handleVideoError = useCallback((error: Error) => {
    setError(error.message);
  }, []);

  // Reset state when path changes
  useEffect(() => {
    setError(null);
    setVideoInfo(null);
    setIsWarningDismissed(false);
  }, [path]);

  // Navigation handlers - defined before keyboard handler
  const navigateToPrevious = useCallback(() => {
    if (!path) return;

    if (currentIndex > 0 && activeVideoFiles[currentIndex - 1]) {
      const prevFile = activeVideoFiles[currentIndex - 1];
      setSearchParams({ path: prevFile.path });
      return;
    }

    if (usingNeighbors && neighborState.previousPath) {
      setSearchParams({ path: neighborState.previousPath });
    }
  }, [
    activeVideoFiles,
    currentIndex,
    neighborState.previousPath,
    path,
    setSearchParams,
    usingNeighbors
  ]);

  const navigateToNext = useCallback(async () => {
    if (!path) return;

    if (currentIndex !== -1 && currentIndex < activeVideoFiles.length - 1) {
      const nextFile = activeVideoFiles[currentIndex + 1];
      setSearchParams({ path: nextFile.path });
      return;
    }

    if (usingNeighbors && neighborState.nextPath) {
      setSearchParams({ path: neighborState.nextPath });
      return;
    }

    if (
      !usingNeighbors &&
      currentIndex === fallbackVideoFiles.length - 1 &&
      hasMore &&
      !isLoadingFiles
    ) {
      setPendingNavigation(true);
      await loadMore();
    }
  }, [
    activeVideoFiles,
    currentIndex,
    neighborState.nextPath,
    usingNeighbors,
    path,
    setSearchParams,
    fallbackVideoFiles.length,
    hasMore,
    isLoadingFiles,
    loadMore
  ]);

  // Memoized handlers
  const handleDownload = useCallback(() => {
    if (path) {
      window.open(filesApi.download(path, false), "_blank");
    }
  }, [path]);

  const handleClose = useCallback(() => {
    if (path) {
      const folderPath = path.substring(0, path.lastIndexOf("/"));
      navigate(`/?path=${encodeURIComponent(folderPath)}`);
    } else {
      navigate("/");
    }
  }, [path, navigate]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (error) return;

      switch (e.key) {
        case "Escape":
          handleClose();
          break;
        case "ArrowLeft":
          if (!e.shiftKey && hasPrevious) navigateToPrevious();
          break;
        case "ArrowRight":
          if (!e.shiftKey && hasNext) navigateToNext();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    error,
    hasPrevious,
    hasNext,
    handleClose,
    navigateToPrevious,
    navigateToNext
  ]);

  return (
    <div className="flex flex-col h-full bg-surface-base">
      {/* Top Toolbar */}
      <header className="flex items-center justify-between gap-4 px-4 py-2 border-b border-border bg-surface-secondary">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          <span className="hidden sm:inline">Back</span>
        </Button>

        <div className="flex items-center gap-2 flex-1 min-w-0 justify-center">
          <h1 className="text-sm font-medium text-content truncate max-w-full">
            {videoTitle}
          </h1>
          {videoInfo && !error && (
            <>
              <span className="text-content-muted hidden sm:inline">•</span>
              <span className="text-xs text-content-muted whitespace-nowrap hidden sm:inline">
                {getResolutionLabel(videoInfo.width, videoInfo.height)}
              </span>
              <span className="text-content-muted hidden md:inline">•</span>
              <span className="text-xs text-content-muted whitespace-nowrap hidden md:inline">
                {formatDuration(videoInfo.duration)}
              </span>
              <span className="text-content-muted hidden lg:inline">•</span>
              <span className="text-xs text-content-muted whitespace-nowrap hidden lg:inline">
                {formatFileSize(videoInfo.size)}
              </span>
              {activeVideoFiles.length > 1 && (
                <>
                  <span className="text-content-muted hidden xl:inline">•</span>
                  <span className="text-xs text-content-muted whitespace-nowrap hidden xl:inline">
                    {currentIndex + 1} / {activeVideoFiles.length} loaded
                  </span>
                </>
              )}
            </>
          )}
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDownload}
            disabled={!!error}
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

      {/* Main Video Area */}
      <div className="flex-1 relative overflow-hidden bg-black">
        {error || !path ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <AlertCircle className="h-12 w-12 text-error mb-4" />
            <h2 className="text-xl font-bold text-error mb-2">Error</h2>
            <p className="text-content-muted mb-4">
              {error || "No file path provided"}
            </p>
          </div>
        ) : (
          <>
            {/* Compatibility Warning */}
            {videoSupportTier === "limited" && !isWarningDismissed && (
              <div className="absolute top-4 left-4 right-4 z-10 bg-accent/90 border border-accent rounded-lg p-3 backdrop-blur-sm">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-white flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm text-white font-medium">
                      QuickTime (.mov) files may have limited browser support
                    </p>
                    <p className="text-xs text-white/90 mt-1">
                      If video doesn't play, try downloading or converting to
                      MP4
                    </p>
                    <button
                      onClick={handleDownload}
                      className="text-xs text-white underline mt-1 hover:no-underline">
                      Download video
                    </button>
                  </div>
                  <button
                    onClick={() => setIsWarningDismissed(true)}
                    className="text-white hover:text-white/80 transition-colors flex-shrink-0"
                    title="Dismiss">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
            {videoSupportTier === "unsupported" && !isWarningDismissed && (
              <div className="absolute top-4 left-4 right-4 z-10 bg-error/90 border border-error rounded-lg p-3 backdrop-blur-sm">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-white flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm text-white font-medium">
                      This video format is not supported in your browser
                    </p>
                    <button
                      onClick={handleDownload}
                      className="text-xs text-white underline mt-1 hover:no-underline">
                      Download to play locally
                    </button>
                  </div>
                  <button
                    onClick={() => setIsWarningDismissed(true)}
                    className="text-white hover:text-white/80 transition-colors flex-shrink-0"
                    title="Dismiss">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Video Player */}
            {videoUrl ? (
              <VideoPlayer
                src={videoUrl}
                title={videoTitle}
                onLoadedMetadata={handleLoadedMetadata}
                onError={handleVideoError}
                className="h-full"
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <p className="text-white">No video path provided</p>
              </div>
            )}

            {/* Navigation Arrows */}
            {(hasPrevious || hasNext) && (
              <>
                {hasPrevious && (
                  <button
                    onClick={navigateToPrevious}
                    className="absolute left-4 top-1/2 -translate-y-1/2 bg-surface-secondary/70 hover:bg-surface-secondary/90 backdrop-blur-sm border border-border/50 rounded-lg p-3 shadow-lg transition-all hover:scale-110 z-10"
                    title="Previous (←)">
                    <ChevronLeft className="w-6 h-6 text-white" />
                  </button>
                )}
                {hasNext && (
                  <button
                    onClick={navigateToNext}
                    disabled={pendingNavigation || isLoadingFiles}
                    className="absolute right-4 top-1/2 -translate-y-1/2 bg-surface-secondary/70 hover:bg-surface-secondary/90 backdrop-blur-sm border border-border/50 rounded-lg p-3 shadow-lg transition-all hover:scale-110 disabled:opacity-50 disabled:cursor-wait z-10"
                    title="Next (→)">
                    {pendingNavigation || isLoadingFiles ? (
                      <Loader2 className="w-6 h-6 text-content animate-spin" />
                    ) : (
                      <ChevronRight className="w-6 h-6 text-white" />
                    )}
                  </button>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
