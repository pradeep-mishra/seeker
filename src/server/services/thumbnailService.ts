// src/server/services/thumbnailService.ts
import { eq } from "drizzle-orm";
import sharp from "sharp";
import { thumbDb, thumbSchema } from "../db";
import { getMimeType } from "../utils";
import { fileService } from "./fileService";

// PDF rendering - using system command approach for better Bun compatibility
// No native modules required - uses pdftoppm from poppler-utils
import { $ } from "bun";

const { thumbnails } = thumbSchema;

/**
 * Thumbnail configuration
 */
const THUMBNAIL_CONFIG = {
  width: 200,
  height: 200,
  fit: "cover" as const,
  format: "webp" as const,
  quality: 80
};

/**
 * PDF rendering configuration
 */
const PDF_RENDER_CONFIG = {
  scale: 2.0, // Higher scale for better quality
  maxRenderTime: 30000 // 30 seconds timeout
};

/**
 * Supported image formats for thumbnail generation
 */
const SUPPORTED_FORMATS = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/bmp",
  "image/tiff"
]);

/**
 * Supported PDF format for thumbnail generation
 */
const PDF_MIME_TYPE = "application/pdf";

/**
 * Thumbnail Service
 * Handles thumbnail generation and caching for images and PDFs
 */
export class ThumbnailService {
  // Cache for PDF tool availability check (lazy initialization)
  private pdfToolAvailable: boolean | null = null;

  /**
   * Check if pdftoppm command is available (cached)
   */
  private async checkPdfToolAvailable(): Promise<boolean> {
    // Return cached result if available
    if (this.pdfToolAvailable !== null) {
      return this.pdfToolAvailable;
    }

    // Check once and cache the result
    try {
      const result = await $`pdftoppm -v`.quiet();
      this.pdfToolAvailable = result.exitCode === 0;
      return this.pdfToolAvailable;
    } catch {
      this.pdfToolAvailable = false;
      return false;
    }
  }

  /**
   * Check if a file can have a thumbnail generated
   */
  canGenerateThumbnail(mimeType: string | null): boolean {
    if (!mimeType) return false;
    return SUPPORTED_FORMATS.has(mimeType) || mimeType === PDF_MIME_TYPE;
  }

  /**
   * Get or generate thumbnail for a file
   */
  async getThumbnail(
    filePath: string
  ): Promise<{ data: Buffer; mimeType: string } | null> {
    // Validate path
    const validation = await fileService.validatePath(filePath);
    if (!validation.valid) {
      return null;
    }

    // Check if file exists and get its modification time
    const file = Bun.file(filePath);
    if (!(await file.exists())) {
      return null;
    }
    const mtime = new Date(file.lastModified);

    // Check if it's a supported format (image or PDF)
    const mimeType = getMimeType(filePath);
    if (!this.canGenerateThumbnail(mimeType)) {
      return null;
    }

    // Check cache
    const cached = await this.getCachedThumbnail(filePath, mtime);
    if (cached) {
      return cached;
    }

    // Generate new thumbnail
    try {
      const thumbnail = await this.generateThumbnail(filePath);
      if (thumbnail) {
        // Cache it
        await this.cacheThumbnail(filePath, thumbnail.data, mtime);
        return thumbnail;
      }
    } catch (error) {
      console.error(`Error generating thumbnail for ${filePath}:`, error);
    }

    return null;
  }

  /**
   * Get cached thumbnail if valid
   */
  private async getCachedThumbnail(
    filePath: string,
    sourceModified: Date
  ): Promise<{ data: Buffer; mimeType: string } | null> {
    try {
      const result = await thumbDb
        .select()
        .from(thumbnails)
        .where(eq(thumbnails.path, filePath))
        .limit(1);

      if (result.length === 0) {
        return null;
      }

      const cached = result[0];

      // Check if source file has been modified
      if (cached.sourceModified.getTime() !== sourceModified.getTime()) {
        // Cache is stale, delete it
        await this.deleteCachedThumbnail(filePath);
        return null;
      }

      return {
        data: cached.data,
        mimeType: cached.mimeType
      };
    } catch (error) {
      console.error("Error getting cached thumbnail:", error);
      return null;
    }
  }

