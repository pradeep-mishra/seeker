// src/server/index.ts
import { cors } from "@elysiajs/cors";
import { staticPlugin } from "@elysiajs/static";
import { Elysia } from "elysia";
import { existsSync } from "fs";
import { join } from "path";
import { initializeDatabase } from "./db";
import {
  authRoutes,
  bookmarkRoutes,
  fileRoutes,
  mountRoutes,
  recentRoutes,
  settingsRoutes,
  userRoutes
} from "./routes";
import { mountService } from "./services";

// Configuration
const PORT = parseInt(process.env.PORT || "3000", 10);
const HOST = process.env.HOST || "0.0.0.0";
const NODE_ENV = process.env.NODE_ENV || "development";
const IS_PRODUCTION = NODE_ENV === "production";

/**
 * Initialize the application
 */
async function init(): Promise<void> {
  console.log(`Starting Seeker in ${NODE_ENV} mode...`);

  // Initialize database
  await initializeDatabase();

  // Initialize default mount from environment variable
  await mountService.initializeDefaultMount();
}

/**
 * Create and configure the Elysia application
 */
function createApp(): Elysia {
  const app = new Elysia();

  // CORS configuration
  app.use(
    cors({
      origin: IS_PRODUCTION ? false : true,
      credentials: true,
      allowedHeaders: ["Content-Type", "Authorization"],
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
    })
  );

  // Health check endpoint
  app.get("/health", () => ({
    status: "ok",
    timestamp: new Date().toISOString(),
    version: "1.0.0"
  }));

  // API routes
  app.group("/api", (api) =>
    api
      .use(authRoutes)
      .use(fileRoutes)
      .use(mountRoutes)
      .use(bookmarkRoutes)
      .use(recentRoutes)
      .use(settingsRoutes)
      .use(userRoutes)
  );

  // Serve static files in production
  if (IS_PRODUCTION) {
    const clientDistPath = join(import.meta.dir, "../../dist/client");

    if (existsSync(clientDistPath)) {
      // Serve static assets
      app.use(
        staticPlugin({
          assets: clientDistPath,
          prefix: "/",
          alwaysStatic: false
        })
      );

      // SPA fallback - serve index.html for all non-API routes
      app.get("*", async ({ set }) => {
        const indexPath = join(clientDistPath, "index.html");
        if (existsSync(indexPath)) {
          set.headers["Content-Type"] = "text/html";
          return Bun.file(indexPath);
        }
        set.status = 404;
        return "Not Found";
      });
    } else {
      console.warn(`Client dist not found at ${clientDistPath}`);
    }
  }

  // Global error handler
  app.onError(({ code, error, set }) => {
    console.error(`Error [${code}]:`, error);

    const errorMessage = error instanceof Error ? error.message : String(error);

    if (code === "VALIDATION") {
      set.status = 400;
      return {
        error: "Validation Error",
        message: errorMessage
      };
    }

    if (code === "NOT_FOUND") {
      set.status = 404;
      return {
        error: "Not Found",
        message: "The requested resource was not found"
      };
    }

    set.status = 500;
    return {
      error: "Internal Server Error",
      message: IS_PRODUCTION ? "Something went wrong" : errorMessage
    };
  });

  return app;
}

/**
 * Start the server
 */
async function start(): Promise<void> {
  try {
    await init();

    const app = createApp();

    app.listen({
      port: PORT,
      hostname: HOST
    });

    console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║      Seeker File Browser                                  ║
║                                                           ║
║   Server running at: http://${HOST}:${PORT}                  ║
║   Environment: ${NODE_ENV.padEnd(41)}  ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
    `);
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

// Start the application
start();
