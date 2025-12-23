// src/client/components/common/Toast.tsx
import { useEffect, useState, useCallback } from "react";
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from "lucide-react";
import { create } from "zustand";

// Toast types
type ToastType = "success" | "error" | "warning" | "info";

interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

// Toast store
interface ToastState {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, "id">) => void;
  removeToast: (id: string) => void;
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  addToast: (toast) => {
    const id = Math.random().toString(36).substring(2, 9);
    set((state) => ({
      toasts: [...state.toasts, { ...toast, id }],
    }));
  },
  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },
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
};

// Individual toast component
function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: () => void }) {
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    const duration = toast.duration ?? 4000;
    const timer = setTimeout(() => {
      setIsExiting(true);
      setTimeout(onRemove, 200);
    }, duration);

    return () => clearTimeout(timer);
  }, [toast.duration, onRemove]);

  const handleClose = useCallback(() => {
    setIsExiting(true);
    setTimeout(onRemove, 200);
  }, [onRemove]);

  const icons = {
    success: <CheckCircle className="h-5 w-5 text-success" />,
    error: <AlertCircle className="h-5 w-5 text-error" />,
    warning: <AlertTriangle className="h-5 w-5 text-warning" />,
    info: <Info className="h-5 w-5 text-info" />,
  };

  const bgColors = {
    success: "bg-success-surface",
    error: "bg-error-surface",
    warning: "bg-warning-surface",
    info: "bg-info-surface",
  };

  return (
    <div
      className={`
        flex items-start gap-3 p-4 rounded-lg shadow-medium
        bg-surface border border-border
        ${isExiting ? "toast-exit" : "toast-enter"}
      `}
    >
      <div className={`p-1 rounded-full ${bgColors[toast.type]}`}>
        {icons[toast.type]}
      </div>
      <p className="flex-1 text-sm text-content">{toast.message}</p>
      <button
        onClick={handleClose}
        className="p-1 rounded hover:bg-surface-hover transition-colors"
        aria-label="Close"
      >
        <X className="h-4 w-4 text-content-tertiary" />
      </button>
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
        <ToastItem
          key={t.id}
          toast={t}
          onRemove={() => removeToast(t.id)}
        />
      ))}
    </div>
  );
}
