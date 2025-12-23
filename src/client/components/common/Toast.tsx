// src/client/components/common/Toast.tsx
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  Info,
  Upload,
  X
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { create } from "zustand";

// Toast types
type ToastType = "success" | "error" | "warning" | "info" | "progress";

interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
  progress?: number; // 0-100 for progress toasts
  isPersistent?: boolean; // Won't auto-dismiss
  onCancel?: () => void;
}

// Toast store
interface ToastState {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, "id">) => string; // Return toast ID
  updateToast: (id: string, updates: Partial<Omit<Toast, "id">>) => void;
  removeToast: (id: string) => void;
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  addToast: (toast) => {
    const id = Math.random().toString(36).substring(2, 9);
    set((state) => ({
      toasts: [...state.toasts, { ...toast, id }]
    }));
    return id;
  },
  updateToast: (id, updates) => {
    set((state) => ({
      toasts: state.toasts.map((t) => (t.id === id ? { ...t, ...updates } : t))
    }));
  },
  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id)
    }));
  }
}));

// Helper functions for creating toasts
export const toast = {
  success: (message: string, duration?: number) =>
    useToastStore.getState().addToast({ type: "success", message, duration }),
  error: (message: string, duration?: number) =>
    useToastStore.getState().addToast({ type: "error", message, duration }),
  warning: (message: string, duration?: number) =>
    useToastStore.getState().addToast({ type: "warning", message, duration }),
  info: (message: string, duration?: number) =>
    useToastStore.getState().addToast({ type: "info", message, duration }),
  progress: (message: string, progress = 0, onCancel?: () => void) =>
    useToastStore.getState().addToast({
      type: "progress",
      message,
      progress,
      isPersistent: true,
      onCancel
    }),
  update: (id: string, updates: Partial<Omit<Toast, "id">>) =>
    useToastStore.getState().updateToast(id, updates),
  dismiss: (id: string) => useToastStore.getState().removeToast(id)
};

// Individual toast component
function ToastItem({
  toast,
  onRemove
}: {
  toast: Toast;
  onRemove: () => void;
}) {
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    // Don't auto-dismiss persistent toasts (like progress)
    if (toast.isPersistent) return;

    const duration = toast.duration ?? 4000;
    const timer = setTimeout(() => {
      setIsExiting(true);
      setTimeout(onRemove, 200);
    }, duration);

    return () => clearTimeout(timer);
  }, [toast.duration, toast.isPersistent, onRemove]);

  const handleClose = useCallback(() => {
    setIsExiting(true);
    setTimeout(onRemove, 200);
  }, [onRemove]);

  const handleCancel = useCallback(() => {
    if (toast.onCancel) {
      toast.onCancel();
      handleClose();
    }
  }, [toast.onCancel, handleClose]);

  const icons = {
    success: <CheckCircle className="h-5 w-5 text-success" />,
    error: <AlertCircle className="h-5 w-5 text-error" />,
    warning: <AlertTriangle className="h-5 w-5 text-warning" />,
    info: <Info className="h-5 w-5 text-info" />,
    progress: <Upload className="h-5 w-5 text-accent" />
  };

  const bgColors = {
    success: "bg-success-surface",
    error: "bg-error-surface",
    warning: "bg-warning-surface",
    info: "bg-info-surface",
    progress: "bg-accent/10"
  };

  return (
    <div
      className={`
        flex flex-col gap-2 p-4 rounded-lg shadow-medium
        bg-surface border border-border min-w-[300px]
        ${isExiting ? "toast-exit" : "toast-enter"}
      `}>
      <div className="flex items-start gap-3">
        <div className={`p-1 rounded-full ${bgColors[toast.type]}`}>
          {icons[toast.type]}
        </div>
        <div className="flex-1">
          <p className="text-sm text-content">{toast.message}</p>
        </div>
        <button
          onClick={handleClose}
          className="p-1 rounded hover:bg-surface-hover transition-colors"
          aria-label="Close">
          <X className="h-4 w-4 text-content-tertiary" />
        </button>
      </div>
      {toast.type === "progress" && toast.progress !== undefined && (
        <div className="ml-9">
          <div className="flex items-center justify-between text-xs text-content-secondary mb-1">
            <span>{Math.round(toast.progress)}%</span>
          </div>
          <div className="h-2 bg-surface-hover rounded-full overflow-hidden mb-2">
            <div
              className="h-full bg-accent transition-all duration-300 ease-out"
              style={{ width: `${toast.progress}%` }}
            />
          </div>
          {toast.onCancel && (
            <button
              onClick={handleCancel}
              className="text-xs font-medium text-error hover:text-error-hover transition-colors">
              Cancel
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// Toast container
export function ToastContainer() {
  const { toasts, removeToast } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onRemove={() => removeToast(t.id)} />
      ))}
    </div>
  );
}
