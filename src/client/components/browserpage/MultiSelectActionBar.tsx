import { Copy, Download, Scissors, Trash2, X } from "lucide-react";
import { useCallback } from "react";
import { filesApi } from "../../lib/api";
import { useFileStore } from "../../stores/fileStore";
import { useSelectionStore } from "../../stores/selectionStore";
import { useUIStore } from "../../stores/uiStore";
import { toast } from "../common/Toast";

export function MultiSelectActionBar() {
  const { currentPath } = useFileStore();
  const {
    selectedPaths,
    clearSelection,
    copyToClipboard,
    cutToClipboard,
    getSelectedPaths
  } = useSelectionStore();
  const { openDeleteDialog } = useUIStore();

  const selectedCount = selectedPaths.size;

  const handleCopy = useCallback(() => {
    copyToClipboard(currentPath);
    toast.info("Copied to clipboard");
    clearSelection();
  }, [copyToClipboard, currentPath, clearSelection]);

  const handleCut = useCallback(() => {
    cutToClipboard(currentPath);
    toast.info("Cut to clipboard");
    clearSelection();
  }, [cutToClipboard, currentPath, clearSelection]);

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

    toast.success(
      `Downloading ${paths.length} ${paths.length === 1 ? "item" : "items"}`
    );
    clearSelection();
  }, [getSelectedPaths, clearSelection]);

  const handleDelete = useCallback(() => {
    const paths = getSelectedPaths();
    if (paths.length > 0) {
      openDeleteDialog(paths);
    }
  }, [getSelectedPaths, openDeleteDialog]);

  if (selectedCount <= 1) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 animate-slide-up">
      <div className="bg-accent text-white rounded-full shadow-elevated flex items-center gap-1 px-4 py-2.5">
        {/* Selection count */}
        <div className="px-2 py-1 font-medium text-sm whitespace-nowrap select-none">
          {selectedCount} {selectedCount === 1 ? "item" : "items"} selected
        </div>

        {/* Divider */}
        <div className="w-px h-6 bg-white/20 mx-1" />

        {/* Action buttons */}
        <button
          onClick={handleCopy}
          className="p-2 hover:bg-white/20 rounded-full transition-colors"
          title="Copy"
          aria-label="Copy selected items">
          <Copy className="h-4 w-4" />
        </button>

        <button
          onClick={handleCut}
          className="p-2 hover:bg-white/20 rounded-full transition-colors"
          title="Cut"
          aria-label="Cut selected items">
          <Scissors className="h-4 w-4" />
        </button>

        <button
          onClick={handleDownload}
          className="p-2 hover:bg-white/20 rounded-full transition-colors"
          title="Download"
          aria-label="Download selected items">
          <Download className="h-4 w-4" />
        </button>

        <button
          onClick={handleDelete}
          className="p-2 hover:bg-white/20 rounded-full transition-colors"
          title="Delete"
          aria-label="Delete selected items">
          <Trash2 className="h-4 w-4" />
        </button>

        {/* Divider */}
        <div className="w-px h-6 bg-white/20 mx-1" />

        {/* Clear selection button */}
        <button
          onClick={clearSelection}
          className="p-2 hover:bg-white/20 rounded-full transition-colors"
          title="Clear selection"
          aria-label="Clear selection">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
