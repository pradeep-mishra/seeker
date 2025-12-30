import ky, { HTTPError } from "ky";

/**
 * Custom error class that preserves the error message from server
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public status?: number,
    public response?: Response
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * API client configured for the backend
 */
export const api = ky.create({
  prefixUrl: "/api",
  credentials: "include",
  timeout: 30000,
  hooks: {
    beforeError: [
      async (error) => {
        const { response } = error;

        if (response) {
          try {
            // Clone the response before reading to avoid consuming the body
            const clonedResponse = response.clone();
            const body = (await clonedResponse.json()) as {
              error?: string;
              message?: string;
              success?: boolean;
            };

            // Extract error message from server response
            const errorMessage = body.error || body.message || error.message;

            // Create a new error with the extracted message
            const apiError = new ApiError(
              errorMessage,
              response.status,
              response
            );

            // Copy properties from original error to maintain ky's error structure
            // while overriding the message
            Object.assign(apiError, error);
            apiError.message = errorMessage;

            return apiError as HTTPError;
          } catch {
            // If parsing fails, return original error
          }
        }

        return error;
      }
    ]
  }
});

/**
 * Type-safe API response wrapper
 */
export async function apiCall<T>(
  promise: Promise<T>
): Promise<{ data: T; error: null } | { data: null; error: string }> {
  try {
    const data = await promise;
    return { data, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { data: null, error: message };
  }
}

// ============================================
// Auth API
// ============================================

export interface User {
  id: string;
  username: string;
  isAdmin: boolean;
  avatar: string | null;
  createdAt?: string;
}

export interface AuthStatus {
  hasUsers: boolean;
  requiresSetup: boolean;
}

export interface AuthResponse {
  success: boolean;
  user?: User;
  autoLoggedIn?: boolean;
  error?: string;
}

export interface MeResponse {
  authenticated: boolean;
  user: User | null;
}

export const authApi = {
  status: () => api.get("auth/status").json<AuthStatus>(),

  register: (username: string, password: string) =>
    api
      .post("auth/register", { json: { username, password } })
      .json<AuthResponse>(),

  login: (username: string, password: string) =>
    api
      .post("auth/login", { json: { username, password } })
      .json<AuthResponse>(),

  logout: () => api.post("auth/logout").json<{ success: boolean }>(),

  me: () => api.get("auth/me").json<MeResponse>(),

  changePassword: (currentPassword: string, newPassword: string) =>
    api
      .patch("auth/password", { json: { currentPassword, newPassword } })
      .json<{ success: boolean; message?: string }>(),

  updateAvatar: (avatar: string | null) =>
    api.patch("auth/avatar", { json: { avatar } }).json<{ success: boolean }>()
};

// ============================================
// Files API
// ============================================

export interface FileItem {
  name: string;
  path: string;
  size: number;
  modifiedAt: string;
  isDirectory: boolean;
  mimeType: string | null;
  extension: string;
  fileCount?: number;
  folderCount?: number;
}

export interface PaginatedFiles {
  items: FileItem[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
  _warning?: string; // Warning for large directories
}

export interface ListFilesParams {
  path: string;
  page?: number;
  limit?: number;
  sortBy?: "name" | "date" | "size" | "type";
  sortOrder?: "asc" | "desc";
  showHidden?: boolean;
  search?: string;
}

export interface SearchFilesParams {
  path: string;
  q: string;
  recursive?: boolean;
  showHidden?: boolean;
  limit?: number;
}

export interface FileOperationResult {
  success: boolean;
  path?: string;
  error?: string;
}

export interface BatchOperationResult {
  success: boolean;
  results: {
    path?: string;
    source?: string;
    destination?: string;
    success: boolean;
    error?: string;
  }[];
}

export const filesApi = {
  list: (params: ListFilesParams) => {
    const searchParams = new URLSearchParams();
    searchParams.set("path", params.path);
    if (params.page) searchParams.set("page", String(params.page));
    if (params.limit) searchParams.set("limit", String(params.limit));
    if (params.sortBy) searchParams.set("sortBy", params.sortBy);
    if (params.sortOrder) searchParams.set("sortOrder", params.sortOrder);
    if (params.showHidden !== undefined)
      searchParams.set("showHidden", String(params.showHidden));
    if (params.search) searchParams.set("search", params.search);

    return api.get(`files?${searchParams}`).json<PaginatedFiles>();
  },

  search: (params: SearchFilesParams) => {
    const searchParams = new URLSearchParams();
    searchParams.set("path", params.path);
    searchParams.set("q", params.q);
    if (params.recursive !== undefined)
      searchParams.set("recursive", String(params.recursive));
    if (params.showHidden !== undefined)
      searchParams.set("showHidden", String(params.showHidden));
    if (params.limit) searchParams.set("limit", String(params.limit));

    return api
      .get(`files/search?${searchParams}`)
      .json<{ items: FileItem[]; total: number }>();
  },

  stats: (path: string, options?: { calculateSize?: boolean }) =>
    api
      .get(
        `files/stats?path=${encodeURIComponent(path)}${
          options?.calculateSize ? "&calculateSize=true" : ""
        }`
      )
      .json<FileItem>(),

  download: (path: string, inline?: boolean) =>
    `/api/files/download?path=${encodeURIComponent(path)}${
      inline ? "&inline=true" : ""
    }`,

  stream: (path: string) =>
    `/api/files/stream?path=${encodeURIComponent(path)}`,

  thumbnail: (path: string) =>
    `/api/files/thumbnail?path=${encodeURIComponent(path)}`,

  getContent: (path: string) =>
    api
      .get(`files/content?path=${encodeURIComponent(path)}`)
      .json<{ content: string; mimeType: string }>(),

  saveContent: (path: string, content: string) =>
    api
      .post("files/content", { json: { path, content } })
      .json<FileOperationResult>(),

  createFolder: (path: string, name: string) =>
    api
      .post("files/folder", { json: { path, name } })
      .json<FileOperationResult>(),

  createFile: (path: string, name: string) =>
    api
      .post("files/file", { json: { path, name } })
      .json<FileOperationResult>(),

  rename: (path: string, newName: string) =>
    api
      .post("files/rename", { json: { path, newName } })
      .json<FileOperationResult>(),

  copy: (
    paths: string[],
    destination: string,
    conflictAction?: "overwrite" | "skip" | "rename"
  ) =>
    api
      .post("files/copy", { json: { paths, destination, conflictAction } })
      .json<BatchOperationResult>(),

  move: (
    paths: string[],
    destination: string,
    conflictAction?: "overwrite" | "skip" | "rename"
  ) =>
    api
      .post("files/move", { json: { paths, destination, conflictAction } })
      .json<BatchOperationResult>(),

  delete: (paths: string[]) =>
    api.delete("files", { json: { paths } }).json<BatchOperationResult>(),

  cancelUpload: (uploadId: string) =>
    api
      .post("files/upload/cancel", { json: { uploadId } })
      .json<{ success: boolean }>(),

  upload: async (
    path: string,
    files: File[],
    onProgress?: (progress: number) => void,
    signal?: AbortSignal
  ): Promise<{
    success: boolean;
    results: { name: string; success: boolean; error?: string }[];
  }> => {
    const results: { name: string; success: boolean; error?: string }[] = [];
    const CHUNK_SIZE = 10 * 1024 * 1024; // 10MB chunks
    const CONCURRENCY = 4; // 4 concurrent requests

    // Calculate total size for global progress
    const totalSize = files.reduce((acc, file) => acc + file.size, 0);
    let uploadedBytes = 0;

    // Track active uploads for cancellation
    const activeUploadIds: string[] = [];

    // Register abort handler
    if (signal) {
      signal.addEventListener("abort", () => {
        // We'll try to clean up active uploads on the server
        for (const uploadId of activeUploadIds) {
          filesApi.cancelUpload(uploadId).catch(console.error);
        }
      });
    }

    for (const file of files) {
      // Check for abort before starting new file
      if (signal?.aborted) {
        throw new Error("Upload cancelled");
      }

      try {
        const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

        // 1. Initialize upload
        const initResponse = await api
          .post("files/upload/init", {
            json: {
              path,
              filename: file.name,
              totalChunks
            },
            signal // Pass signal to init request
          })
          .json<{ success: boolean; uploadId: string; error?: string }>();

        if (!initResponse.success || !initResponse.uploadId) {
          throw new Error(initResponse.error || "Failed to initialize upload");
        }

        const uploadId = initResponse.uploadId;
        activeUploadIds.push(uploadId);
        const chunks = Array.from({ length: totalChunks }, (_, i) => i);

        // 2. Upload chunks with concurrency
        const uploadChunk = async (chunkIndex: number) => {
          if (signal?.aborted) throw new Error("Upload cancelled");

          const start = chunkIndex * CHUNK_SIZE;
          const end = Math.min(start + CHUNK_SIZE, file.size);
          const chunk = file.slice(start, end);
          let chunkUploaded = 0;

          const formData = new FormData();
          formData.append("uploadId", uploadId);
          formData.append("chunkIndex", String(chunkIndex));
          formData.append("chunk", chunk);

          return new Promise<void>((resolve, reject) => {
            const xhr = new XMLHttpRequest();

            // Handle manual abort from signal
            const abortHandler = () => {
              xhr.abort();
              reject(new Error("Upload cancelled"));
            };

            if (signal) {
              signal.addEventListener("abort", abortHandler);
            }

            // Track upload progress for this chunk
            if (xhr.upload) {
              xhr.upload.addEventListener("progress", (e) => {
                if (e.lengthComputable) {
                  const loaded = e.loaded;
                  // Add the difference since last event to global
                  const diff = loaded - chunkUploaded;
                  chunkUploaded = loaded;
                  uploadedBytes += diff;

                  if (onProgress) {
                    onProgress((uploadedBytes / totalSize) * 100);
                  }
                }
              });
            }

            xhr.addEventListener("load", () => {
              if (signal) signal.removeEventListener("abort", abortHandler);

              if (xhr.status >= 200 && xhr.status < 300) {
                // Ensure we counted exactly the full size of this chunk
                // Correct for any minor progress event discrepancies
                const remaining = chunk.size - chunkUploaded;
                if (remaining !== 0) {
                  uploadedBytes += remaining;
                  if (onProgress) onProgress((uploadedBytes / totalSize) * 100);
                }

                resolve();
              } else {
                reject(new Error(`Chunk upload failed: ${xhr.statusText}`));
              }
            });

            xhr.addEventListener("error", () => {
              if (signal) signal.removeEventListener("abort", abortHandler);
              reject(new Error("Network error"));
            });

            xhr.addEventListener("abort", () => {
              if (signal) signal.removeEventListener("abort", abortHandler);
              reject(new Error("Aborted"));
            });

            xhr.open("POST", "/api/files/upload/chunk");
            xhr.withCredentials = true;
            xhr.send(formData);
          });
        };

        // Process chunks using a pool for maximum throughput
        const pool = new Set<Promise<void>>();

        for (const chunkIndex of chunks) {
          if (signal?.aborted) break;

          const p = uploadChunk(chunkIndex).then(() => {
            pool.delete(p);
          });
          pool.add(p);

          if (pool.size >= CONCURRENCY) {
            await Promise.race(pool);
          }
        }

        // Wait for remaining requests
        await Promise.all(pool);

        if (signal?.aborted) {
          throw new Error("Upload cancelled");
        }

        // 3. Finalize upload
        const finalizeResponse = await api
          .post("files/upload/finalize", {
            json: {
              uploadId,
              path,
              filename: file.name
            },
            timeout: false, // Disable timeout for large file assembly
            signal
          })
          .json<{ success: boolean; path?: string; error?: string }>();

        if (!finalizeResponse.success) {
          throw new Error(
            finalizeResponse.error || "Failed to finalize upload"
          );
        }

        // Remove from active list as it's done
        const index = activeUploadIds.indexOf(uploadId);
        if (index > -1) activeUploadIds.splice(index, 1);

        results.push({ name: file.name, success: true });
      } catch (error) {
        if (
          signal?.aborted ||
          (error as Error).message === "Upload cancelled"
        ) {
          // Re-throw if cancelled so we stop processing files
          throw new Error("Upload cancelled");
        }

        console.error(`Failed to upload ${file.name}:`, error);
        results.push({
          name: file.name,
          success: false,
          error: (error as Error).message
        });

        // Add remaining file size to uploadedBytes so we don't stall global progress
        // This is an approximation
        uploadedBytes += file.size;
      }
    }

    return {
      success: results.every((r) => r.success),
      results
    };
  }
};

// ============================================
// Mounts API
// ============================================

export interface StorageStats {
  total: number;
  used: number;
  free: number;
  percentUsed: number;
}

export interface Mount {
  id: string;
  path: string;
  label: string;
  createdAt: string;
  stats?: StorageStats;
  accessible: boolean;
}

export const mountsApi = {
  list: () => api.get("mounts").json<{ mounts: Mount[] }>(),

  hasMounts: () => api.get("mounts/has-mounts").json<{ hasMounts: boolean }>(),

  get: (id: string) => api.get(`mounts/${id}`).json<{ mount: Mount }>(),

  getStats: (id: string) =>
    api.get(`mounts/${id}/stats`).json<{ stats: StorageStats }>(),

  add: (path: string, label: string) =>
    api
      .post("mounts", { json: { path, label } })
      .json<{ success: boolean; mount?: Mount; error?: string }>(),

  update: (id: string, label: string) =>
    api.patch(`mounts/${id}`, { json: { label } }).json<{ success: boolean }>(),

  remove: (id: string) =>
    api.delete(`mounts/${id}`).json<{ success: boolean }>()
};

// ============================================
// Bookmarks API
// ============================================

export interface Bookmark {
  id: string;
  userId: string;
  path: string;
  name: string;
  sortOrder: number;
  createdAt: string;
}

export const bookmarksApi = {
  list: () => api.get("bookmarks").json<{ bookmarks: Bookmark[] }>(),

  check: (path: string) =>
    api
      .get(`bookmarks/check?path=${encodeURIComponent(path)}`)
      .json<{ isBookmarked: boolean }>(),

  add: (path: string, name: string) =>
    api
      .post("bookmarks", { json: { path, name } })
      .json<{ success: boolean; bookmark?: Bookmark }>(),

  update: (id: string, name: string) =>
    api
      .patch(`bookmarks/${id}`, { json: { name } })
      .json<{ success: boolean }>(),

  reorder: (orderedIds: string[]) =>
    api
      .patch("bookmarks/reorder", { json: { orderedIds } })
      .json<{ success: boolean }>(),

  remove: (id: string) =>
    api.delete(`bookmarks/${id}`).json<{ success: boolean }>()
};

// ============================================
// Recent API
// ============================================

export interface RecentLocation {
  id: string;
  userId: string;
  path: string;
  accessedAt: string;
}

export const recentApi = {
  list: (limit?: number) => {
    const params = limit ? `?limit=${limit}` : "";
    return api.get(`recent${params}`).json<{ recent: RecentLocation[] }>();
  },

  add: (path: string) =>
    api.post("recent", { json: { path } }).json<{ success: boolean }>(),

  remove: (id: string) =>
    api.delete(`recent/${id}`).json<{ success: boolean }>(),

  clear: () => api.delete("recent").json<{ success: boolean }>()
};

// ============================================
// Settings API
// ============================================

export interface AppSettings {
  viewMode: "list" | "thumbnail" | "card";
  sortBy: "name" | "date" | "size" | "type";
  sortOrder: "asc" | "desc";
  showHiddenFiles: boolean;
  theme: string;
}

export const settingsApi = {
  get: () => api.get("settings").json<{ settings: AppSettings }>(),

  update: (settings: Partial<AppSettings>) =>
    api
      .patch("settings", { json: settings })
      .json<{ success: boolean; settings: AppSettings }>(),

  reset: () =>
    api
      .post("settings/reset")
      .json<{ success: boolean; settings: AppSettings }>()
};

// ============================================
// Users API (Admin)
// ============================================

export const usersApi = {
  list: () => api.get("users").json<{ users: User[] }>(),

  create: (username: string, password: string, isAdmin?: boolean) =>
    api
      .post("users", { json: { username, password, isAdmin } })
      .json<{ success: boolean; user?: User }>(),

  delete: (id: string) =>
    api.delete(`users/${id}`).json<{ success: boolean }>(),

  resetPassword: (id: string, password: string) =>
    api
      .patch(`users/${id}/password`, { json: { password } })
      .json<{ success: boolean }>()
};
