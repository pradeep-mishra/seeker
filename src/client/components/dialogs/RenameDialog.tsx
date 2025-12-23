// src/client/components/dialogs/RenameDialog.tsx
import { useState, useEffect } from "react";
import { Dialog } from "../common/Dialog";
import { Input } from "../common/Input";
import { Button } from "../common/Button";
import { useUIStore } from "../../stores/uiStore";
import { useFileStore } from "../../stores/fileStore";
import { filesApi } from "../../lib/api";
import { toast } from "../common/Toast";
import { Pencil } from "lucide-react";

export function RenameDialog() {
  const { dialogs, closeRenameDialog } = useUIStore();
  const { refresh } = useFileStore();
  const [name, setName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  // Set initial name when dialog opens
  useEffect(() => {
    if (dialogs.rename.isOpen) {
      setName(dialogs.rename.currentName);
      setError("");
    }
  }, [dialogs.rename.isOpen, dialogs.rename.currentName]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!name.trim()) {
      setError("Please enter a name");
      return;
    }

    if (name === dialogs.rename.currentName) {
      closeRenameDialog();
      return;
    }

    setIsLoading(true);

    try {
      const result = await filesApi.rename(dialogs.rename.path, name.trim());
      if (result.success) {
        toast.success("Renamed successfully");
        closeRenameDialog();
        refresh();
      } else {
        setError(result.error || "Failed to rename");
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to rename");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog
      isOpen={dialogs.rename.isOpen}
      onClose={closeRenameDialog}
      title="Rename"
      size="sm"
    >
      <form onSubmit={handleSubmit}>
        <Input
          label="New name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Enter new name"
          error={error}
          leftIcon={<Pencil className="h-4 w-4" />}
          autoFocus
          onFocus={(e) => {
            // Select filename without extension
            const dotIndex = e.target.value.lastIndexOf(".");
            if (dotIndex > 0) {
              e.target.setSelectionRange(0, dotIndex);
            } else {
              e.target.select();
            }
          }}
        />

        <div className="flex justify-end gap-3 mt-6">
          <Button
            type="button"
            variant="secondary"
            onClick={closeRenameDialog}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button type="submit" isLoading={isLoading}>
            Rename
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
