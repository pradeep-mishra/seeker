import { AlertTriangle, Pencil } from "lucide-react";
import { useEffect, useState } from "react";
import { filesApi } from "../../lib/api";
import { useFileStore } from "../../stores/fileStore";
import { useUIStore } from "../../stores/uiStore";
import { Button } from "../common/Button";
import { Dialog } from "../common/Dialog";
import { Input } from "../common/Input";
import { toast } from "../common/Toast";

export function RenameDialog() {
  const { dialogs, closeRenameDialog } = useUIStore();
  const { refresh } = useFileStore();
  const [baseName, setBaseName] = useState("");
  const [extension, setExtension] = useState("");
  const [originalExtension, setOriginalExtension] = useState("");
  const [isEditingExtension, setIsEditingExtension] = useState(false);
  const [hasConfirmedExtensionChange, setHasConfirmedExtensionChange] =
    useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const trimmedBaseName = baseName.trim();
  const trimmedExtension = extension.trim();
  const normalizedOriginalExtension = originalExtension.toLowerCase();
  const normalizedTrimmedExtension = trimmedExtension.toLowerCase();
  const hasExtensionValue =
    trimmedExtension.length > 0 || originalExtension.length > 0;
  const extensionChanged =
    isEditingExtension &&
    hasExtensionValue &&
    normalizedTrimmedExtension !== normalizedOriginalExtension;
  const isRenameDisabled =
    isLoading ||
    trimmedBaseName.length === 0 ||
    (extensionChanged && !hasConfirmedExtensionChange);

  // Set initial name when dialog opens
  useEffect(() => {
    if (dialogs.rename.isOpen) {
      const currentName = dialogs.rename.currentName;
      const dotIndex = currentName.lastIndexOf(".");

      if (dotIndex > 0 && dotIndex < currentName.length - 1) {
        const nextBase = currentName.slice(0, dotIndex);
        const nextExtension = currentName.slice(dotIndex + 1);
        setBaseName(nextBase);
        setExtension(nextExtension);
        setOriginalExtension(nextExtension);
      } else {
        setBaseName(currentName);
        setExtension("");
        setOriginalExtension("");
      }

      setIsEditingExtension(false);
      setHasConfirmedExtensionChange(false);
      setError("");
    }
  }, [dialogs.rename.isOpen, dialogs.rename.currentName]);

  const handleEnableExtensionEdit = () => {
    setIsEditingExtension(true);
    setHasConfirmedExtensionChange(false);
    setError("");
  };
  const handleDisableExtensionEdit = () => {
    setIsEditingExtension(false);
    setExtension(originalExtension);
    setHasConfirmedExtensionChange(false);
    setError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!trimmedBaseName) {
      setError("Please enter a name");
      return;
    }

    if (extensionChanged && !hasConfirmedExtensionChange) {
      setError("Please confirm you want to change the extension");
      return;
    }

    const nextName = trimmedExtension
      ? `${trimmedBaseName}.${trimmedExtension}`
      : trimmedBaseName;

    if (nextName === dialogs.rename.currentName) {
      closeRenameDialog();
      return;
    }

    setIsLoading(true);

    try {
      const result = await filesApi.rename(dialogs.rename.path, nextName);
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
      size="md">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-2">
          <Input
            label="New name"
            value={baseName}
            onChange={(e) => setBaseName(e.target.value)}
            placeholder="Enter new name"
            error={error}
            leftIcon={<Pencil className="h-4 w-4" />}
            autoFocus
            onFocus={(e) => e.currentTarget.select()}
          />

          {extension && !isEditingExtension ? (
            <div className="flex items-center justify-between text-sm text-content-tertiary">
              <span>
                Extension locked as
                <span className="font-medium ml-1">.{extension}</span>
              </span>
              <button
                type="button"
                onClick={handleEnableExtensionEdit}
                className="text-accent hover:underline">
                Change extension
              </button>
            </div>
          ) : null}

          {!extension && !isEditingExtension ? (
            <button
              type="button"
              onClick={handleEnableExtensionEdit}
              className="text-sm font-medium text-accent hover:underline">
              Add extension
            </button>
          ) : null}
        </div>

        {isEditingExtension && (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <Input
                label="Extension"
                value={extension}
                onChange={(e) =>
                  setExtension(e.target.value.replace(/^\.+/, ""))
                }
                placeholder="e.g. jpg"
                leftIcon={
                  <span className="text-xs text-content-secondary">.</span>
                }
              />
              <button
                type="button"
                onClick={handleDisableExtensionEdit}
                className="text-sm text-content-tertiary hover:text-content shrink-0">
                Keep original
              </button>
            </div>

            <div className="rounded-lg border border-warning/40 bg-warning/5 p-3 text-sm">
              <div className="flex items-start gap-2 text-warning">
                <AlertTriangle className="h-4 w-4" />
                <p>
                  Changing extensions can make the file unusable. Continue only
                  if you know the new format.
                </p>
              </div>

              {extensionChanged && (
                <label className="mt-3 flex items-center gap-2 text-content text-sm">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-border text-accent focus:ring-border-focus"
                    checked={hasConfirmedExtensionChange}
                    onChange={(e) =>
                      setHasConfirmedExtensionChange(e.target.checked)
                    }
                  />
                  <span>I understand and want to change the extension.</span>
                </label>
              )}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="secondary"
            onClick={closeRenameDialog}
            disabled={isLoading}>
            Cancel
          </Button>
          <Button
            type="submit"
            isLoading={isLoading}
            disabled={isRenameDisabled}>
            Rename
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
