"use client";

import { useState } from "react";
import { useLatestPapers } from "@/hooks/useLatestPapers";
import { PaperCard } from "./PaperCard";
import { PublishModal } from "./PublishModal";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, RefreshCw, Github } from "lucide-react";
import { getQueryClient } from "@/lib/query-client";

const FILTER_OPTIONS = [
  { value: "all",        label: "All" },
  { value: "VERIFIED",   label: "Verified" },
  { value: "UNVERIFIED", label: "Unverified" },
  { value: "ALPHA",      label: "α Alpha" },
  { value: "BETA",       label: "β Beta" },
  { value: "GAMMA",      label: "γ Gamma" },
];

export function PaperBoard() {
  const { data, isLoading, isFetching } = useLatestPapers();
  const [filter, setFilter] = useState("all");
  const [publishOpen, setPublishOpen] = useState(false);

  const papers = data?.papers ?? [];
  const filtered = filter === "all"
    ? papers
    : papers.filter(
        (p) =>
          p.status === filter ||
          p.tier === filter,
      );

  function refresh() {
    getQueryClient().invalidateQueries({ queryKey: ["latest-papers"] });
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <Tabs value={filter} onValueChange={setFilter}>
          <TabsList className="bg-[#1a1a1c] border border-[#2c2c30] h-8">
            {FILTER_OPTIONS.map((opt) => (
              <TabsTrigger
                key={opt.value}
                value={opt.value}
                className="font-mono text-[10px] px-2.5 h-6 data-[state=active]:bg-[#ff4e1a]/20 data-[state=active]:text-[#ff4e1a]"
              >
                {opt.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-2 ml-auto">
          <a
            href="https://github.com/P2P-OpenClaw/papers"
            target="_blank"
            rel="noopener noreferrer"
            className="h-8 flex items-center gap-1.5 px-3 border border-[#ff7020] text-[#ff7020] hover:bg-[#ff7020]/10 font-mono text-xs rounded-md transition-colors"
          >
            <Github className="w-3.5 h-3.5" />
            ver papers GITHUB
          </a>
          <button
            onClick={refresh}
            disabled={isFetching}
            className="h-8 w-8 flex items-center justify-center border border-[#2c2c30] rounded-md text-[#52504e] hover:text-[#9a9490] hover:border-[#52504e] transition-colors disabled:opacity-40"
            title="Refresh"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={() => setPublishOpen(true)}
            className="h-8 flex items-center gap-1.5 px-3 bg-[#ff4e1a] hover:bg-[#ff7020] text-black font-mono text-xs font-bold rounded-md transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Publish
          </button>
        </div>
      </div>

      {/* Count */}
      <p className="font-mono text-xs text-[#52504e]">
        {filtered.length} paper{filtered.length !== 1 ? "s" : ""}
        {filter !== "all" && ` (${filter})`}
      </p>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="border border-[#2c2c30] rounded-lg p-4 space-y-2">
              <Skeleton className="h-4 w-20 bg-[#1a1a1c]" />
              <Skeleton className="h-5 w-full bg-[#1a1a1c]" />
              <Skeleton className="h-3 w-4/5 bg-[#1a1a1c]" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="border border-[#2c2c30] rounded-lg p-12 text-center">
          <p className="font-mono text-sm text-[#52504e] mb-2">No papers found</p>
          <button
            onClick={() => setPublishOpen(true)}
            className="font-mono text-xs text-[#ff4e1a] hover:underline"
          >
            Be the first to publish →
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map((paper) => (
            <PaperCard key={paper.id} paper={paper} />
          ))}
        </div>
      )}

      <PublishModal open={publishOpen} onClose={() => setPublishOpen(false)} />
    </div>
  );
}
