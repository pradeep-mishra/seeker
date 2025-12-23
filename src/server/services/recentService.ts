// src/server/services/recentService.ts
import { db, schema } from "../db";
import { eq, and, desc, lt } from "drizzle-orm";
import { generateId } from "../utils";

const { recentLocations } = schema;

/**
 * Maximum number of recent locations to keep per user
 */
const MAX_RECENT_LOCATIONS = 20;

/**
 * Recent Locations Service
 * Tracks recently visited directories for quick navigation
 */
export class RecentService {
  /**
   * Get recent locations for a user
   */
  async getUserRecent(
    userId: string,
    limit: number = MAX_RECENT_LOCATIONS
  ): Promise<typeof recentLocations.$inferSelect[]> {
    return await db
      .select()
      .from(recentLocations)
      .where(eq(recentLocations.userId, userId))
      .orderBy(desc(recentLocations.accessedAt))
      .limit(limit);
  }

  /**
   * Add or update a recent location
   */
  async addRecent(userId: string, path: string): Promise<void> {
    try {
      // Check if this path already exists for user
      const existing = await db
        .select()
        .from(recentLocations)
        .where(
          and(
            eq(recentLocations.userId, userId),
            eq(recentLocations.path, path)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        // Update the accessed time
        await db
          .update(recentLocations)
          .set({ accessedAt: new Date() })
          .where(eq(recentLocations.id, existing[0].id));
      } else {
        // Insert new entry
        await db.insert(recentLocations).values({
          id: generateId(),
          userId,
          path,
          accessedAt: new Date(),
        });

        // Clean up old entries if over limit
        await this.cleanupOldEntries(userId);
      }
    } catch (error) {
      console.error("Error adding recent location:", error);
    }
  }

  /**
   * Remove a recent location
   */
  async removeRecent(
    id: string,
    userId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await db
        .delete(recentLocations)
        .where(
          and(eq(recentLocations.id, id), eq(recentLocations.userId, userId))
        );

      return { success: true };
    } catch (error) {
      console.error("Error removing recent location:", error);
      return { success: false, error: "Failed to remove recent location" };
    }
  }

  /**
   * Clear all recent locations for a user
   */
  async clearUserRecent(userId: string): Promise<{ success: boolean; error?: string }> {
    try {
      await db
        .delete(recentLocations)
        .where(eq(recentLocations.userId, userId));

      return { success: true };
    } catch (error) {
      console.error("Error clearing recent locations:", error);
      return { success: false, error: "Failed to clear recent locations" };
    }
  }

  /**
   * Clean up old entries to maintain max limit
   */
  private async cleanupOldEntries(userId: string): Promise<void> {
    try {
      // Get all entries sorted by accessed time
      const allEntries = await db
        .select()
        .from(recentLocations)
        .where(eq(recentLocations.userId, userId))
        .orderBy(desc(recentLocations.accessedAt));

      // Delete entries beyond the limit
      if (allEntries.length > MAX_RECENT_LOCATIONS) {
        const entriesToDelete = allEntries.slice(MAX_RECENT_LOCATIONS);
        for (const entry of entriesToDelete) {
          await db
            .delete(recentLocations)
            .where(eq(recentLocations.id, entry.id));
        }
      }
    } catch (error) {
      console.error("Error cleaning up old entries:", error);
    }
  }

  /**
   * Delete all recent locations for a user
   */
  async deleteUserRecent(userId: string): Promise<void> {
    await db.delete(recentLocations).where(eq(recentLocations.userId, userId));
  }
}

// Export singleton instance
export const recentService = new RecentService();
