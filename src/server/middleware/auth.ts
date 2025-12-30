import { Elysia } from "elysia";
import type { Session, User } from "../db/schema";
import { authService } from "../services";

/**
 * Session cookie name
 */
export const SESSION_COOKIE_NAME = "seeker_session";

/**
 * Cookie options for session
 */
export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 30 // 30 days
};

/**
 * Extended context type with auth information
 */
export interface AuthContext {
  user: User | null;
  session: Session | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
}

/**
 * Authentication middleware
 * Validates session cookie and adds user to context
 */
export const authMiddleware = new Elysia({ name: "auth-middleware" }).derive(
  { as: "global" },
  async ({ cookie }): Promise<Record<string, unknown>> => {
    const sessionCookie = cookie[SESSION_COOKIE_NAME];
    const sessionId = sessionCookie?.value as string | undefined;

    if (!sessionId) {
      return {
        user: null,
        session: null,
        isAuthenticated: false,
        isAdmin: false
      };
    }

    const { valid, user, session } = await authService.validateSession(
      sessionId
    );

    if (!valid || !user) {
      return {
        user: null,
        session: null,
        isAuthenticated: false,
        isAdmin: false
      };
    }

    return {
      user,
      session: session || null,
      isAuthenticated: true,
      isAdmin: user.isAdmin
    };
  }
);

/**
 * Require authentication guard
 * Returns 401 if not authenticated
 */
export const requireAuth = new Elysia({ name: "require-auth" })
  .use(authMiddleware)
  .onBeforeHandle((context: any) => {
    if (!context.isAuthenticated) {
      context.set.status = 401;
      return { error: "Unauthorized", message: "Authentication required" };
    }
  });

/**
 * Require admin guard
 * Returns 403 if not admin
 */
export const requireAdmin = new Elysia({ name: "require-admin" })
  .use(requireAuth)
  .onBeforeHandle((context: any) => {
    if (!context.isAdmin) {
      context.set.status = 403;
      return { error: "Forbidden", message: "Admin access required" };
    }
  });

/**
 * Helper to set session cookie
 */
export function setSessionCookie(
  cookie: Record<
    string,
    { value: string; set: (options: Record<string, unknown>) => void }
  >,
  sessionId: string
): void {
  cookie[SESSION_COOKIE_NAME].set({
    value: sessionId,
    ...SESSION_COOKIE_OPTIONS
  });
}

/**
 * Helper to clear session cookie
 */
export function clearSessionCookie(
  cookie: Record<string, { value: string; remove: () => void }>
): void {
  cookie[SESSION_COOKIE_NAME].remove();
}
