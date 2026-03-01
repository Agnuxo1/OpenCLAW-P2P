"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { markdown } from "@codemirror/lang-markdown";
import { EditorView } from "@codemirror/view";
import type { EditorView as EditorViewType } from "@codemirror/view";
import { EditorToolbar } from "./EditorToolbar";
import { countWords } from "@/lib/markdown";
import { getCursorColor } from "@/lib/yjs-provider";

// ── CLAW dark CodeMirror theme ───────────────────────────────────────────
const clawTheme = EditorView.theme({
  "&": {
    backgroundColor: "#0c0c0d",
    color: "#f5f0eb",
    fontSize: "13px",
    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
    height: "100%",
  },
  ".cm-content": { caretColor: "#ff4e1a", padding: "12px" },
  ".cm-cursor": { borderLeftColor: "#ff4e1a" },
  ".cm-activeLine": { backgroundColor: "#1a1a1c" },
  ".cm-gutters": { backgroundColor: "#121214", borderRight: "1px solid #2c2c30", color: "#52504e" },
  ".cm-lineNumbers .cm-gutterElement": { paddingLeft: "8px", paddingRight: "8px" },
  ".cm-selectionBackground, ::selection": { backgroundColor: "#ff4e1a22 !important" },
  ".cm-ySelectionInfo": {
    padding: "2px 5px",
    borderRadius: "3px",
    fontSize: "10px",
    fontFamily: "'JetBrains Mono', monospace",
  },
  ".cm-scroller": { overflowY: "auto" },
}, { dark: true });

// ── Props ────────────────────────────────────────────────────────────────
interface CollaborativeEditorProps {
  paperId: string;
  authorId: string;
  authorName: string;
  initialContent?: string;
  onChange?: (value: string) => void;
  minWords?: number;
  readOnly?: boolean;
}

export function CollaborativeEditor({
  paperId,
  authorId,
  authorName,
  initialContent = "",
  onChange,
  minWords = 500,
  readOnly = false,
}: CollaborativeEditorProps) {
  const [value, setValue] = useState(initialContent);
  const [peerCount, setPeerCount] = useState(0);
  const [providerReady, setProviderReady] = useState(false);
  const [extensions, setExtensions] = useState<Parameters<typeof CodeMirror>[0]["extensions"]>([]);
  const viewRef = useRef<EditorViewType | null>(null);

  // Load Yjs provider asynchronously (client-only)
  useEffect(() => {
    if (typeof window === "undefined") return;

    let destroyed = false;

    async function init() {
      try {
        const { createPaperProvider } = await import("@/lib/yjs-provider");
        const { yCollab, yUndoManagerKeymap } = await import("y-codemirror.next");
        const { keymap } = await import("@codemirror/view");

        const { ydoc, yText, provider, destroy } = await createPaperProvider(paperId);
        if (destroyed) { destroy(); return; }

        // Seed initial content if Yjs doc is empty
        if (initialContent && yText.toString().length === 0) {
          ydoc.transact(() => yText.insert(0, initialContent));
        }

        // Set local awareness (name + color for cursor)
        const awareness = provider.awareness;
        awareness.setLocalStateField("user", {
          name: authorName || "Anonymous",
          color: getCursorColor(authorId),
          colorLight: getCursorColor(authorId) + "33",
        });

        // Track peer count
        awareness.on("change", () => {
          if (destroyed) return;
          setPeerCount(awareness.getStates().size);
        });

        const undoManager = new (await import("yjs")).UndoManager(yText);

        const yExtensions = [
          yCollab(yText, awareness, { undoManager }),
          keymap.of(yUndoManagerKeymap),
        ];

        if (!destroyed) {
          // Sync local state to Yjs changes
          yText.observe(() => {
            if (!destroyed) {
              const v = yText.toString();
              setValue(v);
              onChange?.(v);
            }
          });

          setExtensions(yExtensions);
          setProviderReady(true);
        }

        return destroy;
      } catch (err) {
        console.error("[CollaborativeEditor] Yjs init failed:", err);
        return undefined;
      }
    }

    const cleanup = init();

    return () => {
      destroyed = true;
      cleanup.then((fn) => fn?.());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paperId, authorId, authorName]);

  // Handle local-only changes (before Yjs ready)
  const handleChange = useCallback((v: string) => {
    if (!providerReady) {
      setValue(v);
      onChange?.(v);
    }
    // When Yjs is ready, yText.observe() handles the sync
  }, [providerReady, onChange]);

  // Toolbar insert helper
  const handleInsert = useCallback((snippet: string) => {
    const view = viewRef.current;
    if (!view) return;
    const { from, to } = view.state.selection.main;
    view.dispatch({
      changes: { from, to, insert: snippet },
      selection: { anchor: from + snippet.length },
    });
    view.focus();
  }, []);

  const wordCount = countWords(value);

  return (
    <div className="flex flex-col border border-[#2c2c30] rounded-lg overflow-hidden bg-[#0c0c0d]">
      {!readOnly && (
        <EditorToolbar
          onInsert={handleInsert}
          wordCount={wordCount}
          peerCount={peerCount}
          minWords={minWords}
        />
      )}

      {/* Yjs status bar */}
      <div className="flex items-center gap-2 px-3 py-1 border-b border-[#2c2c30] bg-[#121214]">
        <span
          className="inline-block w-1.5 h-1.5 rounded-full"
          style={{ backgroundColor: providerReady ? "#4caf50" : "#ff9a30" }}
        />
        <span className="font-mono text-[10px] text-[#52504e]">
          {providerReady
            ? `P2P sync active · ${peerCount} peer${peerCount !== 1 ? "s" : ""}`
            : "Connecting to P2P mesh…"}
        </span>
        <span className="ml-auto font-mono text-[10px] text-[#2c2c30]">
          room: p2pclaw-paper-{paperId.slice(0, 8)}
        </span>
      </div>

      {/* Editor */}
      <CodeMirror
        value={value}
        onChange={handleChange}
        extensions={[
          clawTheme,
          markdown(),
          EditorView.lineWrapping,
          ...((extensions ?? []) as Parameters<typeof CodeMirror>[0]["extensions"] & unknown[]),
        ]}
        readOnly={readOnly}
        onCreateEditor={(view) => { viewRef.current = view; }}
        basicSetup={{
          lineNumbers: true,
          highlightActiveLine: true,
          highlightSelectionMatches: false,
          bracketMatching: false,
          indentOnInput: false,
          syntaxHighlighting: true,
          foldGutter: false,
          autocompletion: false,
          closeBrackets: false,
          searchKeymap: false,
          drawSelection: true,
        }}
        style={{ minHeight: "320px", maxHeight: "60vh" }}
      />
    </div>
  );
}
