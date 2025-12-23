import { eq, lt } from "drizzle-orm";
import { open, rename, unlink } from "fs/promises";
import { basename, dirname, extname, join } from "path";
import { db, schema } from "../db";
import { generateId } from "../utils";
import { fileService } from "./fileService";

export class UploadService {
  // Use 10MB chunks to match client configuration
  private readonly CHUNK_SIZE = 10 * 1024 * 1024;
  private readonly CLEANUP_INTERVAL = 60 * 60 * 1000; // 1 hour
  private lastCleanup = 0;

  // In-memory locks to prevent race conditions when updating uploadedChunks JSON
  private updateLocks = new Map<string, Promise<void>>();

  constructor() {
    // Run cleanup on startup
    this.cleanupStaleUploads().catch(console.error);
  }

  /**
   * Helper to execute code with a lock for a specific uploadId
   */
  private async withLock<T>(
    uploadId: string,
    fn: () => Promise<T>
  ): Promise<T> {
    const currentLock = this.updateLocks.get(uploadId) || Promise.resolve();

    // Create a new promise that chains onto the current lock
    const nextLock = currentLock.then(async () => {
      try {
        return await fn();
      } catch (err) {
        throw err;
      }
    });

    // Update the lock map (we catch errors so the chain doesn't break for future calls)
    this.updateLocks.set(
      uploadId,
      nextLock.then(() => {}).catch(() => {})
    );

    return nextLock;
  }

  /**
   * Clean up stale uploads (older than 24 hours)
   */
  async cleanupStaleUploads(): Promise<void> {
    this.lastCleanup = Date.now();
    try {
      const MAX_AGE = 24 * 60 * 60 * 1000; // 24 hours
      const cutoffDate = new Date(Date.now() - MAX_AGE);

      // Find expired uploads in DB
      const expiredUploads = await db
        .select()
        .from(schema.uploads)
        .where(lt(schema.uploads.createdAt, cutoffDate));

      for (const upload of expiredUploads) {
        try {
          console.log(
            `Cleaning up stale upload: ${upload.originalName} (${upload.id})`
          );

          // Delete the partial file if it exists
          try {
            const exists = await fileService.exists(upload.filePath);
            if (exists) {
              await unlink(upload.filePath);
            }
          } catch (err) {
            console.error(
              `Failed to delete partial file ${upload.filePath}:`,
              err
            );
          }

          // Delete from DB
          await db
            .delete(schema.uploads)
            .where(eq(schema.uploads.id, upload.id));
        } catch (err) {
          console.error(`Failed to cleanup upload ${upload.id}:`, err);
        }
      }

      // Also scan for orphaned .partial files in common directories?
      // This is harder with direct-to-destination. We rely on DB.
    } catch (error) {
      console.error("Failed to cleanup stale uploads:", error);
    }
  }

  /**
   * Initialize a new upload session
   * Creates the file at the destination with .partial extension
   */
  async initUpload(
    path: string,
    filename: string,
    totalChunks: number
  ): Promise<{ uploadId: string }> {
    // Lazy cleanup
    if (Date.now() - this.lastCleanup > this.CLEANUP_INTERVAL) {
      this.cleanupStaleUploads().catch(console.error);
    }

    // Validate destination path
    const validation = await fileService.validatePath(path);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    // Determine final path and handle conflicts
    let targetPath = join(path, filename);
    const exists = await fileService.exists(targetPath);

    if (exists) {
      // Generate unique name
      const ext = extname(filename);
      const nameWithoutExt = basename(filename, ext);
      const uniqueName = `${nameWithoutExt}_${generateId(6)}${ext}`;
      targetPath = join(path, uniqueName);
    }

    // Append .partial for the temporary file
    const partialPath = `${targetPath}.partial`;

    // Ensure the partial file doesn't already exist (highly unlikely with unique ID, but possible)
    if (await fileService.exists(partialPath)) {
      // If it exists, it might be a stale upload or collision.
      // We'll generate a new unique name to be safe.
      const ext = extname(filename);
      const nameWithoutExt = basename(filename, ext);
      const uniqueName = `${nameWithoutExt}_${generateId(8)}${ext}`;
      targetPath = join(path, uniqueName);
      // partialPath will be updated
    }

    const finalPartialPath = `${targetPath}.partial`;

    // Create the empty file
    // Using 'w' flag ensures we create/truncate
    const handle = await open(finalPartialPath, "w");
    await handle.close();

    const uploadId = generateId();

    // Store in DB
    await db.insert(schema.uploads).values({
      id: uploadId,
      filePath: finalPartialPath,
      originalName: filename,
      totalChunks: totalChunks,
      uploadedChunks: "[]",
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      createdAt: new Date()
    });

    return { uploadId };
  }

