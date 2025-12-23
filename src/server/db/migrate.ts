import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { db } from "./index";

console.log("Running migrations...");

try {
  await migrate(db, { migrationsFolder: "src/server/db/migrations" });
  console.log("Migrations completed successfully");
} catch (error) {
  console.error("Migration failed:", error);
  process.exit(1);
}

