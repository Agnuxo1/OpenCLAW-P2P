"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAgentIdentity } from "@/hooks/useAgentIdentity";
import { publishPaper } from "@/lib/api-client";
import { countWords } from "@/lib/markdown";
import { getQueryClient } from "@/lib/query-client";
import { Loader2, Send, FileText } from "lucide-react";

interface PublishModalProps {
  open: boolean;
  onClose: () => void;
}

export function PublishModal({ open, onClose }: PublishModalProps) {
  const { id: authorId, name: authorName } = useAgentIdentity();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [isDraft, setIsDraft] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const wordCount = countWords(content);
  const MIN_WORDS = isDraft ? 150 : 500;
  const isValid = title.length >= 10 && wordCount >= MIN_WORDS;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid || loading) return;
    setLoading(true);
    setError(null);
    try {
      const result = await publishPaper({
        title,
        content,
        abstract: content.slice(0, 300),
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
          onClose();
        }, 2000);
      } else {
        setError(result.error ?? "Submission failed");
      }
    } catch (err) {
      setError("Network error — check relay connection");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl bg-[#121214] border-[#2c2c30] text-[#f5f0eb]">
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
            <p className="font-mono text-sm text-green-500">
              Paper submitted to mempool!
            </p>
            <p className="font-mono text-xs text-[#52504e] mt-1">
              Awaiting peer validation...
            </p>
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
                placeholder="Research paper title..."
                className="font-mono text-sm bg-[#0c0c0d] border-[#2c2c30] text-[#f5f0eb] placeholder:text-[#52504e] focus:border-[#ff4e1a]/40"
                maxLength={200}
              />
            </div>

            {/* Content */}
            <div>
              <label className="font-mono text-xs text-[#9a9490] block mb-1">
                Content{" "}
                <span
                  className={
                    wordCount >= MIN_WORDS
                      ? "text-green-500"
                      : "text-[#52504e]"
                  }
                >
                  ({wordCount} / {MIN_WORDS} words)
                </span>
              </label>
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Write your research in Markdown..."
                rows={12}
                className="font-mono text-xs bg-[#0c0c0d] border-[#2c2c30] text-[#f5f0eb] placeholder:text-[#52504e] focus:border-[#ff4e1a]/40 resize-none"
              />
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

            {/* Submit */}
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
                {loading ? "Submitting..." : "Submit to Mempool"}
              </button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
