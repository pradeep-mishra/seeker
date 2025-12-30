import { Elysia, t } from "elysia";
import type { User } from "../db/schema";
import {
  authMiddleware,
  requireAuth,
  SESSION_COOKIE_NAME,
  SESSION_COOKIE_OPTIONS
} from "../middleware/auth";
import { authService } from "../services";

/**
 * Authentication routes
 */
export const authRoutes = new Elysia({ prefix: "/auth" })
  .use(authMiddleware)

  /**
   * GET /api/auth/status
   * Check if any users exist (for first-time setup)
   */
  .get("/status", async () => {
    const hasUsers = await authService.hasUsers();
    return {
      hasUsers,
      requiresSetup: !hasUsers
    };
  })

  /**
   * POST /api/auth/register
   * Register a new user
   * - If no users exist, anyone can register (becomes admin)
   * - If users exist, only admins can create new users
   */
  .post(
    "/register",
    async (ctx: any) => {
      const { body, set, cookie } = ctx;
      const isAdmin = ctx.isAdmin as boolean;
      const { username, password } = body;

      // Check if any users exist
      const hasUsers = await authService.hasUsers();

      // If users exist, require admin
      if (hasUsers && !isAdmin) {
        set.status = 403;
        return { error: "Only admins can create new users" };
      }

      // Validate input
      if (!username || username.length < 3) {
        set.status = 400;
        return { error: "Username must be at least 3 characters" };
      }

      if (!password || password.length < 6) {
        set.status = 400;
        return { error: "Password must be at least 6 characters" };
      }

      // Create user
      const result = await authService.createUser(username, password);

      if (!result.success) {
        set.status = 400;
        return { error: result.error };
      }

      // If this is the first user, auto-login
      if (!hasUsers && result.user) {
        const sessionId = await authService.createSession(result.user.id);
        cookie[SESSION_COOKIE_NAME].set({
          value: sessionId,
          ...SESSION_COOKIE_OPTIONS
        });

        return {
          success: true,
          user: {
            id: result.user.id,
            username: result.user.username,
            isAdmin: result.user.isAdmin,
            avatar: result.user.avatar
          },
          autoLoggedIn: true
        };
      }

      return {
        success: true,
        user: result.user
          ? {
              id: result.user.id,
              username: result.user.username,
              isAdmin: result.user.isAdmin
            }
          : null
      };
    },
    {
      body: t.Object({
        username: t.String(),
        password: t.String()
      })
    }
  )

  /**
   * POST /api/auth/login
   * Login with username and password
   */
  .post(
    "/login",
    async ({ body, set, cookie }: any) => {
      const { username, password } = body;

      const result = await authService.authenticate(username, password);

      if (!result.success || !result.user) {
        set.status = 401;
        return { success: false, error: result.error || "Invalid credentials" };
      }

      // Create session
      const sessionId = await authService.createSession(result.user.id);

      // Set cookie
      cookie[SESSION_COOKIE_NAME].set({
        value: sessionId,
        ...SESSION_COOKIE_OPTIONS
      });

      return {
        success: true,
        user: {
          id: result.user.id,
          username: result.user.username,
          isAdmin: result.user.isAdmin,
          avatar: result.user.avatar
        }
      };
    },
    {
      body: t.Object({
        username: t.String(),
        password: t.String()
      })
    }
  )

  /**
   * POST /api/auth/logout
   * Logout current session
   */
  .post("/logout", async (ctx: any) => {
    const session = ctx.session;
    const cookie = ctx.cookie;

    if (session) {
      await authService.deleteSession(session.id);
    }

    cookie[SESSION_COOKIE_NAME].remove();

    return { success: true };
  })

  /**
   * GET /api/auth/me
   * Get current user information
   */
  .get("/me", async (ctx: any) => {
    const user = ctx.user as User | null;
    const isAuthenticated = ctx.isAuthenticated as boolean;

    if (!isAuthenticated || !user) {
      return { authenticated: false, user: null };
    }

    return {
      authenticated: true,
      user: {
        id: user.id,
        username: user.username,
        isAdmin: user.isAdmin,
        avatar: user.avatar,
        createdAt: user.createdAt
      }
    };
  })

  /**
   * PATCH /api/auth/password
   * Change current user's password
   */
  .use(requireAuth)
  .patch(
    "/password",
    async (ctx: any) => {
      const { body, set } = ctx;
      const user = ctx.user as User | null;
      const { currentPassword, newPassword } = body;

      if (!user) {
        set.status = 401;
        return { error: "Not authenticated" };
      }

      // Verify current password
      const isValid = await authService.verifyPassword(
        currentPassword,
        user.passwordHash
      );

      if (!isValid) {
        set.status = 400;
        return { error: "Current password is incorrect" };
      }

      // Validate new password
      if (!newPassword || newPassword.length < 6) {
        set.status = 400;
        return { error: "New password must be at least 6 characters" };
      }

      // Update password
      const result = await authService.updatePassword(user.id, newPassword);

      if (!result.success) {
        set.status = 500;
        return { error: result.error };
      }

      return {
        success: true,
        message: "Password updated. Please log in again."
      };
    },
    {
      body: t.Object({
        currentPassword: t.String(),
        newPassword: t.String()
      })
    }
  )

  /**
   * PATCH /api/auth/avatar
   * Update current user's avatar
   */
  .patch(
    "/avatar",
    async (ctx: any) => {
      const { body, set } = ctx;
      const user = ctx.user as User | null;

      if (!user) {
        set.status = 401;
        return { error: "Not authenticated" };
      }

      const result = await authService.updateAvatar(user.id, body.avatar);

      if (!result.success) {
        set.status = 500;
        return { error: result.error };
      }

      return { success: true };
    },
    {
      body: t.Object({
        avatar: t.Union([t.String(), t.Null()])
      })
    }
  );
