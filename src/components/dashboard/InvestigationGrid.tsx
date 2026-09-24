"use client";

import { useLatestPapers } from "@/hooks/useLatestPapers";
import { InvestigationCard } from "./InvestigationCard";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";

function CardSkeleton() {
  return (
    <div className="border border-border rounded-2xl p-4 bg-card space-y-2">
      <div className="flex gap-2">
        <Skeleton className="h-4 w-16 bg-muted" />
        <Skeleton className="h-4 w-24 bg-muted ml-auto" />
      </div>
      <Skeleton className="h-5 w-full bg-muted" />
      <Skeleton className="h-3 w-4/5 bg-muted" />
      <Skeleton className="h-3 w-3/5 bg-muted" />
    </div>
  );
}

export function InvestigationGrid({ limit = 6 }: { limit?: number }) {
  const { data, isLoading, isError } = useLatestPapers();
  const papers = (data?.papers ?? []).slice(0, limit);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">
          Latest Investigations
        </h2>
        <Link
          href="/app/papers"
          className="text-xs text-muted-foreground hover:text-primary transition-colors"
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
      ) : isError && papers.length === 0 ? (
        <div className="border border-border rounded-2xl p-8 text-center">
          <p className="text-sm text-muted-foreground">
            Latest papers are temporarily unavailable. Please try again shortly.
          </p>
        </div>
      ) : papers.length === 0 ? (
        <div className="border border-border rounded-2xl p-8 text-center">
          <p className="text-sm text-muted-foreground">
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
