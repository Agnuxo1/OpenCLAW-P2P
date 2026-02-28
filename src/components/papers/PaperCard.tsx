"use client";

import Link from "next/link";
import type { Paper } from "@/types/api";
import { TierBadge } from "./TierBadge";
import { extractAbstract } from "@/lib/markdown";
import { Calendar, User, CheckSquare, XSquare } from "lucide-react";

interface PaperCardProps {
  paper: Paper;
  showActions?: boolean;
}

function formatTime(ts: number): string {
  if (!ts) return "—";
  const diff = Date.now() - ts;
  if (diff < 60_000) return "Just now";
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}h ago`;
  return new Date(ts).toLocaleDateString();
}

export function PaperCard({ paper, showActions }: PaperCardProps) {
  const abstract = paper.abstract || extractAbstract(paper.content, 200);

  return (
    <article className="border border-[#2c2c30] rounded-lg p-4 bg-[#0c0c0d] card-hover group">
      {/* Header badges */}
      <div className="flex items-center gap-2 flex-wrap mb-2">
        <TierBadge tier={paper.tier} status={paper.status} size="sm" />
        {paper.investigationId && (
          <span className="font-mono text-[10px] text-[#52504e] border border-[#2c2c30] rounded px-1.5 py-0.5">
            INV-{paper.investigationId.slice(0, 6)}
          </span>
        )}
        <span className="ml-auto flex items-center gap-1 font-mono text-[10px] text-[#52504e]">
          <Calendar className="w-3 h-3" />
          {formatTime(paper.timestamp)}
        </span>
      </div>

      {/* Title */}
      <Link href={`/app/papers/${paper.id}`}>
        <h3 className="font-mono font-semibold text-sm text-[#f5f0eb] mb-2 group-hover:text-[#ff4e1a] transition-colors line-clamp-2 leading-snug">
          {paper.title}
        </h3>
      </Link>

      {/* Abstract */}
      <p className="text-[#52504e] text-xs leading-relaxed line-clamp-3 mb-3">
        {abstract}
      </p>

      {/* Footer */}
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1 font-mono text-[10px] text-[#52504e]">
          <User className="w-3 h-3" />
          <span className="truncate max-w-[120px]">{paper.author || "Unknown"}</span>
        </span>

        <div className="flex items-center gap-3">
          {paper.validations > 0 && (
            <span className="flex items-center gap-0.5 font-mono text-[10px] text-green-500">
              <CheckSquare className="w-3 h-3" />
              {paper.validations}
            </span>
          )}
          {paper.rejections > 0 && (
            <span className="flex items-center gap-0.5 font-mono text-[10px] text-[#e63030]">
              <XSquare className="w-3 h-3" />
              {paper.rejections}
            </span>
          )}
        </div>
      </div>
    </article>
  );
}
