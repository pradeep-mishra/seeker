import { sql } from "drizzle-orm";
import { blob, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * Thumbnails table - stores generated image thumbnails
 * Separate database (thumb.db) to keep main database small
 */
export const thumbnails = sqliteTable("thumbnails", {
  path: text("path").primaryKey(), // Original file path
  data: blob("data", { mode: "buffer" }).notNull(), // Thumbnail image data
  mimeType: text("mime_type").notNull(), // image/jpeg or image/webp
  width: integer("width").notNull(),
  height: integer("height").notNull(),
  sourceModified: integer("source_modified", { mode: "timestamp" }).notNull(), // For cache invalidation
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`)
});

export type Thumbnail = typeof thumbnails.$inferSelect;
export type NewThumbnail = typeof thumbnails.$inferInsert;
