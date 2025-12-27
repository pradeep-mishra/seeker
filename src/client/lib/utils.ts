// src/client/lib/utils.ts

/**
 * Conditionally join class names
 */
export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(" ");
}

/**
 * Format file size in human-readable format
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";

  const units = ["B", "KB", "MB", "GB", "TB"];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${units[i]}`;
}

/**
 * Format date in a user-friendly way
 */
export function formatDate(date: string | Date): string {
  const d = new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return `Today, ${d.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit"
    })}`;
  }

  if (diffDays === 1) {
    return `Yesterday, ${d.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit"
    })}`;
  }

  if (diffDays < 7) {
    return d.toLocaleDateString(undefined, {
      weekday: "long",
      hour: "numeric",
      minute: "2-digit"
    });
  }

  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}

/**
 * Format relative time (e.g., "2 hours ago")
 */
export function formatRelativeTime(date: string | Date): string {
  const d = new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);

  if (diffSecs < 60) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffWeeks < 4) return `${diffWeeks}w ago`;
  if (diffMonths < 12) return `${diffMonths}mo ago`;

  return formatDate(date);
}

/**
 * Get file extension from filename
 */
export function getExtension(filename: string): string {
  const ext = filename.split(".").pop();
  return ext && ext !== filename ? ext.toLowerCase() : "";
}

/**
 * Get parent path from a path
 */
export function getParentPath(path: string): string {
  const segments = path.split("/").filter(Boolean);
  segments.pop();
  return "/" + segments.join("/");
}

/**
 * Get filename from path
 */
export function getFileName(path: string): string {
  return path.split("/").filter(Boolean).pop() || "";
}

/**
 * Parse path into segments
 */
export function parsePath(path: string): string[] {
  return path.split("/").filter(Boolean);
}

/**
 * Get path relative to mount root
 */
export function getMountRelativePath(
  currentPath: string,
  mountPath: string
): string {
  if (!currentPath || !mountPath) return currentPath;

  // Normalize paths (remove trailing slashes)
  const normalizedCurrent = currentPath.replace(/\/+$/, "");
  const normalizedMount = mountPath.replace(/\/+$/, "");

  // If current path starts with mount path, return the relative part
  if (normalizedCurrent.startsWith(normalizedMount)) {
    const relative = normalizedCurrent.slice(normalizedMount.length);
    // Return "/" if at mount root, otherwise return the relative path
    return relative || "/";
  }

  return currentPath;
}

/**
 * Join path segments
 */
export function joinPath(...segments: string[]): string {
  return (
    "/" +
    segments
      .map((s) => s.replace(/^\/+|\/+$/g, ""))
      .filter(Boolean)
      .join("/")
  );
}

/**
 * Debounce a function
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

/**
 * Throttle a function
 */
export function throttle<T extends (...args: unknown[]) => unknown>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;

  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

/**
 * Check if current platform is Mac
 */
export function isMac(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Mac|iPod|iPhone|iPad/.test(navigator.platform);
}

/**
 * Get modifier key based on platform
 */
export function getModifierKey(): string {
  return isMac() ? "⌘" : "Ctrl";
}

/**
 * Check if modifier key is pressed
 */
export function isModifierPressed(e: KeyboardEvent | MouseEvent): boolean {
  return isMac() ? e.metaKey : e.ctrlKey;
}

/**
 * Generate a unique ID
 */
export function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}

/**
 * Copy text to clipboard
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * Download a file
 */
export function downloadFile(url: string, filename?: string): void {
  const link = document.createElement("a");
  link.href = url;
  link.download = filename || "";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Get file icon based on mime type or extension
 */
export function getFileIconType(
  mimeType: string | null,
  extension: string
): string {
  if (!mimeType) {
    // Fallback based on extension
    const extMap: Record<string, string> = {
      pdf: "pdf",
      doc: "word",
      docx: "word",
      xls: "excel",
      xlsx: "excel",
      ppt: "powerpoint",
      pptx: "powerpoint",
      zip: "archive",
      rar: "archive",
      "7z": "archive",
      tar: "archive",
      gz: "archive",
      mp3: "audio",
      wav: "audio",
      flac: "audio",
      mp4: "video",
      mov: "video",
      avi: "video",
      mkv: "video",
      js: "code",
      ts: "code",
      jsx: "code",
      tsx: "code",
      py: "code",
      java: "code",
      c: "code",
      cpp: "code",
      go: "code",
      rs: "code",
      html: "code",
      css: "code",
      json: "code",
      md: "text",
      txt: "text"
    };
    return extMap[extension] || "file";
  }

  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";
  if (mimeType.startsWith("text/")) return "text";
  if (mimeType === "application/pdf") return "pdf";
  if (mimeType.includes("word") || mimeType.includes("document")) return "word";
  if (mimeType.includes("excel") || mimeType.includes("spreadsheet"))
    return "excel";
  if (mimeType.includes("powerpoint") || mimeType.includes("presentation"))
    return "powerpoint";
  if (
    mimeType.includes("zip") ||
    mimeType.includes("compressed") ||
    mimeType.includes("archive")
  )
    return "archive";

  return "file";
}

/**
 * Check if a file is an image
 */
export function isImage(mimeType: string | null): boolean {
  if (!mimeType) return false;
  return mimeType.startsWith("image/");
}

/**
 * Check if a file is a PDF
 */
export function isPdf(mimeType: string | null): boolean {
  if (!mimeType) return false;
  return mimeType === "application/pdf";
}

/**
 * Check if a file can have a thumbnail (images or PDFs)
 */
export function hasThumbnail(mimeType: string | null): boolean {
  return isImage(mimeType) || isPdf(mimeType);
}

/**
 * Check if a file is a video
 */
export function isVideo(mimeType: string | null): boolean {
  if (!mimeType) return false;
  return mimeType.startsWith("video/");
}

/**
 * Check if a file is playable audio
 */
export function isAudio(mimeType: string | null): boolean {
  if (!mimeType) return false;
  return mimeType.startsWith("audio/");
}

/**
 * Check if a file is an editable text file
 */
export function isTextFile(
  mimeType: string | null,
  extension: string,
  filename?: string
): boolean {
  if (mimeType?.startsWith("text/")) return true;

  // Check for .env files (including .env.local, .env.production, etc.)
  if (filename) {
    const name = filename.toLowerCase();
    if (name === ".env" || name.startsWith(".env.")) {
      return true;
    }
  }

  const textExtensions = [
    "txt",
    "md",
    "json",
    "yml",
    "yaml",
    "xml",
    "html",
    "css",
    "js",
    "ts",
    "jsx",
    "tsx",
    "sh",
    "bash",
    "zsh",
    "conf",
    "ini",
    "log",
    "env",
    "sql",
    "gitignore",
    "dockerfile",
    "py"
  ];

  return textExtensions.includes(extension.toLowerCase());
}

/**
 * Sleep for a specified duration
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Clamp a number between min and max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
