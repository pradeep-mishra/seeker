import { Elysia, t } from "elysia";
import type { User } from "../db/schema";
import { requireAuth } from "../middleware/auth";
import { recentService } from "../services";

/**
 * Recent locations routes
 */
export const recentRoutes = new Elysia({ prefix: "/recent" })
  .use(requireAuth)

  /**
   * GET /api/recent
   * Get recent locations for current user
   */
  .get(
    "/",
    async (ctx: any) => {
      const { query } = ctx;
      const user = ctx.user as User | null;

      if (!user) {
        return { recent: [] };
      }

      const limit = query.limit ? parseInt(query.limit, 10) : 20;
      const recent = await recentService.getUserRecent(user.id, limit);

      return { recent };
    },
    {
      query: t.Object({
        limit: t.Optional(t.String())
      })
    }
  )

  /**
   * POST /api/recent
   * Add a location to recent (usually done automatically on navigation)
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

      await recentService.addRecent(user.id, body.path);

      return { success: true };
    },
    {
      body: t.Object({
        path: t.String()
      })
    }
  )

  /**
   * DELETE /api/recent/:id
   * Remove a single recent location
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

      const result = await recentService.removeRecent(params.id, user.id);

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
  )

  /**
   * DELETE /api/recent
   * Clear all recent locations for current user
   */
  .delete("/", async (ctx: any) => {
    const { set } = ctx;
    const user = ctx.user as User | null;

    if (!user) {
      set.status = 401;
      return { error: "Not authenticated" };
    }

    const result = await recentService.clearUserRecent(user.id);

    if (!result.success) {
      set.status = 400;
      return { error: result.error };
    }

    return { success: true };
  });
