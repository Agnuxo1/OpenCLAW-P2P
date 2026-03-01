"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { useLatestPapers } from "@/hooks/useLatestPapers";
import { useAgentStore } from "@/store/agentStore";
import { renderMarkdown } from "@/lib/markdown";
import { TierBadge } from "@/components/papers/TierBadge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft, ExternalLink, Calendar, User, Hash,
  Eye, Edit3, CheckCircle, Clock, XCircle,
} from "lucide-react";
import type { Paper } from "@/types/api";

// Collaborative editor — client-only, no SSR
const CollaborativeEditor = dynamic(
  () => import("@/components/editor/CollaborativeEditor").then((m) => m.CollaborativeEditor),
  {
    ssr: false,
    loading: () => (
      <div className="h-64 border border-[#2c2c30] rounded-lg bg-[#0c0c0d] flex items-center justify-center">
        <span className="font-mono text-xs text-[#52504e] animate-pulse">Loading editor…</span>
      </div>
    ),
  },
);

// ── Status chip ──────────────────────────────────────────────────────────
const STATUS_MAP: Record<string, { icon: React.ComponentType<{ className?: string }>; color: string; label: string }> = {
  VERIFIED:   { icon: CheckCircle, color: "#4caf50", label: "Verified" },
  PROMOTED:   { icon: CheckCircle, color: "#ffcb47", label: "Promoted" },
  PENDING:    { icon: Clock,       color: "#ff9a30", label: "In Mempool" },
  UNVERIFIED: { icon: Clock,       color: "#9a9490", label: "Unverified" },
  REJECTED:   { icon: XCircle,     color: "#e63030", label: "Rejected" },
  PURGED:     { icon: XCircle,     color: "#52504e", label: "Purged" },
};

function StatusChip({ status }: { status: Paper["status"] }) {
  const s = STATUS_MAP[status] ?? STATUS_MAP.UNVERIFIED;
  const Icon = s.icon;
  return (
    <span
      className="inline-flex items-center gap-1 font-mono text-[10px] px-2 py-0.5 rounded border"
      style={{ color: s.color, borderColor: `${s.color}33`, backgroundColor: `${s.color}11` }}
    >
      <Icon className="w-3 h-3" />
      {s.label}
    </span>
  );
}

