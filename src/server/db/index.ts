// src/server/db/index.ts
import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { existsSync, mkdirSync } from "fs";
import { join } from "path";
import * as schema from "./schema";
import * as thumbSchema from "./thumbSchema";

// Configuration paths
const CONFIG_PATH = process.env.CONFIG_PATH || join(process.cwd(), "./config");
const MAIN_DB_PATH = join(CONFIG_PATH, "main.db");
const THUMB_DB_PATH = join(CONFIG_PATH, "thumb.db");

/**
 * Ensures the config directory exists
 */
function ensureConfigDir(): void {
  if (!existsSync(CONFIG_PATH)) {
    mkdirSync(CONFIG_PATH, { recursive: true });
    console.log(`Created config directory: ${CONFIG_PATH}`);
  }
}

/**
 * Creates and configures the main SQLite database
 */
function createMainDatabase(): Database {
  ensureConfigDir();

  const sqlite = new Database(MAIN_DB_PATH, { create: true });

  // Enable WAL mode for better concurrent access
  sqlite.exec("PRAGMA journal_mode = WAL;");
  sqlite.exec("PRAGMA busy_timeout = 5000;");
  sqlite.exec("PRAGMA synchronous = NORMAL;");
  sqlite.exec("PRAGMA cache_size = 10000;");
  sqlite.exec("PRAGMA foreign_keys = ON;");

  return sqlite;
}

/**
 * Creates and configures the thumbnail SQLite database
 */
function createThumbDatabase(): Database {
  ensureConfigDir();

  const sqlite = new Database(THUMB_DB_PATH, { create: true });

  // Enable WAL mode for better performance
  sqlite.exec("PRAGMA journal_mode = WAL;");
  sqlite.exec("PRAGMA busy_timeout = 5000;");
  sqlite.exec("PRAGMA synchronous = NORMAL;");
  sqlite.exec("PRAGMA cache_size = 5000;");

  return sqlite;
}

// Create database instances
const mainSqlite = createMainDatabase();
const thumbSqlite = createThumbDatabase();

// Create Drizzle ORM instances
export const db = drizzle(mainSqlite, { schema });
export const thumbDb = drizzle(thumbSqlite, { schema: thumbSchema });

// Export schemas for convenience
export { schema, thumbSchema };

// Export database paths for migration scripts
export const DB_PATHS = {
  main: MAIN_DB_PATH,
  thumb: THUMB_DB_PATH
};

/**
 * Initialize database tables
 * Runs migrations to create/update tables
 */
export async function initializeDatabase(): Promise<void> {
  console.log("Initializing databases...");

  try {
    // Determine migrations folder path
    // In Docker: /app/src/server/db/migrations
    // In development: src/server/db/migrations
    const migrationsFolder = existsSync(
      join(process.cwd(), "src/server/db/migrations")
    )
      ? "src/server/db/migrations"
      : join(import.meta.dir, "migrations");

    console.log("Running migrations from:", migrationsFolder);

    // Run Drizzle migrations (automatically skips already-applied migrations)
    // Drizzle tracks applied migrations in __drizzle_migrations table
    await migrate(db, { migrationsFolder });

    console.log("Migrations completed successfully");

    // Create indexes for better query performance (if not already created)
    mainSqlite.exec(`
      CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
      CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
      CREATE INDEX IF NOT EXISTS idx_bookmarks_user_id ON bookmarks(user_id);
      CREATE INDEX IF NOT EXISTS idx_recent_locations_user_id ON recent_locations(user_id);
      CREATE INDEX IF NOT EXISTS idx_recent_locations_accessed_at ON recent_locations(accessed_at);
      CREATE INDEX IF NOT EXISTS idx_file_metadata_cache_cached_at ON file_metadata_cache(cached_at);
    `);

    // Create thumbnail database table (separate from main migrations)
    thumbSqlite.exec(`
      CREATE TABLE IF NOT EXISTS thumbnails (
        path TEXT PRIMARY KEY,
        data BLOB NOT NULL,
        mime_type TEXT NOT NULL,
        width INTEGER NOT NULL,
        height INTEGER NOT NULL,
        source_modified INTEGER NOT NULL,
        created_at INTEGER NOT NULL DEFAULT (unixepoch())
      );

      CREATE INDEX IF NOT EXISTS idx_thumbnails_source_modified ON thumbnails(source_modified);
    `);

    // Initialize default settings if they don't exist
    const defaultSettings = [
      { key: "view_mode", value: JSON.stringify("list") },
      { key: "sort_by", value: JSON.stringify("name") },
      { key: "sort_order", value: JSON.stringify("asc") },
      { key: "show_hidden_files", value: JSON.stringify(true) },
      { key: "theme", value: JSON.stringify("light") }
    ];

    for (const setting of defaultSettings) {
      mainSqlite.exec(`
        INSERT OR IGNORE INTO settings (key, value)
        VALUES ('${setting.key}', '${setting.value}')
      `);
    }

    console.log("Databases initialized successfully");
  } catch (error) {
    console.error("Database initialization failed:", error);
    throw error;
  }
}

/**
 * Close database connections gracefully
 */
export function closeDatabase(): void {
  mainSqlite.close();
  thumbSqlite.close();
  console.log("Database connections closed");
}

// Handle process termination
process.on("SIGINT", () => {
  closeDatabase();
  process.exit(0);
});

process.on("SIGTERM", () => {
  closeDatabase();
  process.exit(0);
});
