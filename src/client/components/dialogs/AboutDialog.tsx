// src/client/components/dialogs/AboutDialog.tsx
import {
  ExternalLink,
  FolderSearch,
  Github,
  MessageSquare,
  Package
} from "lucide-react";
import { APP_DESCRIPTION, APP_NAME, APP_VERSION } from "../../lib/version";
import { useUIStore } from "../../stores/uiStore";
import { Dialog } from "../common/Dialog";

export function AboutDialog() {
  const { dialogs, closeAboutDialog } = useUIStore();

  return (
    <Dialog
      isOpen={dialogs.about}
      onClose={closeAboutDialog}
      title=""
      size="md"
      showCloseButton={false}>
      <div className="space-y-6">
        {/* Hero Section with Gradient Background */}
        <div className="relative -mt-6 -mx-6 px-6 pt-8 pb-6 bg-gradient-to-br from-accent/10 via-accent/5 to-transparent">
          <div className="flex flex-col items-center text-center">
            <div className="relative mb-4">
              <div className="absolute inset-0 bg-accent/20 blur-xl rounded-full" />
              <div className="relative inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-accent/10 backdrop-blur-sm border border-accent/20 shadow-lg">
                <FolderSearch className="w-10 h-10 text-accent" />
              </div>
            </div>
            <div className="space-y-2">
              <h2 className="text-3xl font-bold text-content capitalize tracking-tight">
                {APP_NAME}
              </h2>
              <p className="text-content-secondary max-w-md">
                {APP_DESCRIPTION}
              </p>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface shadow-sm">
                <Package className="w-3.5 h-3.5 text-accent" />
                <span className="text-sm font-medium text-content">
                  v{APP_VERSION}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Links Section */}
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <a
              href="https://github.com/pradeep-mishra/seeker"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-3 rounded-lg bg-surface-secondary border border-border hover:border-accent hover:bg-accent/5 transition-all group">
              <Github className="w-4 h-4 text-content-secondary group-hover:text-accent transition-colors" />
              <span className="text-sm font-medium text-content">
                Source Code
              </span>
              <ExternalLink className="w-3 h-3 text-content-tertiary ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
            </a>

            <a
              href="https://github.com/pradeep-mishra/seeker/issues"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-3 rounded-lg bg-surface-secondary border border-border hover:border-accent hover:bg-accent/5 transition-all group">
              <MessageSquare className="w-4 h-4 text-content-secondary group-hover:text-accent transition-colors" />
              <span className="text-sm font-medium text-content">
                Report Issue
              </span>
              <ExternalLink className="w-3 h-3 text-content-tertiary ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
            </a>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-border">
          <p className="text-center text-xs text-content-tertiary">
            Made with ❤️ for the home server community
          </p>
        </div>

        {/* Close Button */}
        <button
          onClick={closeAboutDialog}
          className="w-full px-4 py-2.5 rounded-lg bg-accent hover:bg-accent-hover text-content-inverse font-medium transition-colors">
          Close
        </button>
      </div>
    </Dialog>
  );
}
