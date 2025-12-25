// src/server/services/mountService.ts
import { $ } from "bun";
import { eq } from "drizzle-orm";
import { constants } from "fs";
import { access, stat } from "fs/promises";
import { join } from "path";
import { db, schema } from "../db";
import { generateId } from "../utils";
const { mounts } = schema;

/**
 * Storage statistics interface
 */
export interface StorageStats {
  total: number;
  used: number;
  free: number;
  percentUsed: number;
}

/**
 * Mount with stats
 */
export interface MountWithStats {
  id: string;
  path: string;
  label: string;
  createdAt: Date;
  stats?: StorageStats;
  accessible: boolean;
}

/**
 * Mount Service
 * Handles mount point management and storage statistics
 */
export class MountService {
  /**
   * Get all configured mounts
   */
  async getAllMounts(): Promise<(typeof mounts.$inferSelect)[]> {
    return await db.select().from(mounts);
  }

  /**
   * Get all mounts with their storage stats
   */
  async getAllMountsWithStats(): Promise<MountWithStats[]> {
    const mountList = await this.getAllMounts();
    const mountsWithStats: MountWithStats[] = [];

    for (const mount of mountList) {
      const accessible = await this.isMountAccessible(mount.path);
      let stats: StorageStats | undefined;

      if (accessible) {
        stats = await this.getStorageStats(mount.path);
      }

      mountsWithStats.push({
        ...mount,
        stats,
        accessible
      });
    }

    return mountsWithStats;
  }

  /**
   * Get a single mount by ID
   */
  async getMountById(
    id: string
  ): Promise<typeof mounts.$inferSelect | undefined> {
    const result = await db
      .select()
      .from(mounts)
      .where(eq(mounts.id, id))
      .limit(1);
    return result[0];
  }

  /**
   * Get a mount by path
   */
  async getMountByPath(
    path: string
  ): Promise<typeof mounts.$inferSelect | undefined> {
    const result = await db
      .select()
      .from(mounts)
      .where(eq(mounts.path, path))
      .limit(1);
    return result[0];
  }

  /**
   * Check if a mount path is accessible
   */
  async isMountAccessible(path: string): Promise<boolean> {
    try {
      await access(path, constants.R_OK);
      const pathStat = await stat(path);
      return pathStat.isDirectory();
    } catch {
      return false;
    }
  }

  /**
   * Add a new mount
   */
  async addMount(
    path: string,
    label: string
  ): Promise<{
    success: boolean;
    mount?: typeof mounts.$inferSelect;
    error?: string;
  }> {
    // Normalize path (remove trailing slash)
    const normalizedPath = path.replace(/\/+$/, "");

    // Check if path is accessible
    const accessible = await this.isMountAccessible(normalizedPath);
    if (!accessible) {
      return {
        success: false,
        error: "Path is not accessible or is not a directory"
      };
    }

    // Check if mount already exists
    const existing = await this.getMountByPath(normalizedPath);
    if (existing) {
      return { success: false, error: "Mount already exists" };
    }

    try {
      const id = generateId();
      await db.insert(mounts).values({
        id,
        path: normalizedPath,
        label: label.trim(),
        createdAt: new Date()
      });

      const mount = await this.getMountById(id);
      return { success: true, mount };
    } catch (error) {
      console.error("Error adding mount:", error);
      return { success: false, error: "Failed to add mount" };
    }
  }

  /**
   * Remove a mount
   */
  async removeMount(id: string): Promise<{ success: boolean; error?: string }> {
    try {
      const mount = await this.getMountById(id);
      if (!mount) {
        return { success: false, error: "Mount not found" };
      }

      await db.delete(mounts).where(eq(mounts.id, id));
      return { success: true };
    } catch (error) {
      console.error("Error removing mount:", error);
      return { success: false, error: "Failed to remove mount" };
    }
  }

  /**
   * Update mount label
   */
  async updateMountLabel(
    id: string,
    label: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const mount = await this.getMountById(id);
      if (!mount) {
        return { success: false, error: "Mount not found" };
      }

      await db
        .update(mounts)
        .set({ label: label.trim() })
        .where(eq(mounts.id, id));
      return { success: true };
    } catch (error) {
      console.error("Error updating mount:", error);
      return { success: false, error: "Failed to update mount" };
    }
  }

  /**
   * Get storage statistics for a mount point
   */
  async getStorageStats(path: string): Promise<StorageStats | undefined> {
    try {
      // Validate path is accessible before using in shell command
      const accessible = await this.isMountAccessible(path);
      if (!accessible) {
        return undefined;
      }

      // Use df command to get storage stats
      // Bun's $ template tag automatically escapes arguments, but we validate first for safety
      const output = await $`df -k ${path}`.text();
      const lines = output.trim().split("\n");
      const parts = lines[lines.length - 1].split(/\s+/);
      if (parts.length >= 4) {
        const total = parseInt(parts[1], 10) * 1024;
        const used = parseInt(parts[2], 10) * 1024;
        const free = parseInt(parts[3], 10) * 1024;
        const percentUsed = total > 0 ? Math.round((used / total) * 100) : 0;
        return { total, used, free, percentUsed };
      }
    } catch (error) {
      console.error("Error getting storage stats:", error);
    }

    return undefined;
  }

  /**
   * Initialize default mount from environment variable
   */
  async initializeDefaultMount(): Promise<void> {
    const defaultMount =
      process.env.DEFAULT_MOUNT || join(process.cwd(), "../");
    //console.log("defaultMount", defaultMount);
    if (defaultMount) {
      const existingMounts = await this.getAllMounts();
      if (existingMounts.length === 0) {
        const accessible = await this.isMountAccessible(defaultMount);
        if (accessible) {
          await this.addMount(defaultMount, "Data");
          console.log(`Initialized default mount: ${defaultMount}`);
        } else {
          console.warn(`Default mount path not accessible: ${defaultMount}`);
        }
      }
    }
  }

  /**
   * Check if any mounts are configured
   */
  async hasMounts(): Promise<boolean> {
    const mountList = await this.getAllMounts();
    return mountList.length > 0;
  }

  /**
   * Get the first available mount (for initial navigation)
   */
  async getFirstMount(): Promise<typeof mounts.$inferSelect | undefined> {
    const mountList = await this.getAllMounts();
    return mountList[0];
  }
}

// Export singleton instance
export const mountService = new MountService();
