import { FolderPlus } from "lucide-react";
import { useEffect, useState } from "react";
import { useSelectionStore } from "../../stores/selectionStore";
import { useUIStore } from "../../stores/uiStore";
import { useVirtualFolderStore } from "../../stores/virtualFolderStore";
import { Button } from "../common/Button";
import { Dialog } from "../common/Dialog";
import { Input } from "../common/Input";
import { toast } from "../common/Toast";

export function VirtualFolderDialog() {
  const { dialogs, closeVirtualFolderDialog } = useUIStore();
  const { createCollection, renameCollection, addItemsToCollection } =
    useVirtualFolderStore();
  const { clearSelection } = useSelectionStore();
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const dialogState = dialogs.virtualFolder;
  const isOpen = dialogState.isOpen;
  const isRename = dialogState.mode === "rename";

  useEffect(() => {
    if (isOpen) {
      setName(dialogState.initialName || "");
      setError("");
      setIsLoading(false);
    }
  }, [isOpen, dialogState.initialName]);

  const handleClose = () => {
    if (!isLoading) {
      closeVirtualFolderDialog();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Name is required");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      if (isRename) {
        if (!dialogState.collectionId) {
          setError("Missing collection");
          setIsLoading(false);
          return;
        }
        const success = await renameCollection(
          dialogState.collectionId,
          trimmed
        );
        if (!success) {
          setError("Failed to rename virtual folder");
          setIsLoading(false);
          return;
        }
        toast.success("Virtual folder renamed");
      } else {
        const collection = await createCollection(trimmed);
        if (dialogState.pendingPaths.length > 0) {
          await addItemsToCollection(
            collection.id,
            dialogState.pendingPaths.map((path) => ({ path }))
          );
          toast.success("Added items to virtual folder");
          if (dialogState.clearSelectionOnComplete) {
            clearSelection();
          }
        } else {
          toast.success("Virtual folder created");
        }
      }
      closeVirtualFolderDialog();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Operation failed");
      setIsLoading(false);
    }
  };

  const title = isRename ? "Rename Virtual Folder" : "New Virtual Folder";
  const confirmLabel = isRename ? "Rename" : "Create";

  return (
    <Dialog isOpen={isOpen} onClose={handleClose} title={title} size="sm">
      <form onSubmit={handleSubmit}>
        <Input
          label="Folder name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Enter name"
          error={error}
          leftIcon={<FolderPlus className="h-4 w-4" />}
          autoFocus
        />
        {dialogState.pendingPaths.length > 0 && !isRename && (
          <p className="text-xs text-content-tertiary mt-2">
            {dialogState.pendingPaths.length} item
            {dialogState.pendingPaths.length === 1 ? "" : "s"} will be added.
          </p>
        )}
        <div className="flex justify-end gap-3 mt-6">
          <Button
            type="button"
            variant="secondary"
            onClick={handleClose}
            disabled={isLoading}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isLoading}>
            {confirmLabel}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