  /**
   * Generate a thumbnail for an image file or PDF
   */
  private async generateThumbnail(
    filePath: string
  ): Promise<{ data: Buffer; mimeType: string } | null> {
    const mimeType = getMimeType(filePath);

    // Handle PDF files
    if (mimeType === PDF_MIME_TYPE) {
      return this.generatePdfThumbnail(filePath);
    }

    // Handle image files (existing logic)
    try {
      const image = sharp(filePath);
      const metadata = await image.metadata();

      if (!metadata.width || !metadata.height) {
        return null;
      }

      const thumbnail = await image
        .resize(THUMBNAIL_CONFIG.width, THUMBNAIL_CONFIG.height, {
          fit: THUMBNAIL_CONFIG.fit,
          position: "center"
        })
        .webp({ quality: THUMBNAIL_CONFIG.quality })
        .toBuffer();

      return {
        data: thumbnail,
        mimeType: "image/webp"
      };
    } catch (error) {
      console.error(`Error generating image thumbnail: ${filePath}:`, error);
      return null;
    }
  }

  /**
   * Generate a thumbnail for a PDF file (first page) using pdftoppm
   * Uses system command for better Bun compatibility (no native modules)
   */
  private async generatePdfThumbnail(
    filePath: string
  ): Promise<{ data: Buffer; mimeType: string } | null> {
    // Check if pdftoppm is available
    const toolAvailable = await this.checkPdfToolAvailable();
    if (!toolAvailable) {
      console.warn(
        "pdftoppm not available. Install poppler-utils: brew install poppler (macOS) or apt-get install poppler-utils (Linux)"
      );
      return null;
    }

    try {
      // Read PDF file with error handling
      const file = Bun.file(filePath);
      if (!(await file.exists())) {
        console.error(`PDF file does not exist: ${filePath}`);
        return null;
      }

      // Use pdftoppm to convert first page to JPEG (faster I/O than PNG)
      // -f 1 -l 1: first page only
      // -jpeg: output JPEG format (faster processing and I/O)
      // -jpegopt quality=85: good quality JPEG
      // No scaling here - let Sharp handle resizing more efficiently
      // Using $ template tag for cleaner syntax, with binary output
      const commandPromise =
        $`pdftoppm -f 1 -l 1 -jpeg -jpegopt quality=85 ${filePath}`
          .quiet() // Suppress stderr unless command fails
          .arrayBuffer();

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error("PDF conversion timeout")),
          PDF_RENDER_CONFIG.maxRenderTime
        )
      );

      let result: ArrayBuffer;
      try {
        result = await Promise.race([commandPromise, timeoutPromise]);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error(`pdftoppm failed for ${filePath}: ${errorMsg}`);
        return null;
      }

      if (!result || result.byteLength === 0) {
        console.error(`pdftoppm produced empty output for: ${filePath}`);
        return null;
      }

      const imageBuffer = Buffer.from(result);

      // Use sharp to resize and optimize
      // Sharp is more efficient at resizing than pdftoppm's scaling
      // Process JPEG -> resize -> WebP in one pipeline
      const thumbnail = await sharp(imageBuffer)
        .resize(THUMBNAIL_CONFIG.width, THUMBNAIL_CONFIG.height, {
          fit: THUMBNAIL_CONFIG.fit,
          position: "center",
          withoutEnlargement: true // Don't upscale small PDFs
        })
        .webp({ quality: THUMBNAIL_CONFIG.quality })
        .toBuffer();

      if (!thumbnail || thumbnail.length === 0) {
        console.error(`Failed to process PDF thumbnail: ${filePath}`);
        return null;
      }

      return {
        data: thumbnail,
        mimeType: "image/webp"
      };
    } catch (error) {
      // Comprehensive error handling - log but don't crash
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(
        `Error generating PDF thumbnail for ${filePath}:`,
        errorMessage
      );
      return null;
    }
  }

  /**
   * Cache a thumbnail
   */
  private async cacheThumbnail(
    filePath: string,
    data: Buffer,
    sourceModified: Date
  ): Promise<void> {
    try {
      // Delete existing if any
      await this.deleteCachedThumbnail(filePath);

      // Insert new
      await thumbDb.insert(thumbnails).values({
        path: filePath,
        data,
        mimeType: "image/webp",
        width: THUMBNAIL_CONFIG.width,
        height: THUMBNAIL_CONFIG.height,
        sourceModified,
        createdAt: new Date()
      });
    } catch (error) {
      console.error("Error caching thumbnail:", error);
    }
  }

  /**
   * Delete a cached thumbnail
   */
  async deleteCachedThumbnail(filePath: string): Promise<void> {
    try {
      await thumbDb.delete(thumbnails).where(eq(thumbnails.path, filePath));
    } catch (error) {
      console.error("Error deleting cached thumbnail:", error);
    }
  }

  /**
   * Delete all cached thumbnails for a directory (recursive)
   */
  async deleteCachedThumbnailsForPath(basePath: string): Promise<number> {
    try {
      // Delete all thumbnails where path starts with basePath
      const allThumbnails = await thumbDb
        .select({ path: thumbnails.path })
        .from(thumbnails);

      let deleted = 0;
      for (const thumb of allThumbnails) {
        if (thumb.path.startsWith(basePath)) {
          await thumbDb
            .delete(thumbnails)
            .where(eq(thumbnails.path, thumb.path));
          deleted++;
        }
      }

      return deleted;
    } catch (error) {
      console.error("Error deleting cached thumbnails:", error);
      return 0;
    }
  }

  /**
   * Clean up orphaned thumbnails (files that no longer exist)
   */
  async cleanupOrphanedThumbnails(): Promise<number> {
    try {
      const allThumbnails = await thumbDb
        .select({ path: thumbnails.path })
        .from(thumbnails);

      let deleted = 0;
      for (const thumb of allThumbnails) {
        const exists = await fileService.exists(thumb.path);
        if (!exists) {
          await thumbDb
            .delete(thumbnails)
            .where(eq(thumbnails.path, thumb.path));
          deleted++;
        }
      }

      console.log(`Cleaned up ${deleted} orphaned thumbnails`);
      return deleted;
    } catch (error) {
      console.error("Error cleaning up thumbnails:", error);
      return 0;
    }
  }

  /**
   * Get thumbnail cache statistics
   */
  async getCacheStats(): Promise<{
    count: number;
    totalSize: number;
  }> {
    try {
      const allThumbnails = await thumbDb.select().from(thumbnails);

      let totalSize = 0;
      for (const thumb of allThumbnails) {
        totalSize += thumb.data.length;
      }

      return {
        count: allThumbnails.length,
        totalSize
      };
    } catch (error) {
      console.error("Error getting cache stats:", error);
      return { count: 0, totalSize: 0 };
    }
  }

  /**
   * Clear all cached thumbnails
   */
  async clearCache(): Promise<number> {
    try {
      const allThumbnails = await thumbDb
        .select({ path: thumbnails.path })
        .from(thumbnails);
      const count = allThumbnails.length;

      for (const thumb of allThumbnails) {
        await thumbDb.delete(thumbnails).where(eq(thumbnails.path, thumb.path));
      }

      console.log(`Cleared ${count} cached thumbnails`);
      return count;
    } catch (error) {
      console.error("Error clearing cache:", error);
      return 0;
    }
  }
}

// Export singleton instance
export const thumbnailService = new ThumbnailService();
