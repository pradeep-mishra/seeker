// src/server/routes/users.ts
import { Elysia, t } from "elysia";
import type { User } from "../db/schema";
import { requireAdmin } from "../middleware/auth";
import { authService } from "../services";

/**
 * User management routes (admin only)
 */
export const userRoutes = new Elysia({ prefix: "/users" })
  .use(requireAdmin)

  /**
   * GET /api/users
   * Get all users (admin only)
   */
  .get("/", async () => {
    const users = await authService.getAllUsers();
    return { users };
  })

  /**
   * POST /api/users
   * Create a new user (admin only)
   */
  .post(
    "/",
    async ({ body, set }) => {
      const { username, password, isAdmin = false } = body;

      if (!username || username.length < 3) {
        set.status = 400;
        return { error: "Username must be at least 3 characters" };
      }

      if (!password || password.length < 6) {
        set.status = 400;
        return { error: "Password must be at least 6 characters" };
      }

      const result = await authService.createUser(username, password, isAdmin);

      if (!result.success) {
        set.status = 400;
        return { error: result.error };
      }

      return {
        success: true,
        user: result.user
          ? {
              id: result.user.id,
              username: result.user.username,
              isAdmin: result.user.isAdmin,
              createdAt: result.user.createdAt
            }
          : null
      };
    },
    {
      body: t.Object({
        username: t.String(),
        password: t.String(),
        isAdmin: t.Optional(t.Boolean())
      })
    }
  )

  /**
   * DELETE /api/users/:id
   * Delete a user (admin only, cannot delete self)
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

      const result = await authService.deleteUser(params.id, user.id);

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
   * PATCH /api/users/:id/password
   * Reset a user's password (admin only)
   */
  .patch(
    "/:id/password",
    async ({ params, body, set }) => {
      const { password } = body;

      if (!password || password.length < 6) {
        set.status = 400;
        return { error: "Password must be at least 6 characters" };
      }

      const result = await authService.updatePassword(params.id, password);

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
        password: t.String()
      })
    }
  );
