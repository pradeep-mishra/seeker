import { ChevronRight, Home } from "lucide-react";
import { getMountRelativePath, parsePath } from "../../lib/utils";
import { useFileStore } from "../../stores/fileStore";
import { useUIStore } from "../../stores/uiStore";

interface BreadcrumbProps {
  isVirtualView?: boolean;
}

export function Breadcrumb({ isVirtualView = false }: BreadcrumbProps) {
  if (isVirtualView) {
    return null;
  }

  const {
    currentPath,
    currentMount,
    navigateToPath,
    goBack,
    goForward,
    canGoBack,
    canGoForward
  } = useFileStore();
  const { currentMountTitle } = useUIStore();
  const mountTitle = currentMount?.label || currentMountTitle || "";

  // Get path relative to mount root
  const relativePath = currentMount
    ? getMountRelativePath(currentPath, currentMount.path)
    : currentPath;

  const segments = relativePath ? parsePath(relativePath) : [];

  const handleNavigate = (index: number) => {
    // Build absolute path from mount root
    if (currentMount) {
      const relativePath = "/" + segments.slice(0, index + 1).join("/");
      const absolutePath = currentMount.path + relativePath;
      navigateToPath(absolutePath);
    } else {
      const path = "/" + segments.slice(0, index + 1).join("/");
      navigateToPath(path);
    }
  };

  const handleNavigateToRoot = () => {
    if (currentMount) {
      navigateToPath(currentMount.path);
    }
  };

  return (
    <div className="flex items-center gap-1 min-w-0">
      {/* Back/Forward buttons
      <div className="flex items-center shrink-0">
        <button
          onClick={goBack}
          disabled={!canGoBack()}
          className="p-1.5 rounded hover:bg-surface-hover disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          aria-label="Go back">
          <ChevronLeft className="h-4 w-4 text-content-secondary" />
        </button>
        <button
          onClick={goForward}
          disabled={!canGoForward()}
          className="p-1.5 rounded hover:bg-surface-hover disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          aria-label="Go forward">
          <Forward className="h-4 w-4 text-content-secondary" />
        </button>
      </div>
       */}

      {/* Breadcrumb path */}
      <div className="flex items-center min-w-0 overflow-hidden">
        {segments.length === 0 ? (
          <ol className="flex items-center min-w-0">
            {/* Home button */}
            <li className="flex items-center shrink-0">
              <button
                onClick={handleNavigateToRoot}
                className="p-1.5 rounded hover:bg-surface-hover transition-colors select-none flex items-center gap-1"
                title={mountTitle}
                aria-label="Go to root">
                <Home className="h-4 w-4 text-content-secondary" />
                <span className="text-sm truncate select-none">
                  {mountTitle}
                </span>
              </button>
            </li>
          </ol>
        ) : (
          <nav className="flex items-center min-w-0" aria-label="Breadcrumb">
            <ol className="flex items-center min-w-0">
              {/* Home button */}
              <li className="flex items-center shrink-0">
                <button
                  onClick={handleNavigateToRoot}
                  className="p-1.5 rounded hover:bg-surface-hover transition-colors select-none flex items-center gap-1"
                  title={mountTitle}
                  aria-label="Go to root">
                  <Home className="h-4 w-4 text-content-secondary" />
                  <span className="text-sm truncate select-none">
                    {mountTitle}
                  </span>
                </button>
              </li>

              {segments.map((segment, index) => {
                const isLast = index === segments.length - 1;

                return (
                  <li key={index} className="flex items-center min-w-0">
                    <ChevronRight className="h-4 w-4 text-content-tertiary shrink-0 mx-1" />
                    <button
                      onClick={() => handleNavigate(index)}
                      className={`
                        px-2 py-1 rounded text-sm truncate max-w-[200px]
                        transition-colors select-none
                        ${
                          isLast
                            ? "font-medium text-content bg-surface-hover"
                            : "text-content-secondary hover:text-content hover:bg-surface-hover"
                        }
                      `}
                      title={segment}>
                      {segment}
                    </button>
                  </li>
                );
              })}
            </ol>
          </nav>
        )}
      </div>
    </div>
  );
}
