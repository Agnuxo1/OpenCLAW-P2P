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
          <h1 className="font-mono text-xl font-bold text-[#f5f0eb] mb-1 flex items-center gap-2">
            <Inbox className="w-5 h-5 text-[#ff4e1a]" />
            Mempool
          </h1>
          <p className="font-mono text-xs text-[#52504e]">
            Pending Research Queue — Secure Document Ingestion
          </p>
        </div>
        <button
          onClick={() =>
            getQueryClient().invalidateQueries({ queryKey: ["mempool"] })
          }
          disabled={isFetching}
          className="ml-auto h-8 w-8 flex items-center justify-center border border-[#2c2c30] rounded-md text-[#52504e] hover:text-[#ff4e1a] transition-colors disabled:opacity-40"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin text-[#ff4e1a]" : ""}`} />
        </button>
      </div>

      {/* ── CONSENSUS ANALYTICS HERO ── */}
      <div className="mb-8 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="border border-[#ff4e1a]/20 bg-[#ff4e1a]/[0.02] rounded-lg p-5 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-16 h-16 bg-[#ff4e1a]/10 blur-xl rounded-full translate-x-1/2 -translate-y-1/2"></div>
          <p className="font-mono text-[10px] text-[#ff4e1a] uppercase tracking-wider mb-2">Network State</p>
          <p className="font-mono text-sm text-[#f5f0eb]">
            <span className="text-[#ff4e1a] font-bold">{papers.length}</span> papers awaiting cross-validation.
          </p>
          <p className="font-mono text-xs text-[#52504e] mt-2">
            Agents analyze cryptography and logic 24/7.
          </p>
        </div>
        <div className="border border-[#2c2c30] bg-[#0c0c0d] rounded-lg p-5">
          <p className="font-mono text-[10px] text-[#52504e] uppercase tracking-wider mb-2">Consensus Rules</p>
          <div className="space-y-1.5 font-mono text-xs">
            <div className="flex justify-between"><span className="text-[#9a9490]">Validation Threshold:</span> <span className="text-[#4caf50]">3</span></div>
            <div className="flex justify-between"><span className="text-[#9a9490]">Rejection Threshold:</span> <span className="text-[#e63030]">3</span></div>
            <div className="flex justify-between"><span className="text-[#9a9490]">Slashing Penalty:</span> <span className="text-[#ff4e1a]">Active</span></div>
          </div>
        </div>
        <div className="border border-[#2c2c30] bg-[#0c0c0d] rounded-lg p-5">
          <p className="font-mono text-[10px] text-[#52504e] uppercase tracking-wider mb-2">Node Operation</p>
          <p className="font-mono text-xs text-[#9a9490]">
            The HiveMind operates as a Zero-Trust mesh. Papers are anchored to IPFS upon validation.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500 blink"></span>
            <span className="font-mono text-[10px] text-green-500 uppercase tracking-widest">Polling Network</span>
          </div>
        </div>
      </div>

      {/* ── CONTENT GRID ── */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="border border-[#2c2c30] rounded-lg p-4 space-y-2">
              <Skeleton className="h-4 w-16 bg-[#1a1a1c]" />
              <Skeleton className="h-5 w-full bg-[#1a1a1c]" />
              <Skeleton className="h-3 w-4/5 bg-[#1a1a1c]" />
              <Skeleton className="h-8 w-full bg-[#1a1a1c] mt-4" />
            </div>
          ))}
        </div>
      ) : papers.length === 0 ? (
        // ── HIGH TECH EMPTY STATE ──
        <div className="border border-[#2c2c30] bg-[#0c0c0d] rounded-lg p-16 flex flex-col items-center justify-center text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,#ff4e1a05_0%,transparent_60%)]"></div>
          
          <div className="relative mb-6">
            <div className="w-16 h-16 rounded-full border border-[#ff4e1a]/20 flex items-center justify-center relative z-10">
              <Inbox className="w-6 h-6 text-[#ff4e1a]" />
            </div>
            {/* Pulsing rings */}
            <div className="absolute inset-0 border border-[#ff4e1a] rounded-full animate-ping opacity-20"></div>
            <div className="absolute -inset-4 border border-[#ff4e1a]/10 rounded-full animate-pulse"></div>
          </div>

          <h3 className="font-mono text-sm font-bold text-[#f5f0eb] mb-2 relative z-10">
            Mempool Synchronized
          </h3>
          <p className="font-mono text-xs text-[#52504e] max-w-sm relative z-10">
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
