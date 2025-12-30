import { FolderPlus } from "lucide-react";
import { useEffect, useState } from "react";
import { filesApi } from "../../lib/api";
import { useFileStore } from "../../stores/fileStore";
import { useUIStore } from "../../stores/uiStore";
import { Button } from "../common/Button";
import { Dialog } from "../common/Dialog";
import { Input } from "../common/Input";
import { toast } from "../common/Toast";

export function CreateFolderDialog() {
  const { dialogs, closeCreateFolderDialog } = useUIStore();
  const { currentPath, refresh } = useFileStore();
  const [name, setName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  // Reset form when dialog opens
  useEffect(() => {
    if (dialogs.createFolder) {
      setName("");
      setError("");
    }
  }, [dialogs.createFolder]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!name.trim()) {
      setError("Please enter a folder name");
      return;
    }

    if (!currentPath) {
      setError("No directory selected");
      return;
    }

    setIsLoading(true);

    try {
      const result = await filesApi.createFolder(currentPath, name.trim());
      if (result.success) {
        toast.success("Folder created successfully");
        closeCreateFolderDialog();
        refresh();
      } else {
        setError(result.error || "Failed to create folder");
      }
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Failed to create folder"
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog
      isOpen={dialogs.createFolder}
      onClose={closeCreateFolderDialog}
      title="New Folder"
      size="sm">
      <form onSubmit={handleSubmit}>
        <Input
          label="Folder name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Enter folder name"
          error={error}
          leftIcon={<FolderPlus className="h-4 w-4" />}
          autoFocus
        />

        <div className="flex justify-end gap-3 mt-6">
          <Button
            type="button"
            variant="secondary"
            onClick={closeCreateFolderDialog}
            disabled={isLoading}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isLoading}>
            Create
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
