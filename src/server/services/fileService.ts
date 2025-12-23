// src/server/services/fileService.ts
import { $ } from "bun";
import { constants } from "fs";
import { access, mkdir, readdir, rename, rm, stat } from "fs/promises";
import { basename, dirname, extname, join } from "path";
import { db, schema } from "../db";
import type { SortBy, SortOrder } from "../db/schema";
import { getMimeType, sanitizeFilename } from "../utils";

const { mounts, fileMetadataCache } = schema;

/**
 * File item interface for API responses
 */
export interface FileItem {
  name: string;
  path: string;
  size: number;
  modifiedAt: Date;
  isDirectory: boolean;
  mimeType: string | null;
  extension: string;
  fileCount?: number;
  folderCount?: number;
}

/**
 * Pagination response interface
 */
export interface PaginatedFiles {
  items: FileItem[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
  _warning?: string; // Warning for large directories
}

/**
 * File operation result
 */
export interface FileOperationResult {
  success: boolean;
  error?: string;
  path?: string;
}

/**
 * Conflict action for copy/move operations
 */
export type ConflictAction = "overwrite" | "skip" | "rename";

/**
 * File Service
 * Handles all filesystem operations with security checks
 */
export class FileService {
  // Directory cache to improve pagination performance
  private directoryCache = new Map<
    string,
    { timestamp: number; entries: import("fs").Dirent[] }
  >();
  private readonly CACHE_TTL = 45 * 1000; // 45 seconds
  private readonly CACHE_MAX_SIZE = 20;

  // Single Collator instance for performance
  private readonly collator = new Intl.Collator(undefined, {
    numeric: true,
    sensitivity: "base"
  });

