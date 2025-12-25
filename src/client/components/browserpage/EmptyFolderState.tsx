// src/client/components/browserpage/EmptyFolderState.tsx
import { Folder, FolderPlus, SearchX } from "lucide-react";
import { Button } from "../common/Button";

interface EmptyFolderStateProps {
  onCreateFolder: () => void;
  searchQuery?: string;
}

export function EmptyFolderState({
  onCreateFolder,
  searchQuery
}: EmptyFolderStateProps) {
  // Show different UI when search returns no results
  if (searchQuery) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center">
        <SearchX className="h-16 w-16 text-content-tertiary mb-4" />
        <h3 className="text-lg font-medium text-content mb-1">
          No Results Found
        </h3>
        <p className="text-content-secondary mb-2">
          No files match your search
        </p>
        <p className="text-sm text-content-tertiary">"{searchQuery}"</p>
      </div>
    );
  }

  // Default empty folder state
  return (
    <div className="flex flex-col items-center justify-center h-full text-center">
      <Folder className="h-16 w-16 text-content-tertiary mb-4" />
      <h3 className="text-lg font-medium text-content mb-1">Empty Folder</h3>
      <p className="text-content-secondary mb-4">
        This folder doesn't contain any files yet.
      </p>
      <Button
        variant="secondary"
        onClick={onCreateFolder}
        leftIcon={<FolderPlus className="h-4 w-4" />}>
        Create Folder
      </Button>
    </div>
  );
}
