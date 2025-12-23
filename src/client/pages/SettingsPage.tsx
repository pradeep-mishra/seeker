// src/client/pages/SettingsPage.tsx
import {
  ArrowLeft,
  Eye,
  EyeOff,
  HardDrive,
  Moon,
  Plus,
  Settings,
  Sun,
  Trash2
} from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/common/Button";
import { Dialog } from "../components/common/Dialog";
import { Input } from "../components/common/Input";
import { toast } from "../components/common/Toast";
import { mountsApi, type Mount } from "../lib/api";
import { formatFileSize } from "../lib/utils";
import { useAuthStore } from "../stores/authStore";
import { useUIStore } from "../stores/uiStore";

export default function SettingsPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { theme, setTheme, showHiddenFiles, setShowHiddenFiles } = useUIStore();

  const [mounts, setMounts] = useState<Mount[]>([]);
  const [isLoadingMounts, setIsLoadingMounts] = useState(true);
  const [showAddMount, setShowAddMount] = useState(false);
  const [newMountPath, setNewMountPath] = useState("");
  const [newMountLabel, setNewMountLabel] = useState("");
  const [isAddingMount, setIsAddingMount] = useState(false);
  const [addMountError, setAddMountError] = useState("");

  // Load mounts
  useEffect(() => {
    loadMounts();
  }, []);

  const loadMounts = async () => {
    setIsLoadingMounts(true);
    try {
      const { mounts } = await mountsApi.list();
      setMounts(mounts);
    } catch (error) {
      toast.error("Failed to load mounts");
    } finally {
      setIsLoadingMounts(false);
    }
  };

  const handleAddMount = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddMountError("");

    if (!newMountPath.trim() || !newMountLabel.trim()) {
      setAddMountError("Please fill in all fields");
      return;
    }

    setIsAddingMount(true);
    try {
      const result = await mountsApi.add(
        newMountPath.trim(),
        newMountLabel.trim()
      );
      if (result.success) {
        toast.success("Mount added successfully");
        setShowAddMount(false);
        setNewMountPath("");
        setNewMountLabel("");
        loadMounts();
        useUIStore.getState().refreshMounts();
      } else {
        setAddMountError(result.error || "Failed to add mount");
      }
    } catch (error) {
      setAddMountError(
        error instanceof Error ? error.message : "Failed to add mount"
      );
    } finally {
      setIsAddingMount(false);
    }
  };

  const handleRemoveMount = async (id: string) => {
    if (!confirm("Are you sure you want to remove this mount?")) return;

    try {
      await mountsApi.remove(id);
      toast.success("Mount removed");
      loadMounts();
      useUIStore.getState().refreshMounts();
    } catch (error) {
      toast.error("Failed to remove mount");
    }
  };

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => navigate("/")}
            className="p-2 rounded-lg hover:bg-surface-hover transition-colors">
            <ArrowLeft className="h-5 w-5 text-content-secondary" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-content">Settings</h1>
            <p className="text-content-secondary">Manage your preferences</p>
          </div>
        </div>

        {/* Appearance section */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-content mb-4 flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Appearance
          </h2>

          <div className="bg-surface border border-border rounded-lg divide-y divide-border">
            {/* Theme */}
            <div className="flex items-center justify-between p-4">
              <div>
                <p className="font-medium text-content">Theme</p>
                <p className="text-sm text-content-secondary">
                  Choose your preferred theme
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setTheme("light")}
                  className={`p-2 rounded-lg transition-colors ${
                    theme === "light"
                      ? "bg-accent text-content-inverse"
                      : "bg-surface-secondary hover:bg-surface-hover"
                  }`}>
                  <Sun className="h-5 w-5" />
                </button>
                <button
                  onClick={() => setTheme("dark")}
                  className={`p-2 rounded-lg transition-colors ${
                    theme === "dark"
                      ? "bg-accent text-content-inverse"
                      : "bg-surface-secondary hover:bg-surface-hover"
                  }`}>
                  <Moon className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Hidden files */}
            <div className="flex items-center justify-between p-4">
              <div>
                <p className="font-medium text-content">Show hidden files</p>
                <p className="text-sm text-content-secondary">
                  Display files starting with a dot
                </p>
              </div>
              <button
                onClick={() => setShowHiddenFiles(!showHiddenFiles)}
                className={`p-2 rounded-lg transition-colors ${
                  showHiddenFiles
                    ? "bg-accent text-content-inverse"
                    : "bg-surface-secondary hover:bg-surface-hover"
                }`}>
                {showHiddenFiles ? (
                  <Eye className="h-5 w-5" />
                ) : (
                  <EyeOff className="h-5 w-5" />
                )}
              </button>
            </div>
          </div>
        </section>

        {/* Storage section (admin only) */}
        {user?.isAdmin && (
          <section className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-content flex items-center gap-2">
                <HardDrive className="h-5 w-5" />
                Storage Mounts
              </h2>
              <Button
                size="sm"
                onClick={() => setShowAddMount(true)}
                leftIcon={<Plus className="h-4 w-4" />}>
                Add Mount
              </Button>
            </div>

            <div className="bg-surface border border-border rounded-lg divide-y divide-border">
              {isLoadingMounts ? (
                <div className="p-8 text-center">
                  <div className="animate-spin h-8 w-8 border-2 border-accent border-t-transparent rounded-full mx-auto" />
                </div>
              ) : mounts.length === 0 ? (
                <div className="p-8 text-center text-content-secondary">
                  No mounts configured. Add a mount to start browsing files.
                </div>
              ) : (
                mounts.map((mount) => (
                  <div key={mount.id} className="flex items-start gap-4 p-4">
                    <div className="p-2 rounded-lg bg-surface-secondary">
                      <HardDrive className="h-5 w-5 text-content-secondary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-content">{mount.label}</p>
                      <p className="text-sm text-content-secondary truncate">
                        {mount.path}
                      </p>
                      {mount.stats && (
                        <div className="mt-2">
                          <div className="h-1.5 bg-surface-secondary rounded-full overflow-hidden">
                            <div
                              className={`h-full ${
                                mount.stats.percentUsed > 90
                                  ? "bg-error"
                                  : mount.stats.percentUsed > 70
                                  ? "bg-warning"
                                  : "bg-accent"
                              }`}
                              style={{ width: `${mount.stats.percentUsed}%` }}
                            />
                          </div>
                          <p className="text-xs text-content-tertiary mt-1">
                            {formatFileSize(mount.stats.used)} used of{" "}
                            {formatFileSize(mount.stats.total)} (
                            {mount.stats.percentUsed}%)
                          </p>
                        </div>
                      )}
                      {!mount.accessible && (
                        <p className="text-sm text-error mt-1">
                          Mount not accessible
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => handleRemoveMount(mount.id)}
                      className="p-2 text-content-tertiary hover:text-error hover:bg-error-surface rounded-lg transition-colors">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </section>
        )}

        {/* About section */}
        <section>
          <h2 className="text-lg font-semibold text-content mb-4">About</h2>
          <div className="bg-surface border border-border rounded-lg p-4">
            <p className="text-content">Seeker File Browser</p>
            <p className="text-sm text-content-secondary">Version 1.0.0</p>
          </div>
        </section>
      </div>

      {/* Add Mount Dialog */}
      <Dialog
        isOpen={showAddMount}
        onClose={() => {
          setShowAddMount(false);
          setNewMountPath("");
          setNewMountLabel("");
          setAddMountError("");
        }}
        title="Add Storage Mount"
        size="sm">
        <form onSubmit={handleAddMount} className="space-y-4">
          <Input
            label="Path"
            value={newMountPath}
            onChange={(e) => setNewMountPath(e.target.value)}
            placeholder="/mnt/storage"
            hint="Absolute path to the directory"
          />

          <Input
            label="Label"
            value={newMountLabel}
            onChange={(e) => setNewMountLabel(e.target.value)}
            placeholder="My Storage"
            hint="Display name for this mount"
          />

          {addMountError && (
            <p className="text-sm text-error">{addMountError}</p>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowAddMount(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isAddingMount}>
              Add Mount
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
