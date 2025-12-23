// src/server/db/schema.ts
import { sqliteTable, text, integer, blob } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

/**
 * Users table - stores user authentication and profile data
 * First user created becomes admin automatically
 */
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  isAdmin: integer("is_admin", { mode: "boolean" }).notNull().default(false),
  avatar: text("avatar"), // Base64 encoded image or null
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

/**
 * Sessions table - stores active user sessions for HTTP-only cookie auth
 */
export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

/**
 * Settings table - stores global application settings
 * Key-value store for flexibility
 */
export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(), // JSON stringified values
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

/**
 * Mounts table - stores configured filesystem mounts
 * Only admins can add/remove mounts
 */
export const mounts = sqliteTable("mounts", {
  id: text("id").primaryKey(),
  path: text("path").notNull().unique(),
  label: text("label").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

/**
 * Bookmarks table - stores user's pinned/quick access folders
 */
export const bookmarks = sqliteTable("bookmarks", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  path: text("path").notNull(),
  name: text("name").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

/**
 * Recent locations table - stores user's recently visited directories
 */
export const recentLocations = sqliteTable("recent_locations", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  path: text("path").notNull(),
  accessedAt: integer("accessed_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

/**
 * File metadata cache table - caches file information for faster listing
 * Invalidated when file modification time changes
 */
export const fileMetadataCache = sqliteTable("file_metadata_cache", {
  path: text("path").primaryKey(),
  name: text("name").notNull(),
  size: integer("size").notNull(),
  modifiedAt: integer("modified_at", { mode: "timestamp" }).notNull(),
  isDirectory: integer("is_directory", { mode: "boolean" }).notNull(),
  mimeType: text("mime_type"),
  cachedAt: integer("cached_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

// Type exports for use throughout the application
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;

export type Setting = typeof settings.$inferSelect;
export type NewSetting = typeof settings.$inferInsert;

export type Mount = typeof mounts.$inferSelect;
export type NewMount = typeof mounts.$inferInsert;

export type Bookmark = typeof bookmarks.$inferSelect;
export type NewBookmark = typeof bookmarks.$inferInsert;

export type RecentLocation = typeof recentLocations.$inferSelect;
export type NewRecentLocation = typeof recentLocations.$inferInsert;

export type FileMetadata = typeof fileMetadataCache.$inferSelect;
export type NewFileMetadata = typeof fileMetadataCache.$inferInsert;

// Settings keys enum for type safety
export const SettingsKeys = {
  VIEW_MODE: "view_mode",
  SORT_BY: "sort_by",
  SORT_ORDER: "sort_order",
  SHOW_HIDDEN_FILES: "show_hidden_files",
  THEME: "theme",
} as const;

export type SettingsKey = (typeof SettingsKeys)[keyof typeof SettingsKeys];

// View modes
export const ViewModes = {
  LIST: "list",
  THUMBNAIL: "thumbnail",
  CARD: "card",
} as const;

export type ViewMode = (typeof ViewModes)[keyof typeof ViewModes];

// Sort options
export const SortByOptions = {
  NAME: "name",
  DATE: "date",
  SIZE: "size",
  TYPE: "type",
} as const;

export type SortBy = (typeof SortByOptions)[keyof typeof SortByOptions];

export const SortOrderOptions = {
  ASC: "asc",
  DESC: "desc",
} as const;

export type SortOrder =
  (typeof SortOrderOptions)[keyof typeof SortOrderOptions];