  /**
   * Check if a path is within an allowed mount
   */
  async isPathAllowed(targetPath: string): Promise<boolean> {
    const mountsList = await db.select().from(mounts);

    for (const mount of mountsList) {
      if (targetPath.startsWith(mount.path)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Validate a path is safe and within allowed mounts
   */
  async validatePath(targetPath: string): Promise<{
    valid: boolean;
    error?: string;
  }> {
    // Check for path traversal
    if (targetPath.includes("..")) {
      return { valid: false, error: "Invalid path" };
    }

    // Check if path is within allowed mounts
    const allowed = await this.isPathAllowed(targetPath);
    if (!allowed) {
      return { valid: false, error: "Access denied" };
    }

    return { valid: true };
  }

  /**
   * List directory contents with pagination and sorting
   * OPTIMIZED for directories with millions of files
   */
  async listDirectory(
    path: string,
    options: {
      page?: number;
      limit?: number;
      sortBy?: SortBy;
      sortOrder?: SortOrder;
      showHidden?: boolean;
      search?: string;
    } = {}
  ): Promise<PaginatedFiles> {
    const {
      page = 1,
      limit = 50,
      sortBy = "name",
      sortOrder = "asc",
      showHidden = true,
      search
    } = options;

    // Validate path
    const validation = await this.validatePath(path);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    // Check if path exists and is a directory
    const pathStat = await stat(path).catch(() => null);
    if (!pathStat || !pathStat.isDirectory()) {
      throw new Error("Directory not found or not a directory");
    }

    // Check cache
    const cacheKey = path;
    const cached = this.directoryCache.get(cacheKey);
    const now = Date.now();
    let entries: import("fs").Dirent[];

    if (
      cached &&
      now - cached.timestamp < this.CACHE_TTL &&
      options.page !== 1 // Always refresh on first page load or allow it? Let's cache even page 1
    ) {
      entries = cached.entries;
    } else {
      // Read directory entries (this is unavoidable but fast)
      entries = await readdir(path, { withFileTypes: true });

      // Update cache
      if (this.directoryCache.size >= this.CACHE_MAX_SIZE) {
        // Remove oldest
        const firstKey = this.directoryCache.keys().next().value;
        if (firstKey) this.directoryCache.delete(firstKey);
      }
      this.directoryCache.set(cacheKey, { timestamp: now, entries });
    }

    // Early filtering (cheap operations, no I/O)
    let filteredEntries = entries.filter((entry) => {
      if (!showHidden && entry.name.startsWith(".")) return false;
      if (search && !entry.name.toLowerCase().includes(search.toLowerCase()))
        return false;
      return true;
    });

    const total = filteredEntries.length;

    // === KEY OPTIMIZATION: Only stat what we need to display ===

    // For name-based sorting, we can paginate BEFORE stating
    if (sortBy === "name") {
      // Sort entries by name (cheap, no stat needed)
      filteredEntries.sort((a, b) => {
        // Directories first
        if (a.isDirectory() !== b.isDirectory()) {
          return a.isDirectory() ? -1 : 1;
        }
        const comparison = this.collator.compare(a.name, b.name);
        return sortOrder === "desc" ? -comparison : comparison;
      });

      // Paginate FIRST
      const startIndex = (page - 1) * limit;
      const pageEntries = filteredEntries.slice(startIndex, startIndex + limit);

      // ONLY stat the entries we're returning
      const items = await this.statEntries(path, pageEntries);

      return {
        items,
        total,
        page,
        limit,
        hasMore: startIndex + limit < total
      };
    }

    // For other sorts (date, size, type), we need stats
    // Use a smart limit to avoid timing out
    const MAX_ITEMS_TO_STAT = 10000; // Configurable threshold

    if (total > MAX_ITEMS_TO_STAT) {
      // Fallback: Sort by name and warn user
      filteredEntries.sort((a, b) => {
        if (a.isDirectory() !== b.isDirectory()) {
          return a.isDirectory() ? -1 : 1;
        }
        return this.collator.compare(a.name, b.name);
      });

      const startIndex = (page - 1) * limit;
      const pageEntries = filteredEntries.slice(startIndex, startIndex + limit);
      const items = await this.statEntries(path, pageEntries);

      return {
        items,
        total,
        page,
        limit,
        hasMore: startIndex + limit < total,
        _warning: `Directory too large (${total} items). Sorted by name only.`
      };
    }

    // For smaller directories, do full stat and sort
    const items = await this.statEntries(path, filteredEntries);
    const sortedItems = this.sortItems(items, sortBy, sortOrder);

    const startIndex = (page - 1) * limit;
    const paginatedItems = sortedItems.slice(startIndex, startIndex + limit);

    return {
      items: paginatedItems,
      total,
      page,
      limit,
      hasMore: startIndex + limit < total
    };
  }

  /**
   * Helper: Stat entries in parallel batches
   * Processes file stats in batches to avoid overwhelming the filesystem
   */
  private async statEntries(
    basePath: string,
    entries: import("fs").Dirent[]
  ): Promise<FileItem[]> {
    const BATCH_SIZE = 100;
    const items: FileItem[] = [];

    for (let i = 0; i < entries.length; i += BATCH_SIZE) {
      const batch = entries.slice(i, i + BATCH_SIZE);

      const batchResults = await Promise.allSettled(
        batch.map(async (entry) => {
          const fullPath = join(basePath, entry.name);
          const itemStat = await stat(fullPath);
          const isDir = entry.isDirectory();
          const ext = isDir ? "" : extname(entry.name).slice(1).toLowerCase();

          return {
            name: entry.name,
            path: fullPath,
            size: itemStat.size,
            modifiedAt: itemStat.mtime,
            isDirectory: isDir,
            mimeType: isDir ? null : getMimeType(entry.name),
            extension: ext
          };
        })
      );

      // Collect successful results
      for (const result of batchResults) {
        if (result.status === "fulfilled") {
          items.push(result.value);
        }
      }
    }

    return items;
  }

  /**
   * Sort file items
   */
  private sortItems(
    items: FileItem[],
    sortBy: SortBy,
    sortOrder: SortOrder
  ): FileItem[] {
    // Always put directories first
    const directories = items.filter((i) => i.isDirectory);
    const files = items.filter((i) => !i.isDirectory);

    const sortFn = (a: FileItem, b: FileItem): number => {
      let comparison = 0;

      switch (sortBy) {
        case "name":
          comparison = this.collator.compare(a.name, b.name);
          break;
        case "date":
          comparison =
            new Date(a.modifiedAt).getTime() - new Date(b.modifiedAt).getTime();
          break;
        case "size":
          comparison = a.size - b.size;
          break;
        case "type":
          comparison = this.collator.compare(
            a.extension || "",
            b.extension || ""
          );
          break;
        default:
          comparison = this.collator.compare(a.name, b.name);
      }

      return sortOrder === "desc" ? -comparison : comparison;
    };

    directories.sort(sortFn);
    files.sort(sortFn);

    return [...directories, ...files];
  }

  /**
   * Search for files recursively
   */
  async searchFiles(
    basePath: string,
    query: string,
    options: {
      recursive?: boolean;
      showHidden?: boolean;
      limit?: number;
    } = {}
  ): Promise<FileItem[]> {
    const { recursive = false, showHidden = true, limit = 100 } = options;

    // Validate path
    const validation = await this.validatePath(basePath);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    const results: FileItem[] = [];
    const searchLower = query.toLowerCase();

    const search = async (currentPath: string, depth: number = 0) => {
      if (results.length >= limit) return;
      if (!recursive && depth > 0) return;

      try {
        const entries = await readdir(currentPath, { withFileTypes: true });

        for (const entry of entries) {
          if (results.length >= limit) break;

          // Filter hidden files if needed
          if (!showHidden && entry.name.startsWith(".")) {
            continue;
          }

          const fullPath = join(currentPath, entry.name);
          const matches = entry.name.toLowerCase().includes(searchLower);

          if (matches) {
            try {
              const itemStat = await stat(fullPath);
              const isDir = entry.isDirectory();
              const ext = isDir
                ? ""
                : extname(entry.name).slice(1).toLowerCase();

              results.push({
                name: entry.name,
                path: fullPath,
                size: itemStat.size,
                modifiedAt: itemStat.mtime,
                isDirectory: isDir,
                mimeType: isDir ? null : getMimeType(entry.name),
                extension: ext
              });
            } catch {
              // Skip files we can't access
            }
          }

          // Recurse into directories
          if (entry.isDirectory() && recursive) {
            await search(fullPath, depth + 1);
          }
        }
      } catch {
        // Skip directories we can't access
      }
    };

    await search(basePath);
    return results;
  }

  /**
   * Calculate folder size recursively using Bun's native shell
   * Falls back to recursive node traversal if du fails
   */
  async getFolderSize(path: string): Promise<number> {
    // Validate path before using in shell command
    const validation = await this.validatePath(path);
    if (!validation.valid) {
      // Return 0 if path is invalid rather than throwing
      return 0;
    }

    try {
      // Use Bun's native shell with du -sk for cross-platform compatibility
      // Bun's $ template tag automatically escapes arguments, but we validate first for safety
      const output = await $`du -sk ${path}`.text();
      const match = output.match(/^(\d+)/);
      if (match) {
        return parseInt(match[1], 10) * 1024; // Convert KB to bytes
      }
    } catch (error) {
      console.warn("du command failed, falling back to recursive stat:", error);
    }

    // Fallback: Recursive Node.js calculation (slower but reliable)
    let totalSize = 0;
    try {
      const entries = await readdir(path, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = join(path, entry.name);
        if (entry.isDirectory()) {
          totalSize += await this.getFolderSize(fullPath);
        } else {
          const stats = await stat(fullPath);
          totalSize += stats.size;
        }
      }
    } catch {
      // Ignore errors for unreadable files/folders during recursion
    }
    return totalSize;
  }

  /**
   * Get recursive stats (size, file count, folder count)
   * Uses Bun's native shell API for better performance
   */
  async getRecursiveStats(
    path: string
  ): Promise<{ size: number; fileCount: number; folderCount: number }> {
    // Validate path before using in shell commands
    const validation = await this.validatePath(path);
    if (!validation.valid) {
      return { size: 0, fileCount: 0, folderCount: 0 };
    }

    try {
      // Use Bun's native shell API for parallel execution
      // Bun's $ template tag automatically escapes arguments, but we validate first for safety
      const [sizeOut, filesOut, foldersOut] = await Promise.all([
        $`du -sk ${path}`.text(),
        $`find ${path} -type f | wc -l`.text(),
        $`find ${path} -type d | wc -l`.text()
      ]);

      const size = parseInt(sizeOut.split(/\s+/)[0], 10) * 1024;
      const fileCount = parseInt(filesOut.trim(), 10);
      const folderCount = Math.max(0, parseInt(foldersOut.trim(), 10) - 1);

      return { size, fileCount, folderCount };
    } catch (error) {
      console.warn("Native stats failed:", error);
      return { size: 0, fileCount: 0, folderCount: 0 };
    }
  }

  /**
   * Get file or directory stats
   */
  async getStats(
    path: string,
    calculateSize: boolean = false
  ): Promise<FileItem | null> {
    const validation = await this.validatePath(path);
    if (!validation.valid) {
      return null;
    }

    try {
      const itemStat = await stat(path);
      const name = basename(path);
      const isDir = itemStat.isDirectory();
      const ext = isDir ? "" : extname(name).slice(1).toLowerCase();

      let size = itemStat.size;
      let fileCount: number | undefined;
      let folderCount: number | undefined;

      if (isDir && calculateSize) {
        const stats = await this.getRecursiveStats(path);
        size = stats.size;
        fileCount = stats.fileCount;
        folderCount = stats.folderCount;
      }

      return {
        name,
        path,
        size,
        modifiedAt: itemStat.mtime,
        isDirectory: isDir,
        mimeType: isDir ? null : getMimeType(name),
        extension: ext,
        fileCount,
        folderCount
      };
    } catch {
      return null;
    }
  }

  /**
   * Create a new folder
   */
  async createFolder(
    parentPath: string,
    folderName: string
  ): Promise<FileOperationResult> {
    const sanitizedName = sanitizeFilename(folderName);
    if (!sanitizedName) {
      return { success: false, error: "Invalid folder name" };
    }

    const newPath = join(parentPath, sanitizedName);

    const validation = await this.validatePath(newPath);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    try {
      await mkdir(newPath, { recursive: false });
      // Invalidate cache for parent directory
      this.directoryCache.delete(parentPath);
      return { success: true, path: newPath };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EEXIST") {
        return { success: false, error: "Folder already exists" };
      }
      return { success: false, error: "Failed to create folder" };
    }
  }

  async createFile(
    parentPath: string,
    fileName: string
  ): Promise<FileOperationResult> {
    const sanitizedName = sanitizeFilename(fileName);
    if (!sanitizedName) {
      return { success: false, error: "Invalid file name" };
    }

    const newPath = join(parentPath, sanitizedName);

    const validation = await this.validatePath(newPath);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    try {
      // Check if file already exists (equivalent to 'wx' flag)
      const exists = await this.exists(newPath);
      if (exists) {
        return { success: false, error: "File already exists" };
      }

      // Use Bun.write() - faster than fs.writeFile for creating empty files
      await Bun.write(newPath, "");
      // Invalidate cache for parent directory
      this.directoryCache.delete(parentPath);
      return { success: true, path: newPath };
    } catch (error) {
      return { success: false, error: "Failed to create file" };
    }
  }

  /**
   * Rename a file or folder
   */
  async rename(oldPath: string, newName: string): Promise<FileOperationResult> {
    const sanitizedName = sanitizeFilename(newName);
    if (!sanitizedName) {
      return { success: false, error: "Invalid name" };
    }

    const validation = await this.validatePath(oldPath);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    const parentDir = dirname(oldPath);
    const newPath = join(parentDir, sanitizedName);

    // Check if new path already exists
    try {
      await access(newPath);
      return { success: false, error: "A file with this name already exists" };
    } catch {
      // Path doesn't exist, which is what we want
    }

    try {
      await rename(oldPath, newPath);
      // Invalidate cache for both old and new parent directories
      this.directoryCache.delete(parentDir);
      this.directoryCache.delete(dirname(newPath));
      return { success: true, path: newPath };
    } catch {
      return { success: false, error: "Failed to rename" };
    }
  }

  /**
   * Delete files/folders
   */
  async delete(paths: string[]): Promise<{
    success: boolean;
    results: { path: string; success: boolean; error?: string }[];
  }> {
    const results: { path: string; success: boolean; error?: string }[] = [];

    for (const path of paths) {
      const validation = await this.validatePath(path);
      if (!validation.valid) {
        results.push({ path, success: false, error: validation.error });
        continue;
      }

      try {
        await rm(path, { recursive: true });
        results.push({ path, success: true });
        // Invalidate cache
        this.directoryCache.delete(dirname(path));
      } catch (error) {
        results.push({ path, success: false, error: "Failed to delete" });
      }
    }

    const allSuccess = results.every((r) => r.success);
    return { success: allSuccess, results };
  }

  /**
   * Copy files/folders
   */
  async copy(
    sourcePaths: string[],
    destinationDir: string,
    conflictAction: ConflictAction = "rename"
  ): Promise<{
    success: boolean;
    results: {
      source: string;
      destination: string;
      success: boolean;
      error?: string;
    }[];
  }> {
    const results: {
      source: string;
      destination: string;
      success: boolean;
      error?: string;
    }[] = [];

    // Validate destination
    const destValidation = await this.validatePath(destinationDir);
    if (!destValidation.valid) {
      return {
        success: false,
        results: sourcePaths.map((p) => ({
          source: p,
          destination: "",
          success: false,
          error: destValidation.error
        }))
      };
    }

    for (const sourcePath of sourcePaths) {
      const validation = await this.validatePath(sourcePath);
      if (!validation.valid) {
        results.push({
          source: sourcePath,
          destination: "",
          success: false,
          error: validation.error
        });
        continue;
      }

      const fileName = basename(sourcePath);
      let destinationPath = join(destinationDir, fileName);

      // Handle conflicts
      try {
        await access(destinationPath);
        // File exists, handle conflict
        if (conflictAction === "skip") {
          results.push({
            source: sourcePath,
            destination: destinationPath,
            success: true,
            error: "Skipped (file exists)"
          });
          continue;
        } else if (conflictAction === "rename") {
          destinationPath = await this.getUniqueFilename(
            destinationDir,
            fileName
          );
        }
        // "overwrite" action continues with same path
      } catch {
        // File doesn't exist, continue normally
      }

      try {
        await this.copyRecursive(sourcePath, destinationPath);
        results.push({
          source: sourcePath,
          destination: destinationPath,
          success: true
        });
        // Invalidate cache
        this.directoryCache.delete(destinationDir);
      } catch (error) {
        results.push({
          source: sourcePath,
          destination: destinationPath,
          success: false,
          error: "Failed to copy"
        });
      }
    }

    const allSuccess = results.every((r) => r.success);
    return { success: allSuccess, results };
  }

  /**
   * Move files/folders
   */
  async move(
    sourcePaths: string[],
    destinationDir: string,
    conflictAction: ConflictAction = "rename"
  ): Promise<{
    success: boolean;
    results: {
      source: string;
      destination: string;
      success: boolean;
      error?: string;
    }[];
  }> {
    const results: {
      source: string;
      destination: string;
      success: boolean;
      error?: string;
    }[] = [];

    // Validate destination
    const destValidation = await this.validatePath(destinationDir);
    if (!destValidation.valid) {
      return {
        success: false,
        results: sourcePaths.map((p) => ({
          source: p,
          destination: "",
          success: false,
          error: destValidation.error
        }))
      };
    }

    for (const sourcePath of sourcePaths) {
      const validation = await this.validatePath(sourcePath);
      if (!validation.valid) {
        results.push({
          source: sourcePath,
          destination: "",
          success: false,
          error: validation.error
        });
        continue;
      }

      const fileName = basename(sourcePath);
      let destinationPath = join(destinationDir, fileName);

      // Handle conflicts
      try {
        await access(destinationPath);
        // File exists, handle conflict
        if (conflictAction === "skip") {
          results.push({
            source: sourcePath,
            destination: destinationPath,
            success: true,
            error: "Skipped (file exists)"
          });
          continue;
        } else if (conflictAction === "rename") {
          destinationPath = await this.getUniqueFilename(
            destinationDir,
            fileName
          );
        }
        // "overwrite" action - delete existing first
        else if (conflictAction === "overwrite") {
          await rm(destinationPath, { recursive: true });
        }
      } catch {
        // File doesn't exist, continue normally
      }

      try {
        await rename(sourcePath, destinationPath);
        results.push({
          source: sourcePath,
          destination: destinationPath,
          success: true
        });
        // Invalidate cache
        this.directoryCache.delete(dirname(sourcePath));
        this.directoryCache.delete(destinationDir);
      } catch {
        // If rename fails (cross-device), try copy + delete
        try {
          await this.copyRecursive(sourcePath, destinationPath);
          await rm(sourcePath, { recursive: true });
          results.push({
            source: sourcePath,
            destination: destinationPath,
            success: true
          });
          // Invalidate cache
          this.directoryCache.delete(dirname(sourcePath));
          this.directoryCache.delete(destinationDir);
        } catch {
          results.push({
            source: sourcePath,
            destination: destinationPath,
            success: false,
            error: "Failed to move"
          });
        }
      }
    }

    const allSuccess = results.every((r) => r.success);
    return { success: allSuccess, results };
  }

  /**
   * Copy a file or directory recursively
   * Uses Bun.write() and Bun.file() for better performance than Node.js copyFile
   */
  private async copyRecursive(
    source: string,
    destination: string
  ): Promise<void> {
    const sourceStat = await stat(source);

    if (sourceStat.isDirectory()) {
      await mkdir(destination, { recursive: true });
      const entries = await readdir(source);

      for (const entry of entries) {
        await this.copyRecursive(join(source, entry), join(destination, entry));
      }
    } else {
      // Use Bun.write() with Bun.file() - significantly faster than Node.js copyFile
      await Bun.write(destination, Bun.file(source));
    }
  }

  /**
   * Get a unique filename if file already exists
   */
  private async getUniqueFilename(
    dir: string,
    filename: string
  ): Promise<string> {
    const ext = extname(filename);
    const nameWithoutExt = filename.slice(0, -ext.length || undefined);
    let counter = 1;
    let newPath = join(dir, filename);

    while (true) {
      try {
        await access(newPath);
        // File exists, try next number
        newPath = join(dir, `${nameWithoutExt} (${counter})${ext}`);
        counter++;
      } catch {
        // File doesn't exist, use this name
        return newPath;
      }
    }
  }

  /**
   * Get a readable stream for file download
   * Uses Bun.file().stream() for better performance with Bun's optimized I/O
   */
  async getFileStream(path: string): Promise<{
    stream: ReadableStream<Uint8Array>;
    stat: Awaited<ReturnType<typeof stat>>;
    mimeType: string;
  } | null> {
    const validation = await this.validatePath(path);
    if (!validation.valid) {
      return null;
    }

    try {
      const fileStat = await stat(path);
      if (fileStat.isDirectory()) {
        return null;
      }

      // Use Bun.file().stream() - faster than createReadStream with Bun's optimized I/O
      const bunFile = Bun.file(path);
      const stream = bunFile.stream();
      const mimeType = getMimeType(basename(path));

      return { stream, stat: fileStat, mimeType };
    } catch {
      return null;
    }
  }

  /**
   * Check if a path exists
   */
  async exists(path: string): Promise<boolean> {
    try {
      await access(path, constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }
}

// Export singleton instance
export const fileService = new FileService();
