"use client";

import Link from "next/link";
import type { Paper } from "@/types/api";
import { extractAbstract } from "@/lib/markdown";
import { Badge } from "@/components/ui/badge";
import { Calendar, User, ArrowRight } from "lucide-react";

interface InvestigationCardProps {
  paper: Paper;
}

function formatTime(ts: number): string {
  if (!ts) return "Unknown";
  const d = new Date(ts);
  const now = Date.now();
  const diff = now - ts;
  if (diff < 60_000) return "Just now";
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}h ago`;
  return d.toLocaleDateString();
}

export function InvestigationCard({ paper }: InvestigationCardProps) {
  const abstract = paper.abstract || extractAbstract(paper.content, 160);

  const tierColor: Record<string, string> = {
    ALPHA: "#ffd740",
    BETA: "#ff9a30",
    GAMMA: "#ff4e1a",
    DELTA: "#9a9490",
  };
  const tcolor = tierColor[paper.tier ?? ""] ?? "#9a9490";

  return (
    <Link
      href={`/app/papers/${paper.id}`}
      className="block border border-[#2c2c30] rounded-lg p-4 bg-[#0c0c0d] card-hover group"
    >
      {/* Status + Tier */}
      <div className="flex items-center gap-2 mb-2">
        <Badge
          variant="outline"
          className="font-mono text-[10px] px-1.5 py-0"
          style={{
            borderColor: tcolor + "55",
            color: tcolor,
          }}
        >
          {paper.tier ?? "UNVERIFIED"}
        </Badge>
        <span className="font-mono text-[10px] text-[#52504e] uppercase">
          {paper.status}
        </span>
        <span className="ml-auto font-mono text-[10px] text-[#52504e] flex items-center gap-1">
          <Calendar className="w-3 h-3" />
          {formatTime(paper.timestamp)}
        </span>
      </div>

      {/* Title */}
      <h3 className="font-mono font-semibold text-sm text-[#f5f0eb] mb-2 group-hover:text-[#ff4e1a] transition-colors line-clamp-2 leading-snug">
        {paper.title}
      </h3>

      {/* Abstract */}
      <p className="text-[#52504e] text-xs leading-relaxed line-clamp-3 mb-3">
        {abstract}
      </p>

      {/* Footer */}
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1 font-mono text-[10px] text-[#52504e]">
          <User className="w-3 h-3" />
          {paper.author || "Unknown"}
        </span>
        <span className="flex items-center gap-1 text-[10px] text-[#2c2c30] group-hover:text-[#ff4e1a] transition-colors font-mono">
          Read <ArrowRight className="w-3 h-3" />
        </span>
      </div>
    </Link>
  );
}
