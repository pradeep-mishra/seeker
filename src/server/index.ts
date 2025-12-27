// src/server/index.ts
import { cors } from "@elysiajs/cors";
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
    version: "0.1.0"
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
    // Use path relative to the working directory when running from source in Docker
    // or relative to the bundled index.js location when running built server
    const clientDistPath = existsSync(join(import.meta.dir, "../client"))
      ? join(import.meta.dir, "../client")
      : join(process.cwd(), "dist/client");

    console.log("Current working directory:", process.cwd());
    console.log("import.meta.dir:", import.meta.dir);
    console.log("Client dist path:", clientDistPath);
    console.log("Client dist exists:", existsSync(clientDistPath));

    if (existsSync(clientDistPath)) {
      console.log("Serving static files from:", clientDistPath);
      // Serve static assets from /assets with long cache (1 year - assets are versioned)
      app.get("/assets/*", ({ path, set }) => {
        const filePath = join(clientDistPath, path);
        set.headers["Cache-Control"] = "public, max-age=31536000, immutable";
        return Bun.file(filePath);
      });

      // Serve favicon with medium cache (1 week)
      app.get("/favicon.svg", ({ set }) => {
        set.headers["Cache-Control"] = "public, max-age=604800";
        return Bun.file(join(clientDistPath, "favicon.svg"));
      });

      // Serve index.html with short cache (5 minutes) - HTML may change
      app.get("/index.html", ({ set }) => {
        set.headers["Cache-Control"] = "public, max-age=3000";
        set.headers["Content-Type"] = "text/html";
        //console.log("serving this file: ", join(clientDistPath, "index.html"));
        return Bun.file(join(clientDistPath, "index.html"));
      });

      app.get("/", ({ set }) => {
        set.headers["Cache-Control"] = "public, max-age=3000";
        set.headers["Content-Type"] = "text/html";
        //console.log("serving this file: ", join(clientDistPath, "index.html"));
        return Bun.file(join(clientDistPath, "index.html"));
      });

      // SPA fallback - serve 404.html for all other routes, fallback to index.html if 404.html doesn't exist
      // Short cache (5 minutes) for HTML files
      app.get("*", ({ set }) => {
        const file404Path = join(clientDistPath, "404.html");
        const file = existsSync(file404Path)
          ? Bun.file(file404Path)
          : Bun.file(join(clientDistPath, "index.html"));
        set.headers["Content-Type"] = "text/html";
        set.headers["Cache-Control"] = "public, max-age=3000";
        return file;
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
 * Check if port is available by attempting to bind to it
 */
async function checkPortAvailable(
  port: number,
  hostname: string
): Promise<boolean> {
  try {
    // Try to create a TCP server on the port
    const server = Bun.listen({
      hostname,
      port,
      socket: {
        data() {},
        open() {},
        close() {},
        error() {}
      }
    });

    // Port is available, close the test server
    server.stop();
    return true;
  } catch (error: any) {
    // Port is in use or other error
    if (
      error?.code === "EADDRINUSE" ||
      error?.message?.includes("address already in use") ||
      error?.message?.includes("port is already in use")
    ) {
      return false;
    }
    // Re-throw non-port-conflict errors
    throw error;
  }
}

/**
 * Start the server
 */
async function start(): Promise<void> {
  try {
    // Check if port is available before initialization
    const portAvailable = await checkPortAvailable(PORT, HOST);

    if (!portAvailable) {
      console.error(`
╔═══════════════════════════════════════════════════════════╗
║   ❌ ERROR: Port ${PORT} is already in use                   ║
╚═══════════════════════════════════════════════════════════╝

Another application is already listening on port ${PORT}.

Solutions:
  1. Stop the application using port ${PORT}
  2. Change the PORT environment variable:
     PORT=3001 bun run start

  To find what's using the port:
     lsof -i :${PORT}        (macOS/Linux)
     netstat -ano | find "${PORT}"  (Windows)
`);
      process.exit(1);
    }

    await init();

    const app = createApp();

    const server = app.listen({
      port: PORT,
      hostname: HOST
    });

    // Verify server started successfully
    if (!server) {
      throw new Error(`Failed to start server on ${HOST}:${PORT}`);
    }

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
