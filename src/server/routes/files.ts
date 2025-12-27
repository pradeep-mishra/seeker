// src/server/routes/files.ts
import { Elysia, t } from "elysia";
import { basename, join } from "path";
import type { User } from "../db/schema";
import { requireAuth } from "../middleware/auth";
import {
  fileService,
  recentService,
  settingsService,
  thumbnailService,
  uploadService
} from "../services";
import { generateId } from "../utils";

/**
 * File routes
 */
export const fileRoutes = new Elysia({ prefix: "/files" })
  .use(requireAuth)

  /**
   * GET /api/files
   * List directory contents with pagination
   */
  .get(
    "/",
    async (ctx: any) => {
      const { query, set } = ctx;
      const user = ctx.user as User | null;
      const {
        path,
        page = "1",
        limit = "50",
        sortBy = "name",
        sortOrder = "asc",
        showHidden,
        search
      } = query;

      if (!path) {
        set.status = 400;
        return { error: "Path is required" };
      }

      try {
        // Get user's showHiddenFiles setting if showHidden is not provided
        let showHiddenValue: boolean;
        if (showHidden !== undefined) {
          // Query parameter overrides setting
          showHiddenValue = showHidden === "true";
        } else {
          // Use user's setting from database
          const settings = await settingsService.getAllSettings();
          showHiddenValue = settings.showHiddenFiles;
        }

        const result = await fileService.listDirectory(path, {
          page: parseInt(page, 10),
          limit: parseInt(limit, 10),
          sortBy: sortBy as "name" | "date" | "size" | "type",
          sortOrder: sortOrder as "asc" | "desc",
          showHidden: showHiddenValue,
          search: search || undefined
        });

        // Track this location as recent
        if (user) {
          await recentService.addRecent(user.id, path);
        }

        return result;
      } catch (error) {
        set.status = 400;
        return { error: (error as Error).message };
      }
    },
    {
      query: t.Object({
        path: t.String(),
        page: t.Optional(t.String()),
        limit: t.Optional(t.String()),
        sortBy: t.Optional(t.String()),
        sortOrder: t.Optional(t.String()),
        showHidden: t.Optional(t.String()),
        search: t.Optional(t.String())
      })
    }
  )

  /**
   * GET /api/files/search
   * Search for files
   */
  .get(
    "/search",
    async ({ query, set }) => {
      const { path, q, recursive = "false", showHidden, limit = "100" } = query;

      if (!path || !q) {
        set.status = 400;
        return { error: "Path and search query are required" };
      }

      try {
        // Get user's showHiddenFiles setting if showHidden is not provided
        let showHiddenValue: boolean;
        if (showHidden !== undefined) {
          // Query parameter overrides setting
          showHiddenValue = showHidden === "true";
        } else {
          // Use user's setting from database
          const settings = await settingsService.getAllSettings();
          showHiddenValue = settings.showHiddenFiles;
        }

        const results = await fileService.searchFiles(path, q, {
          recursive: recursive === "true",
          showHidden: showHiddenValue,
          limit: parseInt(limit, 10)
        });

        return { items: results, total: results.length };
      } catch (error) {
        set.status = 400;
        return { error: (error as Error).message };
      }
    },
    {
      query: t.Object({
        path: t.String(),
        q: t.String(),
        recursive: t.Optional(t.String()),
        showHidden: t.Optional(t.String()),
        limit: t.Optional(t.String())
      })
    }
  )

  /**
   * GET /api/files/stats
   * Get file or directory stats
   */
  .get(
    "/stats",
    async ({ query, set }) => {
      const { path } = query;

      if (!path) {
        set.status = 400;
        return { error: "Path is required" };
      }

      const stats = await fileService.getStats(path, true);

      if (!stats) {
        set.status = 404;
        return { error: "File not found" };
      }

      return stats;
    },
    {
      query: t.Object({
        path: t.String(),
        calculateSize: t.Optional(t.String())
      })
    }
  )

  /**
   * GET /api/files/download
   * Download a file (or view inline if inline=true)
   */
  .get(
    "/download",
    async ({ query, set }) => {
      const { path, inline } = query;

      if (!path) {
        set.status = 400;
        return { error: "Path is required" };
      }

      // Validate path first
      const validation = await fileService.validatePath(path);
      if (!validation.valid) {
        set.status = 403;
        return { error: validation.error || "Access denied" };
      }

      // Use Bun.file() directly - it handles responses better than streams
      const file = Bun.file(path);

      // Check if file exists
      if (!(await file.exists())) {
        set.status = 404;
        return { error: "File not found" };
      }

      const filename = basename(path);

      // Set Content-Type
      set.headers["Content-Type"] = file.type || "application/octet-stream";

      // Use inline disposition for preview, attachment for download
      if (inline === "true") {
        set.headers["Content-Disposition"] = "inline";
      } else {
        set.headers[
          "Content-Disposition"
        ] = `attachment; filename="${encodeURIComponent(filename)}"`;
      }

      return file;
    },
    {
      query: t.Object({
        path: t.String(),
        inline: t.Optional(t.String())
      })
    }
  )

  /**
   * GET /api/files/content
   * Get file content as text
   */
  .get(
    "/content",
    async ({ query, set }) => {
      const { path } = query;

      if (!path) {
        set.status = 400;
        return { error: "Path is required" };
      }

      try {
        const result = await fileService.readFileContent(path);

        if (!result) {
          set.status = 404;
          return { error: "File not found" };
        }

        return result;
      } catch (error) {
        set.status = 400;
        return { error: (error as Error).message };
      }
    },
    {
      query: t.Object({
        path: t.String()
      })
    }
  )

  /**
   * POST /api/files/content
   * Save file content
   */
  .post(
    "/content",
    async ({ body, set }) => {
      const { path, content } = body;

      if (!path || content === undefined) {
        set.status = 400;
        return { error: "Path and content are required" };
      }

      const result = await fileService.saveFileContent(path, content);

      if (!result.success) {
        set.status = 400;
        return { error: result.error };
      }

      return result;
    },
    {
      body: t.Object({
        path: t.String(),
        content: t.String()
      })
    }
  )

  /**
   * GET /api/files/thumbnail
   * Get thumbnail for an image
   */
  .get(
    "/thumbnail",
    async ({ query, set }: any) => {
      const { path } = query;

      if (!path) {
        set.status = 400;
        return { error: "Path is required" };
      }

      const thumbnail = await thumbnailService.getThumbnail(path);

      if (!thumbnail) {
        set.status = 404;
        return { error: "Thumbnail not available" };
      }

      set.headers["Content-Type"] = thumbnail.mimeType;
      set.headers["Cache-Control"] = "public, max-age=86400"; // Cache for 24 hours

      return new Blob([new Uint8Array(thumbnail.data)], {
        type: thumbnail.mimeType
      });
    },
    {
      query: t.Object({
        path: t.String()
      })
    }
  )

  /**
   * POST /api/files/folder
   * Create a new folder
   */
  .post(
    "/folder",
    async ({ body, set }) => {
      const { path, name } = body;

      if (!path || !name) {
        set.status = 400;
        return { error: "Path and name are required" };
      }

      const result = await fileService.createFolder(path, name);

      if (!result.success) {
        set.status = 400;
        return { error: result.error };
      }

      return { success: true, path: result.path };
    },
    {
      body: t.Object({
        path: t.String(),
        name: t.String()
      })
    }
  )

  /**
   * POST /api/files/file
   * Create a new file
   */
  .post(
    "/file",
    async ({ body, set }) => {
      const { path, name } = body;

      if (!path || !name) {
        set.status = 400;
        return { error: "Path and name are required" };
      }

      const result = await fileService.createFile(path, name);

      if (!result.success) {
        set.status = 400;
        return { error: result.error };
      }

      return { success: true, path: result.path };
    },
    {
      body: t.Object({
        path: t.String(),
        name: t.String()
      })
    }
  )

  /**
   * POST /api/files/rename
   * Rename a file or folder
   */
  .post(
    "/rename",
    async ({ body, set }) => {
      const { path, newName } = body;

      if (!path || !newName) {
        set.status = 400;
        return { error: "Path and new name are required" };
      }

      const result = await fileService.rename(path, newName);

      if (!result.success) {
        set.status = 400;
        return { error: result.error };
      }

      return { success: true, path: result.path };
    },
    {
      body: t.Object({
        path: t.String(),
        newName: t.String()
      })
    }
  )

  /**
   * POST /api/files/copy
   * Copy files/folders
   */
  .post(
    "/copy",
    async ({ body, set }) => {
      const { paths, destination, conflictAction = "rename" } = body;

      if (!paths || paths.length === 0 || !destination) {
        set.status = 400;
        return { error: "Paths and destination are required" };
      }

      const result = await fileService.copy(paths, destination, conflictAction);

      if (!result.success) {
        set.status = 400;
      }

      return result;
    },
    {
      body: t.Object({
        paths: t.Array(t.String()),
        destination: t.String(),
        conflictAction: t.Optional(
          t.Union([
            t.Literal("overwrite"),
            t.Literal("skip"),
            t.Literal("rename")
          ])
        )
      })
    }
  )

  /**
   * POST /api/files/move
   * Move files/folders
   */
  .post(
    "/move",
    async ({ body, set }) => {
      const { paths, destination, conflictAction = "rename" } = body;

      if (!paths || paths.length === 0 || !destination) {
        set.status = 400;
        return { error: "Paths and destination are required" };
      }

      const result = await fileService.move(paths, destination, conflictAction);

      if (!result.success) {
        set.status = 400;
      }

      return result;
    },
    {
      body: t.Object({
        paths: t.Array(t.String()),
        destination: t.String(),
        conflictAction: t.Optional(
          t.Union([
            t.Literal("overwrite"),
            t.Literal("skip"),
            t.Literal("rename")
          ])
        )
      })
    }
  )

  /**
   * DELETE /api/files
   * Delete files/folders
   */
  .delete(
    "/",
    async ({ body, set }) => {
      const { paths } = body;

      if (!paths || paths.length === 0) {
        set.status = 400;
        return { error: "Paths are required" };
      }

      const result = await fileService.delete(paths);

      // Clean up thumbnails for deleted files
      for (const path of paths) {
        await thumbnailService.deleteCachedThumbnailsForPath(path);
      }

      return result;
    },
    {
      body: t.Object({
        paths: t.Array(t.String())
      })
    }
  )

  /**
   * POST /api/files/upload/init
   * Initialize a chunked upload
   */
  .post(
    "/upload/init",
    async ({ body, set }) => {
      const { path, filename, totalChunks } = body;

      if (!path || !filename || totalChunks === undefined) {
        set.status = 400;
        return { error: "Path, filename, and totalChunks are required" };
      }

      // Validate destination path permissions early
      const validation = await fileService.validatePath(path);
      if (!validation.valid) {
        set.status = 403;
        return { error: validation.error };
      }

      try {
        const result = await uploadService.initUpload(
          path,
          filename,
          totalChunks
        );
        return { success: true, uploadId: result.uploadId };
      } catch (error) {
        set.status = 500;
        return { error: (error as Error).message };
      }
    },
    {
      body: t.Object({
        path: t.String(),
        filename: t.String(),
        totalChunks: t.Number()
      })
    }
  )

  /**
   * POST /api/files/upload/chunk
   * Upload a file chunk
   */
  .post(
    "/upload/chunk",
    async ({ body, set }) => {
      const { uploadId, chunkIndex, chunk } = body;

      if (!uploadId || chunkIndex === undefined || !chunk) {
        set.status = 400;
        return { error: "Upload ID, chunk index, and chunk data are required" };
      }

      try {
        await uploadService.saveChunk(uploadId, chunkIndex, chunk);
        return { success: true };
      } catch (error) {
        set.status = 500;
        return { error: (error as Error).message };
      }
    },
    {
      body: t.Object({
        uploadId: t.String(),
        chunkIndex: t.Numeric(),
        chunk: t.File()
      })
    }
  )

  /**
   * POST /api/files/upload/finalize
   * Finalize a chunked upload
   */
  .post(
    "/upload/finalize",
    async ({ body, set }) => {
      const { uploadId, path, filename } = body;

      if (!uploadId || !path || !filename) {
        set.status = 400;
        return { error: "Upload ID, path, and filename are required" };
      }

      try {
        const result = await uploadService.finalizeUpload(
          uploadId,
          path,
          filename
        );

        if (!result.success) {
          set.status = 400;
          return { error: result.error };
        }

        return result;
      } catch (error) {
        set.status = 500;
        return { error: (error as Error).message };
      }
    },
    {
      body: t.Object({
        uploadId: t.String(),
        path: t.String(),
        filename: t.String()
      })
    }
  )

  /**
   * POST /api/files/upload/cancel
   * Cancel an active upload
   */
  .post(
    "/upload/cancel",
    async ({ body, set }) => {
      const { uploadId } = body;

      if (!uploadId) {
        set.status = 400;
        return { error: "Upload ID is required" };
      }

      try {
        await uploadService.cancelUpload(uploadId);
        return { success: true };
      } catch (error) {
        set.status = 500;
        return { error: (error as Error).message };
      }
    },
    {
      body: t.Object({
        uploadId: t.String()
      })
    }
  )

  /**
   * POST /api/files/upload (Legacy/Simple)
   * Upload files (small files)
   */
  .post(
    "/upload",
    async ({ body, set }) => {
      const { path } = body;
      const files = body.files;

      if (!path) {
        set.status = 400;
        return { error: "Path is required" };
      }

      // Validate destination path
      const validation = await fileService.validatePath(path);
      if (!validation.valid) {
        set.status = 400;
        return { error: validation.error };
      }

      const results: { name: string; success: boolean; error?: string }[] = [];

      // Handle both single file and array of files
      const fileList = Array.isArray(files) ? files : [files];

      for (const file of fileList) {
        if (!file || !(file instanceof File)) {
          continue;
        }

        try {
          const filePath = join(path, file.name);

          // Check if file already exists
          const exists = await fileService.exists(filePath);
          if (exists) {
            // Generate unique filename
            const ext = file.name.includes(".")
              ? "." + file.name.split(".").pop()
              : "";
            const nameWithoutExt = file.name.replace(ext, "");
            const uniqueName = `${nameWithoutExt}_${generateId(6)}${ext}`;
            const uniquePath = join(path, uniqueName);

            // Use Bun.write() - faster than fs.writeFile, accepts File directly
            await Bun.write(uniquePath, file);
            results.push({ name: uniqueName, success: true });
          } else {
            // Use Bun.write() - faster than fs.writeFile, accepts File directly
            await Bun.write(filePath, file);
            results.push({ name: file.name, success: true });
          }
        } catch (error) {
          results.push({
            name: file.name,
            success: false,
            error: (error as Error).message
          });
        }
      }

      return {
        success: results.every((r) => r.success),
        results
      };
    },
    {
      body: t.Object({
        path: t.String(),
        files: t.Union([t.File(), t.Array(t.File())])
      })
    }
  );
