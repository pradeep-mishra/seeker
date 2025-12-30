import { AlertCircle, Folder, RefreshCw } from "lucide-react";
import type { Mount } from "../../lib/api";
import { useUIStore } from "../../stores/uiStore";
import { Button } from "../common/Button";
import { LoadingSpinner } from "../common/LoadingScreen";

interface EmptyStatesProps {
  type: "loading" | "noMounts" | "noPath" | "error";
  isAdmin?: boolean;
  mounts?: Mount[];
  errorMessage?: string;
  onNavigateToMount?: (path: string, mount: Mount) => void;
  onRefresh?: () => void;
}

export function EmptyStates({
  type,
  isAdmin,
  mounts = [],
  errorMessage,
  onNavigateToMount,
  onRefresh
}: EmptyStatesProps) {
  if (type === "loading") {
    return (
      <div className="flex-1 flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (type === "noMounts") {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        <div className="w-16 h-16 rounded-full bg-warning-surface flex items-center justify-center mb-4">
          <AlertCircle className="h-8 w-8 text-warning" />
        </div>
        <h2 className="text-xl font-semibold text-content mb-2">
          No Storage Configured
        </h2>
        <p className="text-content-secondary text-center max-w-md mb-6">
          {isAdmin
            ? "You need to add at least one mount point to browse files. Go to Settings to add a mount."
            : "No storage locations are configured. Please contact your administrator."}
        </p>
        {isAdmin && (
          <Button onClick={() => useUIStore.getState().openSettingsDialog()}>
            Configure Storage
          </Button>
        )}
      </div>
    );
  }

  if (type === "noPath") {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mb-4">
          <Folder className="h-8 w-8 text-accent" />
        </div>
        <h2 className="text-xl font-semibold text-content mb-2">
          Select a Location
        </h2>
        <p className="text-content-secondary text-center max-w-md mb-6">
          Choose a storage location from the sidebar to start browsing files.
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          {mounts.map((mount) => (
            <Button
              key={mount.id}
              variant="secondary"
              onClick={() => onNavigateToMount?.(mount.path, mount)}>
              {mount.label}
            </Button>
          ))}
        </div>
      </div>
    );
  }

  if (type === "error") {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        <div className="w-16 h-16 rounded-full bg-error-surface flex items-center justify-center mb-4">
          <AlertCircle className="h-8 w-8 text-error" />
        </div>
        <h2 className="text-xl font-semibold text-content mb-2">
          Error Loading Files
        </h2>
        <p className="text-content-secondary text-center max-w-md mb-6">
          {errorMessage}
        </p>
        <Button
          onClick={onRefresh}
          leftIcon={<RefreshCw className="h-4 w-4" />}>
          Try Again
        </Button>
      </div>
    );
  }

  return null;
}
