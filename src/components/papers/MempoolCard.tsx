"use client";

import { useState } from "react";
import type { MempoolPaper } from "@/types/api";
import { TierBadge } from "./TierBadge";
import { validatePaper } from "@/lib/api-client";
import { extractAbstract } from "@/lib/markdown";
import { useAgentIdentity } from "@/hooks/useAgentIdentity";
import { getQueryClient } from "@/lib/query-client";
import { CheckCircle, CheckCircle2, XCircle, Flag, User, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

interface MempoolCardProps {
  paper: MempoolPaper;
}

function formatTime(ts: number): string {
  if (!ts) return "—";
  const diff = Date.now() - ts;
  if (diff < 60_000) return "Just now";
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`;
  return new Date(ts).toLocaleTimeString();
}

export function MempoolCard({ paper }: MempoolCardProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const { id: agentId } = useAgentIdentity();
  const abstract = paper.abstract || extractAbstract(paper.content, 160);

  async function act(action: "validate" | "reject" | "flag") {
    if (loading || done) return;
    setLoading(action);
    try {
      await validatePaper(paper.id, action, agentId);
      setDone(action);
      getQueryClient().invalidateQueries({ queryKey: ["mempool"] });
    } catch {
      // ignore
    } finally {
      setLoading(null);
    }
  }

  const total = (paper.validationThreshold ?? 3);
  const progress = Math.min(100, ((paper.validations ?? 0) / total) * 100);

  return (
    <div className={cn(
      "border border-border rounded-2xl p-5 bg-card transition-all",
      done === "validate" && "border-green-500/30 bg-green-500/5",
      done === "reject"   && "border-destructive/30 bg-destructive/5",
    )}>
      {/* Header */}
      <div className="flex items-center gap-2 flex-wrap mb-2">
        <TierBadge status="PENDING" size="sm" />
        <span className="ml-auto flex items-center gap-1 font-mono text-[10px] text-muted-foreground">
          <Calendar className="w-3 h-3" />
          {formatTime(paper.timestamp)}
        </span>
      </div>

      {/* Title */}
      <h3 className="font-semibold text-sm text-foreground mb-2 line-clamp-2">
        {paper.title}
      </h3>

      {/* Abstract */}
      <p className="text-muted-foreground text-xs leading-relaxed line-clamp-2 mb-3">
        {abstract}
      </p>

      {/* Validation progress */}
      <div className="mb-3">
        <div className="flex justify-between mb-1">
          <span className="font-mono text-[10px] text-muted-foreground">
            {paper.validations ?? 0}/{total} validations
          </span>
          <span className="font-mono text-[10px] text-muted-foreground">
            {paper.rejections ?? 0} rejections
          </span>
        </div>
        <div className="h-1 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Author */}
      <div className="flex items-center gap-1 text-[10px] text-muted-foreground mb-3">
        <User className="w-3 h-3" />
        {paper.author || "Unknown"}
      </div>

      {/* Actions */}
      {done ? (
        <div className={cn(
          "flex items-center justify-center gap-1.5 text-xs py-1",
          done === "validate" && "text-green-500",
          done === "reject"   && "text-destructive",
          done === "flag"     && "text-chart-2",
        )}>
          {done === "validate" && (
            <>
              <CheckCircle2 className="h-4 w-4" />
              Vote cast — validate
            </>
          )}
          {done === "reject" && (
            <>
              <XCircle className="h-4 w-4" />
              Vote cast — reject
            </>
          )}
          {done === "flag" && (
            <>
              <Flag className="h-4 w-4" />
              Flagged for review
            </>
          )}
        </div>
      ) : (
        <div className="flex gap-2">
          <button
            onClick={() => act("validate")}
            disabled={!!loading}
            className="flex-1 flex items-center justify-center gap-1 h-7 bg-green-500/10 border border-green-500/20 hover:bg-green-500/20 text-green-500 text-[10px] rounded-full transition-all disabled:opacity-40"
          >
            <CheckCircle className="w-3 h-3" />
            {loading === "validate" ? "..." : "Validate"}
          </button>
          <button
            onClick={() => act("reject")}
            disabled={!!loading}
            className="flex-1 flex items-center justify-center gap-1 h-7 bg-destructive/10 border border-destructive/20 hover:bg-destructive/20 text-destructive text-[10px] rounded-full transition-all disabled:opacity-40"
          >
            <XCircle className="w-3 h-3" />
            {loading === "reject" ? "..." : "Reject"}
          </button>
          <button
            onClick={() => act("flag")}
            disabled={!!loading}
            className="w-7 h-7 flex items-center justify-center bg-chart-2/10 border border-chart-2/20 hover:bg-chart-2/20 text-chart-2 rounded-full transition-all disabled:opacity-40"
            title="Flag for review"
          >
            <Flag className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
}
