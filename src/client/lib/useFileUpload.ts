import { useRef } from "react";
import { toast } from "../components/common/Toast";
import { useFileStore } from "../stores/fileStore";
import { filesApi, type UploadItem } from "./api";

export function useFileUpload() {
  const { currentPath, refresh } = useFileStore();
  const uploadToastIdRef = useRef<string | null>(null);
  const uploadAbortControllerRef = useRef<AbortController | null>(null);

  const uploadFiles = async (items: UploadItem[]) => {
    if (!currentPath) return;

    if (uploadToastIdRef.current) {
      toast.info("An upload is already in progress. Please wait or cancel it.");
      return;
    }

    if (items.length === 0) return;

    // Initialize abort controller
    const abortController = new AbortController();
    uploadAbortControllerRef.current = abortController;

    // Create progress toast
    const toastId = toast.progress(
      `Uploading ${items.length} file${items.length !== 1 ? "s" : ""}...`,
      0,
      () => {
        // On cancel
        abortController.abort();
        toast.dismiss(toastId);
        toast.info("Upload cancelled");
        uploadToastIdRef.current = null;
        uploadAbortControllerRef.current = null;
      }
    );
    uploadToastIdRef.current = toastId;

    try {
      const result = await filesApi.upload(
        currentPath,
        items,
        (progress) => {
          // Scale progress to 90% during upload phase
          // Reserve 90-100% for server processing
          const scaledProgress = progress * 0.9;
          toast.update(toastId, { progress: scaledProgress });

          // When upload completes, show processing message
          if (progress >= 99.9) {
            toast.update(toastId, {
              message: "Processing files...",
              progress: 90
            });
          }
        },
        abortController.signal
      );

      if (result.success) {
        const successCount = result.results.filter((r) => r.success).length;
        const failCount = result.results.length - successCount;

        // Update to 100% briefly before showing result
        toast.update(toastId, { progress: 100 });

        setTimeout(() => {
          toast.dismiss(toastId);

          if (failCount === 0) {
            toast.success(
              `Successfully uploaded ${successCount} file${
                successCount !== 1 ? "s" : ""
              }`
            );
          } else {
            toast.error(
              `Uploaded ${successCount} file${
                successCount !== 1 ? "s" : ""
              }, ${failCount} failed`
            );
          }
        }, 500);

        // Refresh the file list
        refresh();
      } else {
        toast.dismiss(toastId);
        toast.error("Failed to upload files");
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to upload files";

      // If cancelled, we already handled the toast in the onCancel callback
      if (message === "Upload cancelled") {
        return;
      }

      toast.dismiss(toastId);
      toast.error(message);
    } finally {
      uploadToastIdRef.current = null;
      uploadAbortControllerRef.current = null;
    }
  };

  return { uploadFiles };
}
