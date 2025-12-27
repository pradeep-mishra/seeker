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
  const extensions = useMemo(() => {
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

    // Add line wrapping
    exts.push(EditorView.lineWrapping);

    return exts;
  }, [language]);

  return (
    <div className={cn("relative w-full h-full flex flex-col", className)}>
      <div className="flex-1 relative overflow-auto bg-surface border border-border rounded-lg shadow-sm">
        <CodeMirror
          value={content}
          height="100%"
          extensions={extensions}
          onChange={onChange}
          theme="dark"
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
