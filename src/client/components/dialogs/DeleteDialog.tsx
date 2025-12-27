// src/client/components/dialogs/DeleteDialog.tsx
import { useState } from "react";
import { filesApi } from "../../lib/api";
import { getFileName } from "../../lib/utils";
import { useFileStore } from "../../stores/fileStore";
import { useSelectionStore } from "../../stores/selectionStore";
import { useUIStore } from "../../stores/uiStore";
import { ConfirmDialog } from "../common/Dialog";
import { toast } from "../common/Toast";

export function DeleteDialog() {
  const { dialogs, closeDeleteDialog } = useUIStore();
  const { removeFiles } = useFileStore();
  const { clearSelection } = useSelectionStore();
  const [isLoading, setIsLoading] = useState(false);

  const { isOpen, paths } = dialogs.delete;
  const count = paths.length;
  const isSingle = count === 1;

  const getMessage = () => {
    if (isSingle) {
      return `${getFileName(paths[0])}?`;
    }
    return `Are you sure you want to delete ${count} items?`;
  };

  const handleConfirm = async () => {
    setIsLoading(true);

    try {
      const result = await filesApi.delete(paths);

      // Determine which files were successfully deleted
      const successfulPaths = result.results
        .filter((r) => r.success)
        .map((r) => r.path)
        .filter((p): p is string => !!p);

      if (result.success) {
        toast.success(
          isSingle
            ? "Item deleted successfully"
            : `${count} items deleted successfully`
        );
      } else {
        // Some items failed
        const failed = result.results.filter((r) => !r.success);
        if (failed.length > 0) {
          toast.warning(
            `${failed.length} of ${count} items could not be deleted`
          );
        }
      }

      // Optimistically remove successful items without triggering full reload
      if (successfulPaths.length > 0) {
        removeFiles(successfulPaths);
      }

      clearSelection();
      closeDeleteDialog();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ConfirmDialog
      isOpen={isOpen}
      onClose={closeDeleteDialog}
      onConfirm={handleConfirm}
      title={isSingle ? "Delete Item" : `Delete ${count} Items`}
      message={getMessage()}
      confirmLabel="Delete"
      cancelLabel="Cancel"
      variant="danger"
      isLoading={isLoading}
    />
  );
}
