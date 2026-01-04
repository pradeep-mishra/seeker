import type { FileItem } from "../../lib/api";
import { LoadingSpinner } from "../common/LoadingScreen";
import { FileCardView } from "../files/FileCardView";
import { FileListView } from "../files/FileListView";
import { FileThumbnailView } from "../files/FileThumbnailView";
import { EmptyFolderState } from "./EmptyFolderState";

interface FileListContainerProps {
  files: FileItem[];
  isLoading: boolean;
  hasMore: boolean;
  viewMode: "list" | "thumbnail" | "card";
  containerRef: React.Ref<HTMLDivElement>;
  loadMoreTriggerRef: React.Ref<HTMLDivElement>;
  onContextMenu: (e: React.MouseEvent) => void;
  onMouseDown: (e: React.MouseEvent) => void;
  onCreateFolder: () => void;
  searchQuery?: string;
  emptyVariant?: "default" | "virtual";
}

export function FileListContainer({
  files,
  isLoading,
  hasMore,
  viewMode,
  containerRef,
  loadMoreTriggerRef,
  onContextMenu,
  onMouseDown,
  onCreateFolder,
  searchQuery,
  emptyVariant = "default"
}: FileListContainerProps) {
  return (
    <div
      ref={containerRef}
      className="flex flex-col flex-1 overflow-y-auto overflow-x-hidden p-4 relative"
      onContextMenu={onContextMenu}
      onMouseDown={onMouseDown}>
      {isLoading && files.length === 0 ? (
        <div className="flex items-center justify-center h-full">
          <LoadingSpinner size="lg" />
        </div>
      ) : files.length === 0 ? (
        <EmptyFolderState
          onCreateFolder={onCreateFolder}
          searchQuery={searchQuery}
          variant={emptyVariant}
        />
      ) : (
        <>
          <div className="flex-1 relative">
            {viewMode === "list" && <FileListView files={files} />}
            {viewMode === "thumbnail" && <FileThumbnailView files={files} />}
            {viewMode === "card" && <FileCardView files={files} />}
          </div>
          {/* Infinite scroll trigger and loading indicator */}
          {hasMore && (
            <div
              ref={loadMoreTriggerRef}
              className="flex items-center justify-center py-8">
              {isLoading && (
                <div className="flex items-center gap-2 text-content-secondary">
                  <LoadingSpinner size="sm" />
                  <span className="text-sm">Loading more items...</span>
                </div>
              )}
            </div>
          )}

          {/* End of list indicator */}
          {!hasMore && files.length > 0 && (
            <div className="flex items-center justify-center py-6 text-content-tertiary text-sm select-none">
              All items loaded
            </div>
          )}
        </>
      )}
    </div>
  );
}
