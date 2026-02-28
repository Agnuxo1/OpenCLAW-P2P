"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useLatestPapers } from "@/hooks/useLatestPapers";
import { renderMarkdown } from "@/lib/markdown";
import { TierBadge } from "@/components/papers/TierBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, ExternalLink, Calendar, User, Hash } from "lucide-react";
import type { Paper } from "@/types/api";

export default function PaperPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data } = useLatestPapers();
  const [html, setHtml] = useState<string | null>(null);

  const paper: Paper | undefined = data?.papers.find((p) => p.id === id);

  useEffect(() => {
    if (!paper?.content) return;
    renderMarkdown(paper.content).then(setHtml);
  }, [paper?.content]);

  if (!paper) {
    return (
      <div className="p-6 max-w-3xl mx-auto space-y-4">
        <Skeleton className="h-8 w-64 bg-[#1a1a1c]" />
        <Skeleton className="h-4 w-48 bg-[#1a1a1c]" />
        <div className="space-y-2 mt-8">
          {Array.from({ length: 12 }).map((_, i) => (
            <Skeleton key={i} className="h-3 w-full bg-[#1a1a1c]" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      {/* Back */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1.5 font-mono text-xs text-[#52504e] hover:text-[#f5f0eb] mb-6 transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to papers
      </button>

      {/* Header */}
      <div className="border border-[#2c2c30] rounded-lg p-6 bg-[#0c0c0d] mb-6">
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <TierBadge tier={paper.tier} status={paper.status} size="md" />
          {paper.ipfsCid && (
            <a
              href={`https://ipfs.io/ipfs/${paper.ipfsCid}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 font-mono text-[10px] text-[#52504e] hover:text-[#ff4e1a] transition-colors"
            >
              <Hash className="w-3 h-3" />
              IPFS
              <ExternalLink className="w-2.5 h-2.5" />
            </a>
          )}
        </div>

        <h1 className="font-mono text-xl font-bold text-[#f5f0eb] mb-4 leading-tight">
          {paper.title}
        </h1>

        <div className="flex flex-wrap gap-4 font-mono text-xs text-[#52504e]">
          <span className="flex items-center gap-1.5">
            <User className="w-3.5 h-3.5" />
            {paper.author || "Unknown"}
          </span>
          <span className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" />
            {paper.timestamp ? new Date(paper.timestamp).toLocaleString() : "—"}
          </span>
          {paper.wordCount && (
            <span>{paper.wordCount.toLocaleString()} words</span>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="border border-[#2c2c30] rounded-lg p-6 bg-[#0c0c0d]">
        {html ? (
          <div
            className="prose prose-invert prose-sm max-w-none font-mono
              prose-headings:text-[#f5f0eb] prose-headings:font-mono
              prose-p:text-[#9a9490] prose-p:leading-relaxed
              prose-code:text-[#ff4e1a] prose-code:bg-[#1a1a1c] prose-code:px-1 prose-code:rounded
              prose-pre:bg-[#0c0c0d] prose-pre:border prose-pre:border-[#2c2c30]
              prose-a:text-[#ff4e1a] prose-a:no-underline hover:prose-a:underline
              prose-blockquote:border-[#ff4e1a] prose-blockquote:text-[#9a9490]
              prose-strong:text-[#f5f0eb]
              prose-hr:border-[#2c2c30]"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        ) : (
          <div className="space-y-2">
            {Array.from({ length: 10 }).map((_, i) => (
              <Skeleton key={i} className="h-3 w-full bg-[#1a1a1c]" />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
