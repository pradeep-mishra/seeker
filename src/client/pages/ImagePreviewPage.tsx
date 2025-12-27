import { ArrowLeft, Download, Loader2, ZoomIn, ZoomOut } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "../components/common/Button";
import { filesApi } from "../lib/api";
import { formatFileSize } from "../lib/utils";

export default function ImagePreviewPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const path = searchParams.get("path");

  const [imageUrl, setImageUrl] = useState<string>("");
  const [imageInfo, setImageInfo] = useState<{
    width: number;
    height: number;
    size?: number;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(100);

  useEffect(() => {
    if (!path) {
      setError("No file path provided");
      setIsLoading(false);
      return;
    }

    let objectUrl: string | null = null;

    const loadImage = async () => {
      try {
        const url = filesApi.download(path, true);

        // First, fetch the image to check if it's accessible
        const response = await fetch(url, {
          credentials: "include" // Include cookies for auth
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error("Server response error:", errorText);
          setError(
            `Failed to load image: ${response.status} ${response.statusText}`
          );
          setIsLoading(false);
          return;
        }

        // Get the blob and create an object URL
        const blob = await response.blob();

        // Verify blob is not empty
        if (blob.size === 0) {
          console.error("Blob is empty!");
          setError("Image file is empty");
          setIsLoading(false);
          return;
        }

        objectUrl = URL.createObjectURL(blob);
        setImageUrl(objectUrl);

        // Load the image to get dimensions
        const img = new Image();
        img.onload = () => {
          setImageInfo({
            width: img.naturalWidth,
            height: img.naturalHeight
          });
          setIsLoading(false);
        };
        img.onerror = (e) => {
          console.error("Image element load error:", e);
          setError("Failed to load image");
          setIsLoading(false);
        };
        img.src = objectUrl;
      } catch (err) {
        console.error("Exception loading image:", err);
        setError(
          `Failed to load image: ${
            err instanceof Error ? err.message : String(err)
          }`
        );
        setIsLoading(false);
      }
    };

    loadImage();

    // Cleanup function to revoke object URL
    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [path]);

  const handleZoomIn = () => {
    setZoom((prev) => Math.min(prev + 25, 400));
  };

  const handleZoomOut = () => {
    setZoom((prev) => Math.max(prev - 25, 25));
  };

  const handleResetZoom = () => {
    setZoom(100);
  };

  const handleDownload = () => {
    if (path) {
      window.open(filesApi.download(path, false), "_blank");
    }
  };

  return (
    <div className="flex flex-col h-full bg-surface-base">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2 border-b border-border bg-surface-secondary">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <h1 className="text-sm font-medium text-content truncate max-w-md">
            {path ? path.split("/").pop() : "Image Preview"}
          </h1>
          {imageInfo && !isLoading && !error && (
            <span className="text-xs min-w-[5.5rem] text-center text-content-muted bg-surface-hover px-2 py-1 rounded">
              {imageInfo.width} × {imageInfo.height}
              {imageInfo.size && ` • ${formatFileSize(imageInfo.size)}`}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleZoomOut}
            disabled={zoom <= 25 || isLoading || !!error}>
            <ZoomOut className="w-4 h-4" />
          </Button>
          <span className="text-sm text-content-secondary min-w-[4rem] text-center">
            {zoom}%
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleZoomIn}
            disabled={zoom >= 400 || isLoading || !!error}>
            <ZoomIn className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleResetZoom}
            disabled={zoom === 100 || isLoading || !!error}>
            Reset
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleDownload}
            disabled={isLoading || !!error}>
            <Download className="w-4 h-4 mr-2" />
            Download
          </Button>
        </div>
      </header>

      {/* Preview Area */}
      <div className="flex-1 overflow-auto bg-surface-base">
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
          <div className="flex items-center justify-center min-h-full p-8">
            <img
              src={imageUrl}
              alt={path.split("/").pop()}
              className="max-w-full h-auto transition-transform"
              style={{
                transform: `scale(${zoom / 100})`,
                transformOrigin: "center"
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
