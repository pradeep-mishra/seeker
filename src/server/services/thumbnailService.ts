// src/server/services/thumbnailService.ts
import { eq } from "drizzle-orm";
import sharp from "sharp";
import { thumbDb, thumbSchema } from "../db";
import { getMimeType } from "../utils";
import { fileService } from "./fileService";

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
 * Thumbnail Service
 * Handles thumbnail generation and caching for images
 */
export class ThumbnailService {
  /**
   * Check if a file can have a thumbnail generated
   */
  canGenerateThumbnail(mimeType: string | null): boolean {
    if (!mimeType) return false;
    return SUPPORTED_FORMATS.has(mimeType);
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

    // Check if it's a supported image format
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
   * Generate a thumbnail for an image file
   */
  private async generateThumbnail(
    filePath: string
  ): Promise<{ data: Buffer; mimeType: string } | null> {
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
      console.error(`Error generating thumbnail: ${error}`);
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
