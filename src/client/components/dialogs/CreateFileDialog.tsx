import { FilePlus } from "lucide-react";
import { useEffect, useState } from "react";
import { filesApi } from "../../lib/api";
import { useFileStore } from "../../stores/fileStore";
import { useUIStore } from "../../stores/uiStore";
import { Button } from "../common/Button";
import { Dialog } from "../common/Dialog";
import { Input } from "../common/Input";
import { toast } from "../common/Toast";

export function CreateFileDialog() {
  const { dialogs, closeCreateFileDialog } = useUIStore();
  const { currentPath, refresh } = useFileStore();
  const [name, setName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  // Reset form when dialog opens
  useEffect(() => {
    if (dialogs.createFile) {
      setName("");
      setError("");
    }
  }, [dialogs.createFile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!name.trim()) {
      setError("Please enter a file name");
      return;
    }

    if (!currentPath) {
      setError("No directory selected");
      return;
    }

    setIsLoading(true);

    try {
      const result = await filesApi.createFile(currentPath, name.trim());
      if (result.success) {
        toast.success("File created successfully");
        closeCreateFileDialog();
        refresh();
      } else {
        setError(result.error || "Failed to create file");
      }
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Failed to create file"
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog
      isOpen={dialogs.createFile}
      onClose={closeCreateFileDialog}
      title="New File"
      size="sm">
      <form onSubmit={handleSubmit}>
        <Input
          label="File name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Enter file name"
          error={error}
          leftIcon={<FilePlus className="h-4 w-4" />}
          autoFocus
        />

        <div className="flex justify-end gap-3 mt-6">
          <Button
            type="button"
            variant="secondary"
            onClick={closeCreateFileDialog}
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
