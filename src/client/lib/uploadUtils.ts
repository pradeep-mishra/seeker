import type { UploadItem } from "./api";

export interface UploadCollectionResult {
  items: UploadItem[];
  isUnsupportedDirectory?: boolean;
}

const normalizeRelativePath = (input?: string | null): string | undefined => {
  if (!input) return undefined;
  const normalized = input.replace(/\\/g, "/").replace(/^\/+/, "");
  return normalized.length > 0 ? normalized : undefined;
};

export function buildUploadItemsFromFileList(files: File[]): UploadItem[] {
  return files.map((file) => {
    const withRelativePath = file as File & { webkitRelativePath?: string };
    const relativePath = normalizeRelativePath(
      withRelativePath.webkitRelativePath
    );
    return relativePath ? { file, relativePath } : { file };
  });
}

type DataTransferItemWithWebkit = DataTransferItem & {
  webkitGetAsEntry?: () => FileSystemEntry | null;
};

const getFileFromEntry = (entry: FileSystemFileEntry): Promise<File> =>
  new Promise((resolve, reject) => {
    entry.file(
      (file) => resolve(file),
      (error) => reject(error ?? new DOMException("Failed to read file entry"))
    );
  });

const readAllDirectoryEntries = (
  reader: FileSystemDirectoryReader
): Promise<FileSystemEntry[]> =>
  new Promise((resolve, reject) => {
    const entries: FileSystemEntry[] = [];

    const readBatch = () => {
      reader.readEntries(
        (batch) => {
          if (!batch.length) {
            resolve(entries);
            return;
          }
          entries.push(...batch);
          readBatch();
        },
        (error) =>
          reject(error ?? new DOMException("Failed to read directory entries"))
      );
    };

    readBatch();
  });

async function traverseEntry(
  entry: FileSystemEntry,
  parentPath: string,
  results: UploadItem[]
): Promise<void> {
  const nextParent = parentPath ? `${parentPath}/${entry.name}` : entry.name;

  if (entry.isFile) {
    const file = await getFileFromEntry(entry as FileSystemFileEntry);
    const relativePath = parentPath
      ? normalizeRelativePath(nextParent)
      : undefined;

    results.push({
      file,
      relativePath
    });
    return;
  }

  const directoryEntry = entry as FileSystemDirectoryEntry;
  const children = await readAllDirectoryEntries(directoryEntry.createReader());
  for (const child of children) {
    await traverseEntry(child, nextParent, results);
  }
}

export async function collectUploadItemsFromDataTransfer(
  dataTransfer: DataTransfer
): Promise<UploadCollectionResult> {
  const items = Array.from(dataTransfer.items || []).filter(
    (item) => item.kind === "file"
  );
  const entries = items
    .map(
      (item) =>
        (item as DataTransferItemWithWebkit).webkitGetAsEntry?.() ?? null
    )
    .filter(
      (entry): entry is FileSystemEntry => entry !== null && entry !== undefined
    );

  if (entries.length === 0) {
    const filesList = Array.from(dataTransfer.files ?? []);
    return {
      items: buildUploadItemsFromFileList(filesList),
      isUnsupportedDirectory:
        items.length > 0 &&
        filesList.length === 0 &&
        (dataTransfer.items?.length ?? 0) > 0
    };
  }

  const results: UploadItem[] = [];
  for (const entry of entries) {
    await traverseEntry(entry, "", results);
  }
  return { items: results };
}
