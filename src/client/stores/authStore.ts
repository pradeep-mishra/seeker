// src/client/stores/authStore.ts
import { create } from "zustand";
import { authApi, type User } from "../lib/api";

interface AuthState {
  // State
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isInitialized: boolean;
  requiresSetup: boolean;

  // Actions
  initialize: () => Promise<void>;
  login: (
    username: string,
    password: string
  ) => Promise<{ success: boolean; error?: string }>;
  register: (
    username: string,
    password: string
  ) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  updateUser: (updates: Partial<User>) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  // Initial state
  user: null,
  isAuthenticated: false,
  isLoading: true,
  isInitialized: false,
  requiresSetup: false,

  // Initialize auth state
  initialize: async () => {
    try {
      // Check auth status
      const status = await authApi.status();

      if (!status.hasUsers) {
        set({
          isLoading: false,
          isInitialized: true,
          requiresSetup: true,
          isAuthenticated: false,
          user: null
        });
        return;
      }

      // Check if user is logged in
      const me = await authApi.me();

      set({
        user: me.user,
        isAuthenticated: me.authenticated,
        isLoading: false,
        isInitialized: true,
        requiresSetup: false
      });
    } catch (error) {
      console.error("Auth initialization failed:", error);
      set({
        isLoading: false,
        isInitialized: true,
        isAuthenticated: false,
        user: null
      });
    }
  },

  // Login
  login: async (username, password) => {
    set({ isLoading: true });

    try {
      const response = await authApi.login(username, password);

      if (response.success && response.user) {
        set({
          user: response.user,
          isAuthenticated: true,
          isLoading: false
        });
        return { success: true };
      }

      set({ isLoading: false });
      return { success: false, error: response.error || "Login failed" };
    } catch (error: any) {
      set({ isLoading: false });
      return { success: false, error: error?.message || "Login failed" };
    }
  },

  // Register (first user or admin creating new user)
  register: async (username, password) => {
    set({ isLoading: true });

    try {
      const response = await authApi.register(username, password);

      if (response.success) {
        // If auto-logged in (first user)
        if (response.autoLoggedIn && response.user) {
          set({
            user: response.user,
            isAuthenticated: true,
            isLoading: false,
            requiresSetup: false
          });
        } else {
          set({ isLoading: false });
        }
        return { success: true };
      }

      set({ isLoading: false });
      return { success: false, error: response.error || "Registration failed" };
    } catch (error: any) {
      set({ isLoading: false });
      return {
        success: false,
        error: error?.message || "Registration failed"
      };
    }
  },

  // Logout
  logout: async () => {
    try {
      await authApi.logout();
    } finally {
      set({
        user: null,
        isAuthenticated: false
      });
    }
  },

  // Update user data
  updateUser: (updates) => {
    const { user } = get();
    if (user) {
      set({ user: { ...user, ...updates } });
    }
  }
}));
