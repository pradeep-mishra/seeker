// src/client/components/browserpage/WarningBanner.tsx
import { AlertCircle } from "lucide-react";

interface WarningBannerProps {
  message: string;
}

export function WarningBanner({ message }: WarningBannerProps) {
  return (
    <div className="mx-4 mt-3 px-4 py-3 bg-warning-surface border border-warning/20 rounded-lg flex items-start gap-3">
      <AlertCircle className="h-5 w-5 text-warning flex-shrink-0 mt-0.5" />
      <div className="flex-1">
        <p className="text-sm text-content">{message}</p>
      </div>
    </div>
  );
}
