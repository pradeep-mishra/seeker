// src/server/routes/bookmarks.ts
import { Elysia, t } from "elysia";
import type { User } from "../db/schema";
import { requireAuth } from "../middleware/auth";
import { bookmarkService } from "../services";

/**
 * Bookmark routes
 */
export const bookmarkRoutes = new Elysia({ prefix: "/bookmarks" })
  .use(requireAuth)

  /**
   * GET /api/bookmarks
   * Get all bookmarks for current user
   */
  .get("/", async (ctx: any) => {
    const user = ctx.user as User | null;

    if (!user) {
      return { bookmarks: [] };
    }

    const bookmarks = await bookmarkService.getUserBookmarks(user.id);
    return { bookmarks };
  })

  /**
   * GET /api/bookmarks/check
   * Check if a path is bookmarked
   */
  .get(
    "/check",
    async (ctx: any) => {
      const { query } = ctx;
      const user = ctx.user as User | null;

      if (!user) {
        return { isBookmarked: false };
      }

      const isBookmarked = await bookmarkService.isBookmarked(
        query.path,
        user.id
      );
      return { isBookmarked };
    },
    {
      query: t.Object({
        path: t.String()
      })
    }
  )

  /**
   * POST /api/bookmarks
   * Add a new bookmark
   */
  .post(
    "/",
    async (ctx: any) => {
      const { body, set } = ctx;
      const user = ctx.user as User | null;

      if (!user) {
        set.status = 401;
        return { error: "Not authenticated" };
      }

      const { path, name } = body;

      if (!path || !name) {
        set.status = 400;
        return { error: "Path and name are required" };
      }

      const result = await bookmarkService.addBookmark(user.id, path, name);

      if (!result.success) {
        set.status = 400;
        return { error: result.error };
      }

      return { success: true, bookmark: result.bookmark };
    },
    {
      body: t.Object({
        path: t.String(),
        name: t.String()
      })
    }
  )

  /**
   * PATCH /api/bookmarks/:id
   * Update bookmark name
   */
  .patch(
    "/:id",
    async (ctx: any) => {
      const { params, body, set } = ctx;
      const user = ctx.user as User | null;

      if (!user) {
        set.status = 401;
        return { error: "Not authenticated" };
      }

      const result = await bookmarkService.updateBookmarkName(
        params.id,
        user.id,
        body.name
      );

      if (!result.success) {
        set.status = 400;
        return { error: result.error };
      }

      return { success: true };
    },
    {
      params: t.Object({
        id: t.String()
      }),
      body: t.Object({
        name: t.String()
      })
    }
  )

  /**
   * PATCH /api/bookmarks/reorder
   * Reorder bookmarks
   */
  .patch(
    "/reorder",
    async (ctx: any) => {
      const { body, set } = ctx;
      const user = ctx.user as User | null;

      if (!user) {
        set.status = 401;
        return { error: "Not authenticated" };
      }

      const result = await bookmarkService.reorderBookmarks(
        user.id,
        body.orderedIds
      );

      if (!result.success) {
        set.status = 400;
        return { error: result.error };
      }

      return { success: true };
    },
    {
      body: t.Object({
        orderedIds: t.Array(t.String())
      })
    }
  )

  /**
   * DELETE /api/bookmarks/:id
   * Remove a bookmark
   */
  .delete(
    "/:id",
    async (ctx: any) => {
      const { params, set } = ctx;
      const user = ctx.user as User | null;

      if (!user) {
        set.status = 401;
        return { error: "Not authenticated" };
      }

      const result = await bookmarkService.removeBookmark(params.id, user.id);

      if (!result.success) {
        set.status = 400;
        return { error: result.error };
      }

      return { success: true };
    },
    {
      params: t.Object({
        id: t.String()
      })
    }
  );
