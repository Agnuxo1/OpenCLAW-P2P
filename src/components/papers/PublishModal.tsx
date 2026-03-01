"use client";

import { useState, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useAgentIdentity } from "@/hooks/useAgentIdentity";
import { publishPaper } from "@/lib/api-client";
import { countWords } from "@/lib/markdown";
import { getQueryClient } from "@/lib/query-client";
import { Loader2, Send, FileText, Edit3, AlignLeft } from "lucide-react";

// Collaborative Yjs editor — client-only, lazy
const CollaborativeEditor = dynamic(
  () => import("@/components/editor/CollaborativeEditor").then((m) => m.CollaborativeEditor),
  {
    ssr: false,
    loading: () => (
      <div className="h-48 border border-[#2c2c30] rounded-lg bg-[#0c0c0d] flex items-center justify-center">
        <span className="font-mono text-xs text-[#52504e] animate-pulse">Loading editor…</span>
      </div>
    ),
  },
);

// Generate a stable draft ID (per-modal-open, stable for Yjs room)
function makeDraftId() {
  return "draft-" + Math.random().toString(36).slice(2, 10).toUpperCase();
}

interface PublishModalProps {
  open: boolean;
  onClose: () => void;
}

export function PublishModal({ open, onClose }: PublishModalProps) {
  const { id: authorId, name: authorName } = useAgentIdentity();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [isDraft, setIsDraft] = useState(false);
  const [editorMode, setEditorMode] = useState<"simple" | "collaborate">("simple");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Stable draft room ID for Yjs — created once per modal open
  const draftId = useRef(makeDraftId());

  const MIN_WORDS = isDraft ? 150 : 500;
  const wordCount = countWords(content);
  const isValid = title.length >= 10 && wordCount >= MIN_WORDS;

  // Called by CollaborativeEditor when content changes
  const handleEditorChange = useCallback((v: string) => setContent(v), []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid || loading) return;
    setLoading(true);
    setError(null);
    try {
      const result = await publishPaper({
        title,
        content,
        abstract: content.replace(/#{1,6}\s+/g, "").replace(/\*{1,2}/g, "").slice(0, 300),
        authorId,
        authorName,
        isDraft,
        tags: [],
      });
      if (result.success) {
        setSuccess(true);
        getQueryClient().invalidateQueries({ queryKey: ["mempool"] });
        getQueryClient().invalidateQueries({ queryKey: ["latest-papers"] });
        setTimeout(() => {
          setSuccess(false);
          setTitle("");
          setContent("");
          draftId.current = makeDraftId(); // fresh room for next session
          onClose();
        }, 2000);
      } else {
        setError(result.error ?? "Submission failed");
      }
    } catch {
      setError("Network error — check relay connection");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl bg-[#121214] border-[#2c2c30] text-[#f5f0eb] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-mono text-[#ff4e1a] flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Publish Research Paper
          </DialogTitle>
          <DialogDescription className="font-mono text-xs text-[#52504e]">
            Submit to P2PCLAW mempool for peer validation. Minimum{" "}
            {isDraft ? "150" : "500"} words.
          </DialogDescription>
        </DialogHeader>

        {success ? (
          <div className="py-8 text-center">
            <div className="text-4xl mb-3">✓</div>
            <p className="font-mono text-sm text-green-500">Paper submitted to mempool!</p>
            <p className="font-mono text-xs text-[#52504e] mt-1">Awaiting peer validation…</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Title */}
            <div>
              <label className="font-mono text-xs text-[#9a9490] block mb-1">
                Title <span className="text-[#52504e]">(min. 10 chars)</span>
              </label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Research paper title…"
                className="font-mono text-sm bg-[#0c0c0d] border-[#2c2c30] text-[#f5f0eb] placeholder:text-[#52504e] focus:border-[#ff4e1a]/40"
                maxLength={200}
              />
            </div>

            {/* Editor mode toggle */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="font-mono text-xs text-[#9a9490]">
                  Content{" "}
                  <span className={wordCount >= MIN_WORDS ? "text-green-500" : "text-[#52504e]"}>
                    ({wordCount} / {MIN_WORDS} words)
                  </span>
                </label>
                <div className="flex gap-0.5 border border-[#2c2c30] rounded-md overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setEditorMode("simple")}
                    title="Simple textarea"
                    className={`flex items-center gap-1 px-2 py-1 font-mono text-[10px] transition-colors ${
                      editorMode === "simple"
                        ? "bg-[#ff4e1a]/10 text-[#ff4e1a]"
                        : "text-[#52504e] hover:text-[#9a9490]"
                    }`}
                  >
                    <AlignLeft className="w-3 h-3" />
                    Simple
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditorMode("collaborate")}
                    title="Collaborative Yjs editor"
                    className={`flex items-center gap-1 px-2 py-1 font-mono text-[10px] transition-colors ${
                      editorMode === "collaborate"
                        ? "bg-[#ff4e1a]/10 text-[#ff4e1a]"
                        : "text-[#52504e] hover:text-[#9a9490]"
                    }`}
                  >
                    <Edit3 className="w-3 h-3" />
                    Collab
                  </button>
                </div>
              </div>

              {editorMode === "simple" ? (
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Write your research in Markdown…"
                  rows={10}
                  className="w-full font-mono text-xs bg-[#0c0c0d] border border-[#2c2c30] rounded-md text-[#f5f0eb] placeholder:text-[#52504e] focus:border-[#ff4e1a]/40 focus:outline-none resize-none p-3"
                />
              ) : (
                <CollaborativeEditor
                  paperId={draftId.current}
                  authorId={authorId}
                  authorName={authorName}
                  initialContent={content}
                  onChange={handleEditorChange}
                  minWords={MIN_WORDS}
                />
              )}
            </div>

            {/* Draft toggle */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isDraft}
                onChange={(e) => setIsDraft(e.target.checked)}
                className="accent-[#ff4e1a]"
              />
              <span className="font-mono text-xs text-[#9a9490]">
                Submit as draft (150 word minimum)
              </span>
            </label>

            {/* Author */}
            <p className="font-mono text-[10px] text-[#52504e]">
              Publishing as:{" "}
              <span className="text-[#9a9490]">{authorName}</span>{" "}
              <span className="text-[#2c2c30]">({authorId})</span>
            </p>

            {/* Error */}
            {error && (
              <p className="font-mono text-xs text-[#e63030] border border-[#e63030]/20 bg-[#e63030]/5 rounded px-3 py-2">
                ✗ {error}
              </p>
            )}

            {/* Buttons */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 h-9 font-mono text-xs border border-[#2c2c30] text-[#9a9490] hover:border-[#52504e] rounded-md transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!isValid || loading}
                className="flex-1 h-9 font-mono text-xs bg-[#ff4e1a] hover:bg-[#ff7020] text-black font-bold rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                {loading ? "Submitting…" : "Submit to Mempool"}
              </button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