// ── Main page ────────────────────────────────────────────────────────────
export default function PaperPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data, isLoading } = useLatestPapers();
  const { id: authorId, name: authorName } = useAgentStore();

  const [tab, setTab] = useState<"read" | "collaborate">("read");
  const [html, setHtml] = useState<string | null>(null);

  const paper: Paper | undefined = data?.papers.find((p) => p.id === id);

  useEffect(() => {
    if (!paper?.content) return;
    renderMarkdown(paper.content).then(setHtml);
  }, [paper?.content]);

  // ── Loading state ──────────────────────────────────────────────────────
  if (isLoading && !paper) {
    return (
      <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-4">
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

  // ── Not found ─────────────────────────────────────────────────────────
  if (!paper) {
    return (
      <div className="p-4 md:p-6 max-w-3xl mx-auto">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 font-mono text-xs text-[#52504e] hover:text-[#ff4e1a] mb-6 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to papers
        </button>
        <div className="border border-[#2c2c30] rounded-lg p-8 text-center bg-[#0c0c0d]">
          <Hash className="w-8 h-8 text-[#2c2c30] mx-auto mb-3" />
          <p className="font-mono text-sm text-[#52504e]">Paper not found or still syncing</p>
          <p className="font-mono text-xs text-[#2c2c30] mt-1">ID: {id}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      {/* Back */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1.5 font-mono text-xs text-[#52504e] hover:text-[#ff4e1a] mb-4 transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to papers
      </button>

      {/* Header card */}
      <div className="border border-[#2c2c30] rounded-lg p-6 bg-[#0c0c0d] mb-4">
        {/* Badges row */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <TierBadge tier={paper.tier} status={paper.status} size="md" />
          <StatusChip status={paper.status} />
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

        {/* Title */}
        <h1 className="font-mono text-xl font-bold text-[#f5f0eb] mb-4 leading-tight">
          {paper.title}
        </h1>

        {/* Meta */}
        <div className="flex flex-wrap gap-4 font-mono text-xs text-[#52504e] mb-3">
          <span className="flex items-center gap-1.5">
            <User className="w-3.5 h-3.5" />
            {paper.author || "Unknown"}
          </span>
          <span className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" />
            {paper.timestamp ? new Date(paper.timestamp).toLocaleString() : "—"}
          </span>
          {!!paper.wordCount && (
            <span>{paper.wordCount.toLocaleString()} words</span>
          )}
          {paper.validations > 0 && (
            <span className="flex items-center gap-1 text-green-600">
              <CheckCircle className="w-3 h-3" />
              {paper.validations} validations
            </span>
          )}
        </div>

        {/* Tags */}
        {paper.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {paper.tags.map((tag) => (
              <span key={tag} className="font-mono text-[10px] px-2 py-0.5 rounded bg-[#1a1a1c] border border-[#2c2c30] text-[#52504e]">
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Tab bar */}
      <div className="flex gap-0.5 mb-4 border-b border-[#2c2c30]">
        {(["read", "collaborate"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex items-center gap-1.5 px-3 py-1.5 font-mono text-xs transition-all border-b-2 -mb-px ${
              tab === t
                ? "border-[#ff4e1a] text-[#ff4e1a]"
                : "border-transparent text-[#52504e] hover:text-[#9a9490]"
            }`}
          >
            {t === "read" ? <Eye className="w-3 h-3" /> : <Edit3 className="w-3 h-3" />}
            {t === "read" ? "Read" : "Collaborate"}
            {t === "collaborate" && (
              <span className="font-mono text-[9px] text-[#2c2c30] hidden sm:inline">Yjs · P2P</span>
            )}
          </button>
        ))}
      </div>

      {/* Read tab */}
      {tab === "read" && (
        <div className="border border-[#2c2c30] rounded-lg p-6 bg-[#0c0c0d]">
          {html ? (
            <div
              className="prose prose-invert prose-sm max-w-none
                prose-headings:font-mono prose-headings:text-[#f5f0eb]
                prose-p:text-[#9a9490] prose-p:leading-relaxed
                prose-code:font-mono prose-code:text-[#ff4e1a] prose-code:bg-[#1a1a1c] prose-code:px-1 prose-code:rounded prose-code:text-[90%]
                prose-pre:bg-[#0c0c0d] prose-pre:border prose-pre:border-[#2c2c30] prose-pre:font-mono
                prose-a:text-[#ff7020] prose-a:no-underline hover:prose-a:underline
                prose-blockquote:border-l-[#ff4e1a] prose-blockquote:text-[#9a9490]
                prose-strong:text-[#f5f0eb] prose-em:text-[#9a9490]
                prose-hr:border-[#2c2c30]
                prose-th:font-mono prose-th:text-[#9a9490] prose-th:border-b prose-th:border-[#2c2c30]
                prose-td:border-b prose-td:border-[#1a1a1c]"
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
      )}

      {/* Collaborate tab */}
      {tab === "collaborate" && (
        <div>
          <div className="mb-3 p-3 border border-[#ff4e1a]/20 rounded-lg bg-[#ff4e1a]/5">
            <p className="font-mono text-xs text-[#ff7020] font-bold">
              🔬 Real-time P2P collaborative editing (Yjs + WebRTC)
            </p>
            <p className="font-mono text-[10px] text-[#52504e] mt-0.5">
              All agents with access to paper <span className="text-[#9a9490]">{id}</span> edit
              simultaneously. Cursor positions, changes and awareness sync across the mesh — zero server.
            </p>
          </div>
          <CollaborativeEditor
            paperId={id}
            authorId={authorId}
            authorName={authorName}
            initialContent={paper.content}
            minWords={500}
          />
        </div>
      )}
    </div>
  );
}
