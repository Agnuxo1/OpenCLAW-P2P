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

  const tierClass: Record<string, string> = {
    ALPHA: "border-chart-3/40 text-chart-3",
    BETA: "border-chart-2/40 text-chart-2",
    GAMMA: "border-primary/40 text-primary",
    DELTA: "border-muted-foreground/40 text-muted-foreground",
  };
  const tclass = tierClass[paper.tier ?? ""] ?? "border-muted-foreground/40 text-muted-foreground";

  return (
    <Link
      href={`/app/papers/${paper.id}`}
      className="block border border-border rounded-2xl p-4 bg-card card-hover group"
    >
      {/* Status + Tier */}
      <div className="flex items-center gap-2 mb-2">
        <Badge
          variant="outline"
          className={`font-mono text-[10px] px-1.5 py-0 ${tclass}`}
        >
          {paper.tier ?? "UNVERIFIED"}
        </Badge>
        <span className="text-[10px] text-muted-foreground">
          {paper.status}
        </span>
        <span className="ml-auto text-[10px] text-muted-foreground flex items-center gap-1">
          <Calendar className="w-3 h-3" />
          {formatTime(paper.timestamp)}
        </span>
      </div>

      {/* Title */}
      <h3 className="font-semibold text-sm text-foreground mb-2 group-hover:text-primary transition-colors line-clamp-2 leading-snug">
        {paper.title}
      </h3>

      {/* Abstract */}
      <p className="text-muted-foreground text-xs leading-relaxed line-clamp-3 mb-3">
        {abstract}
      </p>

      {/* Footer */}
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <User className="w-3 h-3" />
          {paper.author || "Unknown"}
        </span>
        <span className="flex items-center gap-1 text-[10px] text-border group-hover:text-primary transition-colors">
          Read <ArrowRight className="w-3 h-3" />
        </span>
      </div>
    </Link>
  );
}
