import { FileIcon, Folder } from "lucide-react";
import { useEffect, useState } from "react";
import { FileItem, filesApi } from "../../lib/api";
import { formatDate, formatFileSize, getFileName } from "../../lib/utils";
import { useUIStore } from "../../stores/uiStore";
import { Dialog } from "../common/Dialog";

export function GetInfoDialog() {
  const { dialogs, closeGetInfoDialog } = useUIStore();
  const { isOpen, path } = dialogs.getInfo;
  const [stats, setStats] = useState<FileItem | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isOpen && path) {
      loadStats(path);
    } else {
      setStats(null);
    }
  }, [isOpen, path]);

  const loadStats = async (filePath: string) => {
    setIsLoading(true);
    setError("");
    try {
      const data = await filesApi.stats(filePath, { calculateSize: true });
      setStats(data);
    } catch (err) {
      setError("Failed to load info");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const fileName = path ? getFileName(path) : "";

  return (
    <Dialog isOpen={isOpen} onClose={closeGetInfoDialog} title="Info" size="md">
      <div className="space-y-6">
        <div className="flex flex-col items-center justify-center pb-4 border-b border-border">
          <div className="w-16 h-16 bg-surface-secondary rounded-xl flex items-center justify-center mb-3">
            {stats?.isDirectory ? (
              <Folder className="w-8 h-8 text-accent" />
            ) : (
              <FileIcon className="w-8 h-8 text-content-secondary" />
            )}
          </div>
          <h3 className="text-xl font-medium text-content text-center break-all px-4">
            {fileName}
          </h3>
          <p className="text-sm text-content-tertiary mt-1">
            {stats?.mimeType || (stats?.isDirectory ? "Folder" : "File")}
          </p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" />
          </div>
        ) : error ? (
          <div className="text-error text-center py-4">{error}</div>
        ) : stats ? (
          <div className="space-y-4">
            <div className="grid grid-cols-[100px_1fr] gap-2 text-sm">
              <div className="text-content-secondary">Type:</div>
              <div className="text-content font-medium">
                {stats.isDirectory
                  ? "Folder"
                  : stats.extension?.toUpperCase() || "File"}
              </div>

              <div className="text-content-secondary">Size:</div>
              <div className="text-content font-medium">
                {formatFileSize(stats.size)}
                <span className="text-content-tertiary ml-2">
                  ({stats.size.toLocaleString()} bytes)
                </span>
              </div>

              <div className="text-content-secondary">Location:</div>
              <div className="text-content font-medium break-all text-xs leading-5">
                {stats.path}
              </div>

              <div className="text-content-secondary">Modified:</div>
              <div className="text-content font-medium">
                {formatDate(stats.modifiedAt)}
              </div>

              {stats.isDirectory && (
                <>
                  <div className="text-content-secondary mt-2">Contains:</div>
                  <div className="text-content font-medium mt-2">
                    {stats.fileCount !== undefined
                      ? `${stats.fileCount.toLocaleString()} files`
                      : "0 files"}
                    {stats.folderCount !== undefined
                      ? `, ${stats.folderCount.toLocaleString()} folders`
                      : ", 0 folders"}
                  </div>
                </>
              )}
            </div>
          </div>
        ) : null}

        <div className="flex justify-end pt-2">
          <button
            onClick={closeGetInfoDialog}
            className="px-4 py-2 bg-surface-secondary hover:bg-surface-hover text-content rounded-md transition-colors font-medium text-sm">
            Close
          </button>
        </div>
      </div>
    </Dialog>
  );
}
