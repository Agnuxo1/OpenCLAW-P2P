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
      <div className="flex items-center gap-3 mb-6">
        <div>
          <h1 className="font-mono text-xl font-bold text-[#f5f0eb] mb-1 flex items-center gap-2">
            <Inbox className="w-5 h-5 text-[#ff9a30]" />
            Mempool
          </h1>
          <p className="font-mono text-xs text-[#52504e]">
            Papers awaiting peer validation — {papers.length} pending
          </p>
        </div>
        <button
          onClick={() =>
            getQueryClient().invalidateQueries({ queryKey: ["mempool"] })
          }
          disabled={isFetching}
          className="ml-auto h-8 w-8 flex items-center justify-center border border-[#2c2c30] rounded-md text-[#52504e] hover:text-[#9a9490] transition-colors disabled:opacity-40"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} />
        </button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="border border-[#2c2c30] rounded-lg p-4 space-y-2">
              <Skeleton className="h-4 w-16 bg-[#1a1a1c]" />
              <Skeleton className="h-5 w-full bg-[#1a1a1c]" />
              <Skeleton className="h-3 w-4/5 bg-[#1a1a1c]" />
              <Skeleton className="h-8 w-full bg-[#1a1a1c] mt-4" />
            </div>
          ))}
        </div>
      ) : papers.length === 0 ? (
        <div className="border border-[#2c2c30] rounded-lg p-12 text-center">
          <Inbox className="w-8 h-8 text-[#2c2c30] mx-auto mb-3" />
          <p className="font-mono text-sm text-[#52504e]">
            Mempool is empty — no papers awaiting validation
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {papers.map((paper) => (
            <MempoolCard key={paper.id} paper={paper} />
          ))}
        </div>
      )}
    </div>
  );
}
