// src/server/services/authService.ts
import { and, eq, gt, lt } from "drizzle-orm";
import { db, schema } from "../db";
import { generateId, generateSessionId, getSessionExpiry } from "../utils";

const { users, sessions } = schema;

/**
 * Authentication Service
 * Handles user authentication, password hashing, and session management
 */
export class AuthService {
  /**
   * Hash a password using Bun's built-in password hashing (Argon2id)
   */
  async hashPassword(password: string): Promise<string> {
    return await Bun.password.hash(password, {
      algorithm: "argon2id",
      memoryCost: 65536, // 64 MB
      timeCost: 3
    });
  }

  /**
   * Verify a password against a hash
   */
  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return await Bun.password.verify(password, hash);
  }

  /**
   * Check if any users exist in the database
   */
  async hasUsers(): Promise<boolean> {
    const result = await db.select({ id: users.id }).from(users).limit(1);
    return result.length > 0;
  }

  /**
   * Get user count
   */
  async getUserCount(): Promise<number> {
    const result = await db.select({ id: users.id }).from(users);
    return result.length;
  }

  /**
   * Create a new user
   * First user automatically becomes admin
   */
  async createUser(
    username: string,
    password: string,
    isAdmin?: boolean
  ): Promise<{
    success: boolean;
    user?: typeof users.$inferSelect;
    error?: string;
  }> {
    try {
      // Check if username already exists
      const existing = await db
        .select()
        .from(users)
        .where(eq(users.username, username))
        .limit(1);

      if (existing.length > 0) {
        return { success: false, error: "Username already exists" };
      }

      // Determine if this is the first user (auto-admin)
      const hasExistingUsers = await this.hasUsers();
      const shouldBeAdmin = isAdmin ?? !hasExistingUsers;

      // Hash password
      const passwordHash = await this.hashPassword(password);

      // Create user
      const id = generateId();
      const now = new Date();

      await db.insert(users).values({
        id,
        username,
        passwordHash,
        isAdmin: shouldBeAdmin,
        createdAt: now,
        updatedAt: now
      });

      const user = await db
        .select()
        .from(users)
        .where(eq(users.id, id))
        .limit(1);

      return { success: true, user: user[0] };
    } catch (error) {
      console.error("Error creating user:", error);
      return { success: false, error: "Failed to create user" };
    }
  }

  /**
   * Authenticate a user with username and password
   */
  async authenticate(
    username: string,
    password: string
  ): Promise<{
    success: boolean;
    user?: typeof users.$inferSelect;
    error?: string;
  }> {
    try {
      const result = await db
        .select()
        .from(users)
        .where(eq(users.username, username))
        .limit(1);

      if (result.length === 0) {
        return { success: false, error: "Invalid username or password" };
      }

      const user = result[0];
      const isValid = await this.verifyPassword(password, user.passwordHash);

      if (!isValid) {
        return { success: false, error: "Invalid username or password" };
      }

      return { success: true, user };
    } catch (error) {
      console.error("Error authenticating user:", error);
      return { success: false, error: "Authentication failed" };
    }
  }

  /**
   * Create a new session for a user
   */
  async createSession(userId: string): Promise<string> {
    const sessionId = generateSessionId();
    const expiresAt = getSessionExpiry();

    await db.insert(sessions).values({
      id: sessionId,
      userId,
      expiresAt,
      createdAt: new Date()
    });

    return sessionId;
  }

  /**
   * Validate a session and return the associated user
   */
  async validateSession(sessionId: string): Promise<{
    valid: boolean;
    user?: typeof users.$inferSelect;
    session?: typeof sessions.$inferSelect;
  }> {
    try {
      const result = await db
        .select()
        .from(sessions)
        .where(
          and(eq(sessions.id, sessionId), gt(sessions.expiresAt, new Date()))
        )
        .limit(1);

      if (result.length === 0) {
        return { valid: false };
      }

      const session = result[0];
      const userResult = await db
        .select()
        .from(users)
        .where(eq(users.id, session.userId))
        .limit(1);

      if (userResult.length === 0) {
        return { valid: false };
      }

      return { valid: true, user: userResult[0], session };
    } catch (error) {
      console.error("Error validating session:", error);
      return { valid: false };
    }
  }

  /**
   * Delete a session (logout)
   */
  async deleteSession(sessionId: string): Promise<void> {
    await db.delete(sessions).where(eq(sessions.id, sessionId));
  }

  /**
   * Delete all sessions for a user
   */
  async deleteUserSessions(userId: string): Promise<void> {
    await db.delete(sessions).where(eq(sessions.userId, userId));
  }

  /**
   * Clean up expired sessions
   */
  async cleanupExpiredSessions(): Promise<number> {
    await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));

    return 0;
  }

  /**
   * Get user by ID
   */
  async getUserById(
    id: string
  ): Promise<typeof users.$inferSelect | undefined> {
    const result = await db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    return result[0];
  }

  /**
   * Get all users (for admin)
   */
  async getAllUsers(): Promise<
    Omit<typeof users.$inferSelect, "passwordHash">[]
  > {
    const result = await db
      .select({
        id: users.id,
        username: users.username,
        isAdmin: users.isAdmin,
        avatar: users.avatar,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt
      })
      .from(users);

    return result;
  }

  /**
   * Update user password
   */
  async updatePassword(
    userId: string,
    newPassword: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const passwordHash = await this.hashPassword(newPassword);

      await db
        .update(users)
        .set({ passwordHash, updatedAt: new Date() })
        .where(eq(users.id, userId));

      // Invalidate all sessions for this user (force re-login)
      await this.deleteUserSessions(userId);

      return { success: true };
    } catch (error) {
      console.error("Error updating password:", error);
      return { success: false, error: "Failed to update password" };
    }
  }

  /**
   * Update user avatar
   */
  async updateAvatar(
    userId: string,
    avatar: string | null
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await db
        .update(users)
        .set({ avatar, updatedAt: new Date() })
        .where(eq(users.id, userId));

      return { success: true };
    } catch (error) {
      console.error("Error updating avatar:", error);
      return { success: false, error: "Failed to update avatar" };
    }
  }

  /**
   * Delete a user (admin only, cannot delete self)
   */
  async deleteUser(
    userId: string,
    requestingUserId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      if (userId === requestingUserId) {
        return { success: false, error: "Cannot delete your own account" };
      }

      // Delete all sessions first
      await this.deleteUserSessions(userId);

      // Delete user
      await db.delete(users).where(eq(users.id, userId));

      return { success: true };
    } catch (error) {
      console.error("Error deleting user:", error);
      return { success: false, error: "Failed to delete user" };
    }
  }
}

// Export singleton instance
export const authService = new AuthService();
