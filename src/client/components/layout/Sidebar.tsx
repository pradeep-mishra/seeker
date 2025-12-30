import { Clock, HardDrive, Settings, Star, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  mountsApi,
  recentApi,
  type Mount,
  type RecentLocation
} from "../../lib/api";
import { formatFileSize } from "../../lib/utils";
import { useAuthStore } from "../../stores/authStore";
import { useBookmarkStore } from "../../stores/bookmarkStore";
import { useFileStore } from "../../stores/fileStore";
import { useUIStore } from "../../stores/uiStore";

export function Sidebar() {
  const navigate = useNavigate();
  const { isSidebarOpen, mountsRefreshKey, setSidebarOpen } = useUIStore();
  const { navigateToPath, currentPath } = useFileStore();
  const { user } = useAuthStore();
  const {
    bookmarks,
    loadBookmarks,
    removeBookmark,
    isLoading: bookmarksLoading
  } = useBookmarkStore();

  const [mounts, setMounts] = useState<Mount[]>([]);
  const [recentLocations, setRecentLocations] = useState<RecentLocation[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load sidebar data
  useEffect(() => {
    const loadData = async () => {
      try {
        const [mountsRes, recentRes] = await Promise.all([
          mountsApi.list(),
          recentApi.list(10),
          loadBookmarks()
        ]);

        setMounts(mountsRes.mounts);
        setRecentLocations(recentRes.recent);
      } catch (error) {
        console.error("Failed to load sidebar data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [loadBookmarks, mountsRefreshKey]);

  const findMountForPath = (path: string): Mount | null => {
    // Find the mount that this path belongs to
    for (const mount of mounts) {
      if (path.startsWith(mount.path)) {
        return mount;
      }
    }
    return null;
  };

  const handleNavigate = (path: string, mount?: Mount | null) => {
    // If mount not provided, try to find it
    const targetMount = mount !== undefined ? mount : findMountForPath(path);
    navigateToPath(path, targetMount);
    navigate("/");

    // Close sidebar on mobile after navigation
    if (window.innerWidth < 768) {
      setSidebarOpen(false);
    }
  };

  const getPathName = (path: string) => {
    const parts = path.split("/").filter(Boolean);
    return parts[parts.length - 1] || path;
  };

  return (
    <>
      {/* Backdrop overlay for mobile */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`border-r border-border bg-surface-secondary flex flex-col shrink-0 overflow-hidden transition-all duration-300 ease-in-out
          fixed md:relative inset-y-0 left-0 z-50 md:z-auto
          ${isSidebarOpen ? "w-64" : "w-0 border-r-0"}
          ${
            isSidebarOpen
              ? "translate-x-0"
              : "-translate-x-full md:translate-x-0"
          }
        `}>
        {/* Mounts section */}
        <div className="p-3 border-b border-border">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-semibold text-content-tertiary uppercase tracking-wider">
              Storage
            </h3>
            {user?.isAdmin && (
              <button
                onClick={() => {
                  navigate("/settings");
                  if (window.innerWidth < 768) {
                    setSidebarOpen(false);
                  }
                }}
                className="p-1 rounded hover:bg-surface-hover transition-colors"
                title="Settings">
                <Settings className="h-3.5 w-3.5 text-content-tertiary" />
              </button>
            )}
          </div>

          {isLoading ? (
            <div className="space-y-2">
              {[1, 2].map((i) => (
                <div key={i} className="h-12 rounded-lg skeleton" />
              ))}
            </div>
          ) : mounts.length === 0 ? (
            <div className="text-sm text-content-tertiary p-2 text-center">
              No mounts configured
            </div>
          ) : (
            <div className="space-y-1">
              {mounts.map((mount) => (
                <button
                  key={mount.id}
                  onClick={() => handleNavigate(mount.path, mount)}
                  className={`w-full flex items-start gap-3 p-2 rounded-lg transition-colors text-left ${
                    currentPath?.startsWith(mount.path)
                      ? "bg-accent/10 text-accent"
                      : "hover:bg-surface-hover text-content"
                  }`}>
                  <HardDrive className="h-5 w-5 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{mount.label}</p>
                    {mount.stats && (
                      <div className="mt-1">
                        <div className="h-1.5 bg-surface rounded-full overflow-hidden border border-[#eeeeee]">
                          <div
                            className={`h-full transition-all ${
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
                          {formatFileSize(mount.stats.free)} free of{" "}
                          {formatFileSize(mount.stats.total)}
                        </p>
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Bookmarks section */}
        <div className="p-3 border-b border-border">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-semibold text-content-tertiary uppercase tracking-wider">
              Quick Access
            </h3>
          </div>

          {isLoading || bookmarksLoading ? (
            <div className="space-y-1">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-8 rounded skeleton" />
              ))}
            </div>
          ) : bookmarks.length === 0 ? (
            <div className="text-sm text-content-tertiary p-2 text-center">
              No bookmarks yet
            </div>
          ) : (
            <div className="space-y-0.5">
              {bookmarks.map((bookmark) => (
                <div key={bookmark.id} className="relative group">
                  <button
                    onClick={() => handleNavigate(bookmark.path)}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm transition-colors ${
                      currentPath === bookmark.path
                        ? "bg-accent/10 text-accent"
                        : "group-hover:bg-surface-hover text-content"
                    }`}>
                    <Star className="h-4 w-4 text-warning shrink-0" />
                    <span className="truncate pr-6">{bookmark.name}</span>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeBookmark(bookmark.id);
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-surface-active transition-opacity"
                    title="Remove bookmark">
                    <X className="h-3.5 w-3.5 text-content-tertiary hover:text-error" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent locations section */}
        <div className="flex-1 overflow-y-auto p-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-semibold text-content-tertiary uppercase tracking-wider">
              Recent
            </h3>
            {recentLocations.length > 0 && (
              <button
                onClick={async () => {
                  await recentApi.clear();
                  setRecentLocations([]);
                }}
                className="p-1 rounded hover:bg-surface-hover transition-colors"
                title="Clear recent">
                <Trash2 className="h-3.5 w-3.5 text-content-tertiary" />
              </button>
            )}
          </div>

          {isLoading ? (
            <div className="space-y-1">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-8 rounded skeleton" />
              ))}
            </div>
          ) : recentLocations.length === 0 ? (
            <div className="text-sm text-content-tertiary p-2 text-center">
              No recent locations
            </div>
          ) : (
            <div className="space-y-0.5">
              {recentLocations.map((location) => (
                <button
                  key={location.id}
                  onClick={() => handleNavigate(location.path)}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm transition-colors ${
                    currentPath === location.path
                      ? "bg-accent/10 text-accent"
                      : "hover:bg-surface-hover text-content"
                  }`}>
                  <Clock className="h-4 w-4 text-content-tertiary shrink-0" />
                  <span className="truncate">{getPathName(location.path)}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
