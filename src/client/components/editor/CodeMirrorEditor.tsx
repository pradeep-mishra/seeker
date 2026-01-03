import { json } from "@codemirror/lang-json";
import { yaml } from "@codemirror/lang-yaml";
import { StreamLanguage } from "@codemirror/language";
import { dockerFile } from "@codemirror/legacy-modes/mode/dockerfile";
import { properties } from "@codemirror/legacy-modes/mode/properties";
import { shell } from "@codemirror/legacy-modes/mode/shell";
import type { Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import CodeMirror from "@uiw/react-codemirror";
import { useMemo } from "react";
import { cn } from "../../lib/utils";
import { useUIStore } from "../../stores/uiStore";

interface CodeMirrorEditorProps {
  content: string;
  language?: string;
  onChange: (content: string) => void;
  className?: string;
}

export default function CodeMirrorEditor({
  content,
  language,
  onChange,
  className
}: CodeMirrorEditorProps) {
  const theme = useUIStore((state) => state.theme);
  const isDark = theme === "dark";

  const languageExtensions = useMemo(() => {
    const exts: Extension[] = [];

    // Add language support based on the language prop
    switch (language) {
      case "json":
        exts.push(json());
        break;
      case "yaml":
        exts.push(yaml());
        break;
      case "bash":
        exts.push(StreamLanguage.define(shell));
        break;
      case "docker":
        exts.push(StreamLanguage.define(dockerFile));
        break;
      case "ini":
      case "ignore":
      case "env":
        exts.push(StreamLanguage.define(properties));
        break;
    }

    return exts;
  }, [language]);

  const editorTheme = useMemo(() => {
    const selectionBackground = isDark
      ? "rgba(96, 165, 250, 0.25)"
      : "rgba(59, 130, 246, 0.25)";
    const selectionText = isDark ? "var(--color-warning)" : "#0f172a";

    return EditorView.theme(
      {
        "&": {
          color: isDark ? "var(--color-content)" : "#111827",
          backgroundColor: isDark ? "var(--color-surface)" : "#ffffff"
        },
        ".cm-content": {
          caretColor: isDark ? "var(--color-content)" : "#111827"
        },
        ".cm-content ::selection": {
          backgroundColor: selectionBackground,
          color: selectionText
        },
        ".cm-selectionBackground, .cm-selectionLayer .selection": {
          backgroundColor: selectionBackground
        },
        "&.cm-focused .cm-cursor": {
          borderLeftColor: isDark ? "var(--color-content)" : "#111827"
        },
        ".cm-selectionMatch": {
          backgroundColor: isDark
            ? "rgba(96, 165, 250, 0.15)"
            : "rgba(59, 130, 246, 0.15)"
        },
        ".cm-gutters": {
          backgroundColor: "transparent",
          color: isDark ? "var(--color-content-tertiary)" : "#9ca3af",
          border: "none"
        }
      },
      { dark: isDark }
    );
  }, [isDark]);

  const extensions = useMemo(
    () => [...languageExtensions, EditorView.lineWrapping, editorTheme],
    [languageExtensions, editorTheme]
  );

  return (
    <div className={cn("relative w-full h-full flex flex-col", className)}>
      <div className="flex-1 relative overflow-auto bg-surface">
        <CodeMirror
          value={content}
          height="100%"
          extensions={extensions}
          onChange={onChange}
          theme={isDark ? "dark" : "light"}
          basicSetup={{
            lineNumbers: true,
            highlightActiveLineGutter: true,
            highlightActiveLine: true,
            foldGutter: true,
            drawSelection: true,
            dropCursor: true,
            allowMultipleSelections: true,
            indentOnInput: true,
            bracketMatching: true,
            closeBrackets: true,
            autocompletion: true,
            rectangularSelection: true,
            crosshairCursor: true,
            highlightSelectionMatches: true,
            closeBracketsKeymap: true,
            searchKeymap: true,
            foldKeymap: true,
            completionKeymap: true,
            lintKeymap: true
          }}
          style={{
            fontSize: "14px",
            fontFamily: "monospace",
            height: "100%"
          }}
        />
      </div>
    </div>
  );
}
