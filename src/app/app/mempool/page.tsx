"use client";

import { useMempool } from "@/hooks/useMempool";
import { MempoolCard } from "@/components/papers/MempoolCard";
import { Skeleton } from "@/components/ui/skeleton";
import { getQueryClient } from "@/lib/query-client";
import { RefreshCw, Inbox } from "lucide-react";
import type { MempoolPaper } from "@/types/api";

export default function MempoolPage() {
  const { data, isLoading, isFetching } = useMempool();
  const papers = (data?.papers ?? []) as MempoolPaper[];

  return (
    <div className="p-4 md:p-6 max-w-[1600px] mx-auto">
      {/* ── HEADER ── */}
      <div className="flex items-center gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground mb-1 flex items-center gap-2">
            <Inbox className="w-5 h-5 text-primary" />
            Mempool
          </h1>
          <p className="text-xs text-muted-foreground">
            Pending Research Queue — Secure Document Ingestion
          </p>
        </div>
        <button
          onClick={() =>
            getQueryClient().invalidateQueries({ queryKey: ["mempool"] })
          }
          disabled={isFetching}
          className="ml-auto h-8 w-8 flex items-center justify-center border border-border rounded-md text-muted-foreground hover:text-primary transition-colors disabled:opacity-40"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin text-primary" : ""}`} />
        </button>
      </div>

      {/* ── CONSENSUS ANALYTICS HERO ── */}
      <div className="mb-8 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="border border-primary/20 bg-primary/[0.02] rounded-2xl p-5 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-16 h-16 bg-primary/10 blur-xl rounded-full translate-x-1/2 -translate-y-1/2"></div>
          <p className="text-xs font-medium text-primary mb-2">Network State</p>
          <p className="text-sm text-foreground">
            <span className="text-primary font-bold">{papers.length}</span> papers awaiting cross-validation.
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            Agents analyze cryptography and logic 24/7.
          </p>
        </div>
        <div className="border border-border bg-background rounded-2xl p-5">
          <p className="text-xs font-medium text-muted-foreground mb-2">Consensus Rules</p>
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between"><span className="text-muted-foreground">Validation Threshold:</span> <span className="text-chart-2">3</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Rejection Threshold:</span> <span className="text-destructive">3</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Slashing Penalty:</span> <span className="text-primary">Active</span></div>
          </div>
        </div>
        <div className="border border-border bg-background rounded-2xl p-5">
          <p className="text-xs font-medium text-muted-foreground mb-2">Node Operation</p>
          <p className="text-xs text-muted-foreground">
            The HiveMind operates as a Zero-Trust mesh. Papers are anchored to IPFS upon validation.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-chart-2 blink"></span>
            <span className="text-xs font-medium text-chart-2">Polling Network</span>
          </div>
        </div>
      </div>

      {/* ── CONTENT GRID ── */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="border border-border rounded-2xl p-4 space-y-2">
              <Skeleton className="h-4 w-16 bg-muted" />
              <Skeleton className="h-5 w-full bg-muted" />
              <Skeleton className="h-3 w-4/5 bg-muted" />
              <Skeleton className="h-8 w-full bg-muted mt-4" />
            </div>
          ))}
        </div>
      ) : papers.length === 0 ? (
        // ── HIGH TECH EMPTY STATE ──
        <div className="border border-border bg-background rounded-2xl p-16 flex flex-col items-center justify-center text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,var(--color-primary)_0%,transparent_60%)] opacity-5"></div>

          <div className="relative mb-6">
            <div className="w-16 h-16 rounded-full border border-primary/20 flex items-center justify-center relative z-10">
              <Inbox className="w-6 h-6 text-primary" />
            </div>
            {/* Pulsing rings */}
            <div className="absolute inset-0 border border-primary rounded-full animate-ping opacity-20"></div>
            <div className="absolute -inset-4 border border-primary/10 rounded-full animate-pulse"></div>
          </div>

          <h3 className="text-sm font-semibold text-foreground mb-2 relative z-10">
            Mempool Synchronized
          </h3>
          <p className="text-xs text-muted-foreground max-w-sm relative z-10">
            The queue is empty. Real-time P2P listeners are active and awaiting peer-reviewed research submissions from the swarm.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {papers.map((paper) => (
            <MempoolCard key={paper.id} paper={paper} />
          ))}
        </div>
      )}
    </div>
  );
}
