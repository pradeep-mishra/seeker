import type { FileItem, VirtualCollectionItem } from "./api";

export function isVirtualFileItem(
  item: FileItem
): item is VirtualCollectionItem {
  return Boolean(
    (item as Partial<VirtualCollectionItem>).virtualCollectionId &&
      typeof (item as Partial<VirtualCollectionItem>).virtualCollectionId ===
        "string"
  );
}
