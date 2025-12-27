import { ArrowLeft, Loader2, Save } from "lucide-react";
import { lazy, Suspense, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "../components/common/Button";
import { toast } from "../components/common/Toast";
import { apiCall, filesApi } from "../lib/api";

// Dynamic import for CodeMirrorEditor
const CodeMirrorEditor = lazy(
  () => import("../components/editor/CodeMirrorEditor")
);

export default function TextEditorPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const path = searchParams.get("path");

  const [content, setContent] = useState<string>("");
  const [initialContent, setInitialContent] = useState<string>("");
  const [language, setLanguage] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!path) {
      setError("No file path provided");
      setIsLoading(false);
      return;
    }

    const loadFile = async () => {
      try {
        const { data, error } = await apiCall(filesApi.getContent(path));

        if (error) {
          setError(error);
          return;
        }

        if (data) {
          setContent(data.content);
          setInitialContent(data.content);

          // Determine language from extension or mimeType
          const ext = path.split(".").pop()?.toLowerCase();
          const fileName = path.split("/").pop();

          if (ext === "json") setLanguage("json");
          else if (ext === "yml" || ext === "yaml") setLanguage("yaml");
          else if (ext === "sh" || ext === "bash" || ext === "zsh")
            setLanguage("bash");
          else if (fileName === "Dockerfile" || ext === "dockerfile")
            setLanguage("docker");
          else if (
            ext === "gitignore" ||
            ext === "ignore" ||
            fileName === ".gitignore"
          )
            setLanguage("ignore");
          else if (ext === "md") setLanguage("markdown");
          else if (ext === "ini" || ext === "conf") setLanguage("ini");
          else if (
            ext === "env" ||
            fileName === ".env" ||
            fileName?.startsWith(".env.")
          )
            setLanguage("env");
          else setLanguage(undefined);
        }
      } catch (err) {
        setError("Failed to load file");
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    loadFile();
  }, [path]);

  const handleSave = async () => {
    if (!path) return;

    setIsSaving(true);
    try {
      const { data, error } = await apiCall(
        filesApi.saveContent(path, content)
      );

      if (error) {
        toast.error(error);
        return;
      }

      if (data?.success) {
        toast.success("File saved successfully");
        setInitialContent(content);
      } else {
        toast.error(data?.error || "Failed to save file");
      }
    } catch (err) {
      toast.error("Failed to save file");
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const hasChanges = content !== initialContent;

  return (
    <div className="flex flex-col h-full bg-surface-base">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2 border-b border-border bg-surface-secondary">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <h1 className="text-lg font-semibold text-content truncate max-w-md">
            {path ? path.split("/").pop() : "Text Editor"}
          </h1>
          {hasChanges && !isLoading && !error && (
            <span className="text-xs text-content-muted bg-surface-hover px-2 py-1 rounded">
              Unsaved changes
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            size="sm"
            onClick={handleSave}
            disabled={!hasChanges || isSaving || isLoading || !!error}>
            {isSaving ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Save
          </Button>
        </div>
      </header>

      {/* Editor or Loading/Error state */}
      <div className="flex-1 overflow-hidden p-4">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-full">
            <Loader2 className="h-8 w-8 animate-spin text-accent mb-4" />
            <p className="text-content-secondary text-sm">Loading file...</p>
          </div>
        ) : error || !path ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <h2 className="text-xl font-bold text-error mb-2">Error</h2>
            <p className="text-content-muted mb-4">
              {error || "No file path provided"}
            </p>
          </div>
        ) : (
          <Suspense
            fallback={
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-8 w-8 animate-spin text-accent" />
              </div>
            }>
            <CodeMirrorEditor
              content={initialContent}
              language={language}
              onChange={setContent}
              className="h-full"
            />
          </Suspense>
        )}
      </div>
    </div>
  );
}
