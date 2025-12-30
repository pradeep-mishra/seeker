import { Elysia, t } from "elysia";
import { requireAdmin, requireAuth } from "../middleware/auth";
import { mountService } from "../services";

/**
 * Mount routes
 */
export const mountRoutes = new Elysia({ prefix: "/mounts" })
  .use(requireAuth)

  /**
   * GET /api/mounts
   * Get all configured mounts with their stats
   */
  .get("/", async () => {
    const mounts = await mountService.getAllMountsWithStats();
    return { mounts };
  })

  /**
   * GET /api/mounts/has-mounts
   * Check if any mounts are configured
   */
  .get("/has-mounts", async () => {
    const hasMounts = await mountService.hasMounts();
    return { hasMounts };
  })

  /**
   * GET /api/mounts/:id
   * Get a single mount by ID
   */
  .get(
    "/:id",
    async ({ params, set }) => {
      const mount = await mountService.getMountById(params.id);

      if (!mount) {
        set.status = 404;
        return { error: "Mount not found" };
      }

      const accessible = await mountService.isMountAccessible(mount.path);
      const stats = accessible
        ? await mountService.getStorageStats(mount.path)
        : undefined;

      return { mount: { ...mount, stats, accessible } };
    },
    {
      params: t.Object({
        id: t.String()
      })
    }
  )

  /**
   * GET /api/mounts/:id/stats
   * Get storage stats for a mount
   */
  .get(
    "/:id/stats",
    async ({ params, set }) => {
      const mount = await mountService.getMountById(params.id);

      if (!mount) {
        set.status = 404;
        return { error: "Mount not found" };
      }

      const stats = await mountService.getStorageStats(mount.path);

      if (!stats) {
        set.status = 500;
        return { error: "Failed to get storage stats" };
      }

      return { stats };
    },
    {
      params: t.Object({
        id: t.String()
      })
    }
  )

  // Admin-only routes
  .use(requireAdmin)

  /**
   * POST /api/mounts
   * Add a new mount (admin only)
   */
  .post(
    "/",
    async ({ body, set }) => {
      const { path, label } = body;

      if (!path || !label) {
        set.status = 400;
        return { error: "Path and label are required" };
      }

      const result = await mountService.addMount(path, label);

      if (!result.success) {
        set.status = 400;
        return { error: result.error };
      }

      return { success: true, mount: result.mount };
    },
    {
      body: t.Object({
        path: t.String(),
        label: t.String()
      })
    }
  )

  /**
   * PATCH /api/mounts/:id
   * Update mount label (admin only)
   */
  .patch(
    "/:id",
    async ({ params, body, set }) => {
      const result = await mountService.updateMountLabel(params.id, body.label);

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
        label: t.String()
      })
    }
  )

  /**
   * DELETE /api/mounts/:id
   * Remove a mount (admin only)
   */
  .delete(
    "/:id",
    async ({ params, set }) => {
      const result = await mountService.removeMount(params.id);

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
