// src/server/routes/files.ts
import { Elysia, t } from "elysia";
import { writeFile } from "fs/promises";
import { basename, join } from "path";
import type { User } from "../db/schema";
import { requireAuth } from "../middleware/auth";
import { fileService, recentService, thumbnailService } from "../services";
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
        showHidden = "true",
        search
      } = query;

      if (!path) {
        set.status = 400;
        return { error: "Path is required" };
      }

      try {
        const result = await fileService.listDirectory(path, {
          page: parseInt(page, 10),
          limit: parseInt(limit, 10),
          sortBy: sortBy as "name" | "date" | "size" | "type",
          sortOrder: sortOrder as "asc" | "desc",
          showHidden: showHidden === "true",
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
      const {
        path,
        q,
        recursive = "false",
        showHidden = "true",
        limit = "100"
      } = query;

      if (!path || !q) {
        set.status = 400;
        return { error: "Path and search query are required" };
      }

      try {
        const results = await fileService.searchFiles(path, q, {
          recursive: recursive === "true",
          showHidden: showHidden === "true",
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

      const stats = await fileService.getStats(path);

      if (!stats) {
        set.status = 404;
        return { error: "File not found" };
      }

      return stats;
    },
    {
      query: t.Object({
        path: t.String()
      })
    }
  )

  /**
   * GET /api/files/download
   * Download a file
   */
  .get(
    "/download",
    async ({ query, set }) => {
      const { path } = query;

      if (!path) {
        set.status = 400;
        return { error: "Path is required" };
      }

      const result = await fileService.getFileStream(path);

      if (!result) {
        set.status = 404;
        return { error: "File not found or not accessible" };
      }

      const filename = basename(path);

      set.headers["Content-Type"] = result.mimeType;
      set.headers["Content-Length"] = result.stat.size.toString();
      set.headers[
        "Content-Disposition"
      ] = `attachment; filename="${encodeURIComponent(filename)}"`;

      return result.stream;
    },
    {
      query: t.Object({
        path: t.String()
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
   * POST /api/files/upload
   * Upload files
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

            const buffer = await file.arrayBuffer();
            await writeFile(uniquePath, Buffer.from(buffer));
            results.push({ name: uniqueName, success: true });
          } else {
            const buffer = await file.arrayBuffer();
            await writeFile(filePath, Buffer.from(buffer));
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
