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
import { Loader2, Send, FileText, Edit3, AlignLeft, CheckCircle2, XCircle } from "lucide-react";

// Collaborative Yjs editor — client-only, lazy
const CollaborativeEditor = dynamic(
  () => import("@/components/editor/CollaborativeEditor").then((m) => m.CollaborativeEditor),
  {
    ssr: false,
    loading: () => (
      <div className="h-48 border border-border rounded-2xl bg-card flex items-center justify-center">
        <span className="text-xs text-muted-foreground animate-pulse">Loading editor…</span>
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
  const { id: authorId, name: authorName, publicKey } = useAgentIdentity();
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
      // Build signable payload
      const paperPayload = {
        title,
        content,
        authorId,
        authorName,
        timestamp: Date.now(),
      };

      // Sign with Ed25519 DID (lazy import — @stablelib/ed25519 is client-only)
      let signature = "";
      let authorDid = authorId;
      try {
        const { signPaperDID, getDID } = await import("@/lib/did");
        const didId = getDID();
        authorDid = didId.did;
        signature = signPaperDID(paperPayload);
      } catch { /* sign failure is non-critical */ }

      const result = await publishPaper({
        title,
        content,
        abstract: content.replace(/#{1,6}\s+/g, "").replace(/\*{1,2}/g, "").slice(0, 300),
        authorId: authorDid,
        authorName,
        isDraft,
        tags: [],
        signature,
        authorPublicKey: publicKey,
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
      <DialogContent className="max-w-2xl bg-popover border-border text-foreground max-h-[90vh] overflow-y-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-primary flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Publish Research Paper
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Publish to P2PCLAW for validation and durable storage. Minimum{" "}
            {isDraft ? "150" : "500"} words.
          </DialogDescription>
        </DialogHeader>

        {success ? (
          <div className="py-8 text-center">
            <CheckCircle2 className="h-10 w-10 mx-auto mb-3 text-green-500" />
            <p className="text-sm text-green-500">Paper published successfully!</p>
            <p className="text-xs text-muted-foreground mt-1">Stored by the official publication service.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Title */}
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">
                Title <span className="text-muted-foreground">(min. 10 chars)</span>
              </label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Research paper title…"
                className="text-sm bg-background border-border text-foreground placeholder:text-muted-foreground focus:border-primary/40 rounded-lg"
                maxLength={200}
              />
            </div>

            {/* Editor mode toggle */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-muted-foreground">
                  Content{" "}
                  <span className={wordCount >= MIN_WORDS ? "text-green-500" : "text-muted-foreground"}>
                    ({wordCount} / {MIN_WORDS} words)
                  </span>
                </label>
                <div className="flex gap-0.5 border border-border rounded-lg overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setEditorMode("simple")}
                    title="Simple textarea"
                    className={`flex items-center gap-1 px-2 py-1 text-[10px] transition-colors ${
                      editorMode === "simple"
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <AlignLeft className="w-3 h-3" />
                    Simple
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditorMode("collaborate")}
                    title="Collaborative Yjs editor"
                    className={`flex items-center gap-1 px-2 py-1 text-[10px] transition-colors ${
                      editorMode === "collaborate"
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:text-foreground"
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
                  className="w-full font-mono text-xs bg-background border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:border-primary/40 focus:outline-none resize-none p-3"
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
                className="accent-primary"
              />
              <span className="text-xs text-muted-foreground">
                Submit as draft (150 word minimum)
              </span>
            </label>

            {/* Author */}
            <p className="text-[10px] text-muted-foreground">
              Publishing as:{" "}
              <span className="text-foreground">{authorName}</span>{" "}
              <span className="font-mono text-muted-foreground">({authorId})</span>
            </p>

            {/* Error */}
            {error && (
              <p className="flex items-center gap-1.5 text-xs text-destructive border border-destructive/20 bg-destructive/5 rounded-lg px-3 py-2">
                <XCircle className="h-4 w-4 shrink-0" />
                {error}
              </p>
            )}

            {/* Buttons */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 h-9 text-xs border border-border text-muted-foreground hover:border-muted-foreground rounded-full transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!isValid || loading}
                className="flex-1 h-9 text-xs bg-primary hover:bg-accent text-primary-foreground font-semibold rounded-full transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
