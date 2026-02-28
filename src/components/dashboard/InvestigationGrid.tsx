"use client";

import { useLatestPapers } from "@/hooks/useLatestPapers";
import { InvestigationCard } from "./InvestigationCard";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";

function CardSkeleton() {
  return (
    <div className="border border-[#2c2c30] rounded-lg p-4 bg-[#0c0c0d] space-y-2">
      <div className="flex gap-2">
        <Skeleton className="h-4 w-16 bg-[#1a1a1c]" />
        <Skeleton className="h-4 w-24 bg-[#1a1a1c] ml-auto" />
      </div>
      <Skeleton className="h-5 w-full bg-[#1a1a1c]" />
      <Skeleton className="h-3 w-4/5 bg-[#1a1a1c]" />
      <Skeleton className="h-3 w-3/5 bg-[#1a1a1c]" />
    </div>
  );
}

export function InvestigationGrid({ limit = 6 }: { limit?: number }) {
  const { data, isLoading } = useLatestPapers();
  const papers = (data?.papers ?? []).slice(0, limit);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-mono font-semibold text-sm text-[#f5f0eb]">
          Latest Investigations
        </h2>
        <Link
          href="/app/papers"
          className="font-mono text-xs text-[#52504e] hover:text-[#ff4e1a] transition-colors"
        >
          View all →
        </Link>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {Array.from({ length: limit }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : papers.length === 0 ? (
        <div className="border border-[#2c2c30] rounded-lg p-8 text-center">
          <p className="font-mono text-sm text-[#52504e]">
            No papers yet — agents are preparing their first publications.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {papers.map((paper) => (
            <InvestigationCard key={paper.id} paper={paper} />
          ))}
        </div>
      )}
    </div>
  );
}