  /**
   * Save a chunk of the file directly to the destination
   */
  async saveChunk(
    uploadId: string,
    chunkIndex: number,
    chunk: Blob
  ): Promise<boolean> {
    // Get upload info from DB
    const [upload] = await db
      .select()
      .from(schema.uploads)
      .where(eq(schema.uploads.id, uploadId));

    if (!upload) {
      throw new Error("Upload session not found or expired");
    }

    const filePath = upload.filePath;

    // Check if file still exists
    const exists = await fileService.exists(filePath);
    if (!exists) {
      throw new Error("Upload file not found on disk");
    }

    // Calculate position
    const position = chunkIndex * this.CHUNK_SIZE;
    const buffer = await chunk.arrayBuffer();

    // Write chunk at offset
    // Using fs.open with r+ for random access write
    let handle;
    try {
      handle = await open(filePath, "r+");
      await handle.write(
        new Uint8Array(buffer),
        0,
        buffer.byteLength,
        position
      );
    } finally {
      if (handle) await handle.close();
    }

    // Update DB (thread-safe using lock)
    await this.withLock(uploadId, async () => {
      // Re-fetch to get latest state
      const [currentUpload] = await db
        .select()
        .from(schema.uploads)
        .where(eq(schema.uploads.id, uploadId));

      if (!currentUpload) return;

      const chunks = JSON.parse(
        currentUpload.uploadedChunks as string
      ) as number[];
      if (!chunks.includes(chunkIndex)) {
        chunks.push(chunkIndex);
        chunks.sort((a, b) => a - b);

        await db
          .update(schema.uploads)
          .set({ uploadedChunks: JSON.stringify(chunks) })
          .where(eq(schema.uploads.id, uploadId));
      }
    });

    return true;
  }

  /**
   * Check which chunks have been uploaded
   */
  async getUploadedChunks(uploadId: string): Promise<number[]> {
    const [upload] = await db
      .select()
      .from(schema.uploads)
      .where(eq(schema.uploads.id, uploadId));

    if (!upload) return [];

    try {
      return JSON.parse(upload.uploadedChunks as string);
    } catch {
      return [];
    }
  }

  /**
   * Finalize the upload: rename .partial to final filename
   */
  async finalizeUpload(
    uploadId: string,
    _path: string, // Unused, we rely on DB
    _filename: string // Unused, we rely on DB
  ): Promise<{ success: boolean; path?: string; error?: string }> {
    const [upload] = await db
      .select()
      .from(schema.uploads)
      .where(eq(schema.uploads.id, uploadId));

    if (!upload) {
      return { success: false, error: "Upload session not found" };
    }

    try {
      const chunks = JSON.parse(upload.uploadedChunks as string) as number[];

      // Verify all chunks
      if (chunks.length !== upload.totalChunks) {
        return {
          success: false,
          error: `Incomplete upload: ${chunks.length}/${upload.totalChunks} chunks`
        };
      }

      const partialPath = upload.filePath;
      // Target path is partial path without the .partial suffix
      const targetPath = partialPath.slice(0, -8); // Remove .partial

      // Check if target path already exists (collision happened during upload)
      let finalPath = targetPath;
      if (await fileService.exists(targetPath)) {
        // Renaming strategy for final collision
        const ext = extname(targetPath);
        const nameWithoutExt = basename(targetPath, ext);
        const uniqueName = `${nameWithoutExt}_${generateId(4)}${ext}`;
        finalPath = join(dirname(targetPath), uniqueName);
      }

      // Rename .partial to final
      await rename(partialPath, finalPath);

      // Clean up DB
      await db.delete(schema.uploads).where(eq(schema.uploads.id, uploadId));
      this.updateLocks.delete(uploadId);

      return { success: true, path: finalPath };
    } catch (error) {
      console.error(`Finalize failed for ${uploadId}:`, error);
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Cancel/Cleanup an upload
   */
  async cancelUpload(uploadId: string): Promise<void> {
    const [upload] = await db
      .select()
      .from(schema.uploads)
      .where(eq(schema.uploads.id, uploadId));

    if (upload) {
      if (await fileService.exists(upload.filePath)) {
        await unlink(upload.filePath);
      }
      await db.delete(schema.uploads).where(eq(schema.uploads.id, uploadId));
      this.updateLocks.delete(uploadId);
    }
  }
}

export const uploadService = new UploadService();
