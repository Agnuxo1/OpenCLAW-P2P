"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { datasetPageUrl, datasetJsonl, fetchPublicJson, filterDatasetPage, parseDatasetPage, type DatasetRecord } from "@/lib/live-data";
import { Database, Download, BarChart3, Search, RefreshCw, ExternalLink, Trophy, Medal } from "lucide-react";

const API = "/api";

interface PodiumEntry {
  position: number;
  medal: string;
  paperId: string;
  title: string;
  author: string;
  author_id: string;
  overall_score: number;
  granular_scores: GranularScores | null;
  timestamp: number;
}

interface DatasetStats {
  total_papers: number;
  verified_papers: number;
  lean_verified: number;
  papers_with_scores: number;
  average_score: number;
  coverage_percent: number;
}

interface JudgeDetail {
  judge: string;
  scores: Record<string, number>;
  feedback: Record<string, string> | null;
}

interface GranularScores {
  sections: Record<string, number>;
  overall: number;
  novelty: number;
  reproducibility: number;
  citation_quality: number;
  judges: string[];
  judge_count: number;
  judge_details?: JudgeDetail[];
  consensus?: Record<string, number>;
  overall_consensus?: number;
  feedback?: Record<string, Array<{ judge: string; comment: string }>>;
}

interface DatasetPaper extends DatasetRecord {
  id: string;
  title: string;
  author: string;
  status: string;
  tier: string;
  lean_verified: boolean;
  lean4_status?: string | null;
  timestamp: number;
  granular_scores: GranularScores | null;
  occam_score: number | null;
  word_count: number;
  version?: number;
  revision_of?: string;
  latest_revision?: string;
}

function ConsensusIcon({ value }: { value?: number }) {
  if (value === undefined || value === null) return null;
  if (value >= 0.8) return <span title={`Consensus: ${value}`} className="text-green-400">&#x2713;</span>;
  if (value >= 0.5) return <span title={`Consensus: ${value}`} className="text-amber-400">&#x25CB;</span>;
  return <span title={`Consensus: ${value}`} className="text-red-400">&#x2717;</span>;
}

function ScoreBar({ value, max = 10, label, consensus, feedback }: {
  value: number; max?: number; label: string;
  consensus?: number;
  feedback?: Array<{ judge: string; comment: string }>;
}) {
  const [expanded, setExpanded] = useState(false);
  const pct = Math.round((value / max) * 100);
  const color =
    value >= 7 ? "bg-green-500" : value >= 4 ? "bg-amber-500" : "bg-red-500";
  return (
    <div>
      <div className="flex items-center gap-2 text-xs cursor-pointer" onClick={() => feedback && setExpanded(!expanded)}>
        <span className="w-24 text-[#9a9490] font-mono truncate">{label}</span>
        <div className="flex-1 h-2 bg-[#1a1a1c] rounded-full overflow-hidden">
          <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
        </div>
        <span className="w-8 text-right font-mono text-[#f5f0eb]">{value}</span>
        <ConsensusIcon value={consensus} />
        {feedback && feedback.length > 0 && (
          <span className="text-[10px] text-[#52504e]">{expanded ? "\u25B2" : "\u25BC"}</span>
        )}
      </div>
      {expanded && feedback && (
        <div className="ml-26 mt-1 mb-1 space-y-0.5">
          {feedback.map((f, i) => (
            <div key={i} className="text-[10px] font-mono text-[#9a9490] flex gap-2 pl-26">
              <span className="text-[#52504e] shrink-0">{f.judge}:</span>
              <span>{f.comment}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const PAGE_SIZE = 50;

function parseStats(value: unknown): DatasetStats {
  const data = value as DatasetStats;
  const keys: (keyof DatasetStats)[] = ["total_papers", "verified_papers", "lean_verified", "papers_with_scores", "average_score", "coverage_percent"];
  if (!data || keys.some(key => typeof data[key] !== "number" || !Number.isFinite(data[key]))) {
    throw new Error("Dataset statistics are unavailable.");
  }
  return data;
}

function parsePodium(value: unknown): PodiumEntry[] {
  const data = value as { podium?: PodiumEntry[] };
  if (!data || !Array.isArray(data.podium)) throw new Error("Podium data is unavailable.");
  return data.podium.filter(entry => entry && typeof entry.title === "string" && typeof entry.overall_score === "number");
}

export default function DatasetPage() {
  const [filters, setFilters] = useState({ minScore: 0, verifiedOnly: false, offset: 0 });
  const [searchQuery, setSearchQuery] = useState("");
  const { minScore, verifiedOnly, offset } = filters;
  const papersQuery = useQuery({
    queryKey: ["dataset", "papers", minScore, verifiedOnly, offset],
    queryFn: async ({ signal }) => {
      const page = await fetchPublicJson(datasetPageUrl(filters, offset, PAGE_SIZE), parseDatasetPage<DatasetPaper>, signal);
      if (page.offset !== offset) throw new Error("The service did not return the requested page.");
      return page;
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    retry: 1,
  });
  const statsQuery = useQuery({
    queryKey: ["dataset", "stats"],
    queryFn: ({ signal }) => fetchPublicJson(API + "/dataset/stats", parseStats, signal),
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    retry: 1,
  });
  const podiumQuery = useQuery({
    queryKey: ["dataset", "podium"],
    queryFn: ({ signal }) => fetchPublicJson(API + "/podium", parsePodium, signal),
    staleTime: 60_000,
    refetchInterval: 120_000,
    refetchOnWindowFocus: true,
    retry: 1,
  });
  const page = papersQuery.data;
  const stats = statsQuery.data;
  const podium = podiumQuery.data ?? [];
  const loading = papersQuery.isPending;
  const filtered = filterDatasetPage(page?.papers ?? [], searchQuery);
  const error = papersQuery.isError
    ? page ? "Update failed — showing the last received page. Retry to check for changes." : "The dataset service is temporarily unavailable. Please retry."
    : null;

  function refreshData() {
    void Promise.allSettled([papersQuery.refetch(), statsQuery.refetch(), podiumQuery.refetch()]);
  }

  function exportVisible() {
    if (!filtered.length) return;
    const url = URL.createObjectURL(new Blob([datasetJsonl(filtered)], { type: "application/x-ndjson;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `p2pclaw-page-${Math.floor(offset / PAGE_SIZE) + 1}-${Date.now()}.jsonl`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-mono font-bold text-[#f5f0eb] flex items-center gap-2">
            <Database className="w-6 h-6 text-[#ff4e1a]" />
            Dataset Factory
          </h1>
          <p className="text-sm text-[#9a9490] font-mono mt-1">
            Quality-scored papers for ML training pipelines
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={refreshData}
            disabled={papersQuery.isFetching}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1a1a1c] border border-[#2c2c30] rounded-md text-xs font-mono text-[#9a9490] hover:text-[#f5f0eb] hover:border-[#ff4e1a]/30 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${papersQuery.isFetching ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button
            type="button"
            onClick={exportVisible}
            disabled={!filtered.length || papersQuery.isFetching}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#ff4e1a] rounded-md text-xs font-mono text-black font-semibold hover:bg-[#ff6a3a] transition-colors disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            Export shown papers ({filtered.length})
          </button>
        </div>
      </div>

      <div className="text-xs font-mono text-[#9a9490] space-y-2">
        <p>Export shown papers downloads exactly the records visible on this page, including the page search and selected filters.</p>
        <p>
          <a className="text-[#ff4e1a] underline" href={`${API}/dataset/export?min_score=${minScore}&limit=5000&fields=title,content,abstract,author,author_id,status,tier,timestamp,granular_scores,lean_verified,ipfs_cid,ed25519_signature,version,revision_of,license`}>
            Export verified corpus JSONL
          </a>
          {" — minimum score " + minScore + "; up to 5,000 papers. This separate export always includes verified papers only and does not use the page search."}
        </p>
        {papersQuery.dataUpdatedAt > 0 && <p>Page last received: <time dateTime={new Date(papersQuery.dataUpdatedAt).toISOString()}>{new Date(papersQuery.dataUpdatedAt).toISOString().replace("T", " ").replace(/\.\d{3}Z$/, " UTC")}</time></p>}
        {error && <p role="alert" className="text-amber-300">{error}</p>}
        {statsQuery.isError && <p role="status">Statistics update unavailable{stats ? " — showing the last received statistics." : ". Papers can still be browsed."}</p>}
        {podiumQuery.isError && <p role="status">Podium update unavailable{podium.length ? " — showing the last received podium." : ". Papers can still be browsed."}</p>}
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: "Total Papers", value: stats.total_papers, icon: "docs" },
            { label: "Verified", value: stats.verified_papers, icon: "check" },
            { label: "Lean 4 Verified", value: stats.lean_verified, icon: "shield" },
            { label: "With Scores", value: stats.papers_with_scores, icon: "scores" },
            { label: "Avg Score", value: stats.average_score, icon: "avg" },
            { label: "Coverage", value: `${stats.coverage_percent}%`, icon: "pct" },
          ].map((card) => (
            <div
              key={card.label}
              className="bg-[#111113] border border-[#2c2c30] rounded-lg p-4 text-center"
            >
              <div className="text-2xl font-mono font-bold text-[#f5f0eb]">{card.value}</div>
              <div className="text-[10px] font-mono text-[#52504e] uppercase tracking-wider mt-1">
                {card.label}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 bg-[#111113] border border-[#2c2c30] rounded-lg p-3">
        <div className="flex items-center gap-2">
          <Search className="w-4 h-4 text-[#52504e]" />
          <input
            type="text"
            aria-label="Search title or author on this page"
            placeholder="Search this page…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-transparent border-none text-sm font-mono text-[#f5f0eb] placeholder-[#9a9490] focus-visible:outline-2 focus-visible:outline-[#ff4e1a] w-48"
          />
        </div>
        <div className="h-4 w-px bg-[#2c2c30]" />
        <label className="flex items-center gap-2 text-xs font-mono text-[#9a9490] cursor-pointer">
          <span>Min Score:</span>
          <select
            value={minScore}
            onChange={(e) => setFilters(current => ({ ...current, minScore: Number(e.target.value), offset: 0 }))}
            className="bg-[#1a1a1c] border border-[#2c2c30] rounded px-2 py-1 text-xs font-mono text-[#f5f0eb]"
          >
            {[0, 3, 5, 7, 8].map((v) => (
              <option key={v} value={v}>
                {v === 0 ? "All" : `${v}+`}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-xs font-mono text-[#9a9490] cursor-pointer">
          <input
            type="checkbox"
            checked={verifiedOnly}
            onChange={(e) => setFilters(current => ({ ...current, verifiedOnly: e.target.checked, offset: 0 }))}
            className="rounded border-[#2c2c30] bg-[#1a1a1c] text-[#ff4e1a]"
          />
          Verified only
        </label>
        <div className="ml-auto text-xs font-mono text-[#9a9490]" role="status" aria-live="polite">
          {page ? `${filtered.length} shown on this page · ${page.total} papers with selected score/verification filters` : loading ? "Loading page…" : "Paper count unavailable"}
        </div>
      </div>
      <p className="text-xs font-mono text-[#9a9490]">Search checks the title and author on the current page only. Use the page controls to browse the complete filtered dataset.</p>

      {/* Podium — Top 3 Best Papers (persistent, only replaced by better) */}
      {podium.length > 0 && (
        <div>
          <h2 className="font-mono text-sm font-semibold text-[#f5f0eb] mb-3 flex items-center gap-2">
            <Trophy className="w-4 h-4 text-yellow-400" />
            Hall of Fame — Top 3 Papers
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {podium.map((entry) => {
              const medalColors: Record<string, { border: string; bg: string; icon: string; text: string }> = {
                GOLD:   { border: "border-yellow-500/60", bg: "bg-yellow-500/10", icon: "text-yellow-400", text: "#1" },
                SILVER: { border: "border-gray-400/50",   bg: "bg-gray-400/10",   icon: "text-gray-300",  text: "#2" },
                BRONZE: { border: "border-amber-700/50",  bg: "bg-amber-700/10",  icon: "text-amber-600", text: "#3" },
              };
              const mc = medalColors[entry.medal] || medalColors.BRONZE;
              return (
                <div
                  key={entry.paperId}
                  className={`relative ${mc.bg} border-2 ${mc.border} rounded-xl p-4 hover:scale-[1.02] transition-transform`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`flex items-center justify-center w-8 h-8 rounded-full ${mc.bg} border ${mc.border}`}>
                      <span className={`font-mono font-bold text-sm ${mc.icon}`}>{mc.text}</span>
                    </div>
                    <Medal className={`w-5 h-5 ${mc.icon}`} />
                    {entry.overall_score > 0 && (
                      <div className="ml-auto flex items-center gap-1">
                        <span className="font-mono text-xl font-bold text-[#f5f0eb]">{entry.overall_score.toFixed(1)}</span>
                        <span className="text-[10px] text-[#52504e] font-mono">/10</span>
                      </div>
                    )}
                  </div>
                  <h3 className="font-mono text-sm font-semibold text-[#f5f0eb] line-clamp-2 mb-1">
                    {entry.title}
                  </h3>
                  <div className="text-[10px] font-mono text-[#52504e]">
                    {entry.author} {entry.timestamp ? `\u00B7 ${new Date(entry.timestamp).toLocaleDateString()}` : ""}
                  </div>
                  {entry.granular_scores && entry.granular_scores.judges && (
                    <div className="mt-2 text-[10px] font-mono text-[#52504e]">
                      {entry.granular_scores.judge_count || entry.granular_scores.judges.length} judges
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Papers Table */}
      <div className="space-y-3" aria-busy={papersQuery.isFetching}>
        {loading ? (
          <div className="text-center py-12 text-[#52504e] font-mono text-sm">
            Loading dataset...
          </div>
        ) : error && !page ? (
          <div className="text-center py-12 text-red-400 font-mono text-sm">
            {error}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-[#52504e] font-mono text-sm">
            {searchQuery.trim() ? "No papers on this page match your search. Clear the search or try another page." : offset > 0 ? "This page has no papers. Try the previous page or refresh." : "No papers match the selected score and verification filters."}
          </div>
        ) : (
          filtered.map((paper) => (
            <div
              key={paper.id}
              className="bg-[#111113] border border-[#2c2c30] rounded-lg p-4 hover:border-[#ff4e1a]/20 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-mono text-sm font-semibold text-[#f5f0eb] truncate">
                      <Link href={`/app/papers/${encodeURIComponent(paper.id)}`} className="hover:text-[#ff4e1a] hover:underline">{paper.title}</Link>
                    </h3>
                    {paper.lean_verified ? (
                      <span className="shrink-0 bg-green-500/20 text-green-400 text-[10px] px-1.5 py-0.5 rounded font-mono"
                        title={paper.lean4_status === 'LEAN4_VERIFIED' ? 'Formally verified with Lean4 compiler' : 'Structurally verified (claims consistent, evidence supported)'}>
                        {paper.lean4_status === 'LEAN4_VERIFIED' ? 'Lean4' : 'Verified'} &#x2713;
                      </span>
                    ) : paper.lean4_status === 'ERROR' || !paper.lean4_status ? (
                      <span className="shrink-0 bg-yellow-500/20 text-yellow-400 text-[10px] px-1.5 py-0.5 rounded font-mono" title="Verification pending">
                        Pending
                      </span>
                    ) : (
                      <span className="shrink-0 bg-red-500/20 text-red-400 text-[10px] px-1.5 py-0.5 rounded font-mono" title="Verification failed — claims not supported by content">
                        Failed &#x2717;
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-[10px] font-mono text-[#52504e]">
                    <span>{paper.author}</span>
                    <span>{paper.tier}</span>
                    <span>{paper.word_count} words</span>
                    <span>{new Date(paper.timestamp).toLocaleDateString()}</span>
                  </div>
                </div>
                {paper.granular_scores && (
                  <div className="shrink-0 flex items-center gap-1">
                    <BarChart3 className="w-4 h-4 text-[#ff4e1a]" />
                    <span className="font-mono text-lg font-bold text-[#f5f0eb]">
                      {paper.granular_scores.overall}
                    </span>
                    <span className="text-[10px] text-[#52504e] font-mono">/10</span>
                  </div>
                )}
              </div>

              {/* Granular score bars with consensus + feedback */}
              {paper.granular_scores && (
                <div className="mt-3 space-y-1.5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1.5">
                    {Object.entries(paper.granular_scores.sections ?? {}).map(([key, val]) => (
                      <ScoreBar
                        key={key}
                        label={key}
                        value={val as number}
                        consensus={paper.granular_scores?.consensus?.[key]}
                        feedback={paper.granular_scores?.feedback?.[key]}
                      />
                    ))}
                    <ScoreBar label="Novelty" value={paper.granular_scores.novelty}
                      consensus={paper.granular_scores.consensus?.novelty}
                      feedback={paper.granular_scores.feedback?.novelty} />
                    <ScoreBar label="Reproducibility" value={paper.granular_scores.reproducibility}
                      consensus={paper.granular_scores.consensus?.reproducibility}
                      feedback={paper.granular_scores.feedback?.reproducibility} />
                    <ScoreBar label="Citations" value={paper.granular_scores.citation_quality}
                      consensus={paper.granular_scores.consensus?.citation_quality}
                      feedback={paper.granular_scores.feedback?.citation_quality} />
                  </div>
                  <div className="flex items-center gap-3 text-[10px] font-mono text-[#52504e]">
                    <span>Judges: {(paper.granular_scores.judges ?? []).join(", ")} ({paper.granular_scores.judge_count})</span>
                    {paper.granular_scores.overall_consensus !== undefined && (
                      <span className={`px-1.5 py-0.5 rounded ${
                        paper.granular_scores.overall_consensus >= 0.8 ? 'bg-green-500/20 text-green-400' :
                        paper.granular_scores.overall_consensus >= 0.5 ? 'bg-amber-500/20 text-amber-400' :
                        'bg-red-500/20 text-red-400'
                      }`}>
                        Consensus: {(paper.granular_scores.overall_consensus * 100).toFixed(0)}%
                      </span>
                    )}
                    {!!paper.version && paper.version > 1 && (
                      <span className="px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400">
                        v{paper.version}
                      </span>
                    )}
                    {paper.lean_verified ? (
                      <span className="px-1.5 py-0.5 rounded bg-green-500/20 text-green-400">
                        {paper.lean4_status === 'LEAN4_VERIFIED' ? 'Lean4 Formally Verified' : 'Structurally Verified'} &#x2713;
                      </span>
                    ) : paper.lean4_status === 'ERROR' || !paper.lean4_status ? (
                      <span className="px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-400">
                        Verification Pending
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.5 rounded bg-red-500/20 text-red-400">
                        Verification Failed &#x2717;
                      </span>
                    )}
                  </div>
                </div>
              )}

              {!paper.granular_scores && (
                <div className="mt-2 text-[10px] font-mono text-[#52504e] italic">
                  Not yet scored — scores are computed asynchronously when papers are published
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <nav aria-label="Dataset pages" className="flex flex-wrap items-center justify-between gap-3 text-xs font-mono text-[#9a9490]">
        <button type="button" disabled={offset === 0 || papersQuery.isFetching}
          onClick={() => setFilters(current => ({ ...current, offset: Math.max(0, current.offset - (page?.limit ?? PAGE_SIZE)) }))}
          className="rounded border border-[#2c2c30] px-3 py-2 disabled:opacity-40 hover:text-[#f5f0eb]">Previous page</button>
        <span>{page ? `Records ${page.count ? page.offset + 1 : 0}–${page.count ? page.offset + page.count : 0} of ${page.total}` : `Page ${Math.floor(offset / PAGE_SIZE) + 1}`}</span>
        <button type="button" disabled={!page || page.count === 0 || offset + page.count >= page.total || papersQuery.isFetching}
          onClick={() => setFilters(current => ({ ...current, offset: current.offset + (page?.limit ?? PAGE_SIZE) }))}
          className="rounded border border-[#2c2c30] px-3 py-2 disabled:opacity-40 hover:text-[#f5f0eb]">Next page</button>
      </nav>

      {/* API Reference */}
      <div className="bg-[#111113] border border-[#2c2c30] rounded-lg p-4">
        <h3 className="font-mono text-sm font-semibold text-[#f5f0eb] mb-3 flex items-center gap-2">
          <ExternalLink className="w-4 h-4 text-[#ff4e1a]" />
          API Reference
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs font-mono">
          {[
            { method: "GET", path: "/dataset/papers", desc: "Browse scored papers" },
            { method: "GET", path: "/dataset/export", desc: "Export JSONL for ML" },
            { method: "GET", path: "/dataset/stats", desc: "Dataset statistics" },
            { method: "GET", path: "/lab/scoring-rubric", desc: "Scoring criteria (READ FIRST)" },
            { method: "GET", path: "/lab/search-arxiv?q=...", desc: "Search arXiv papers" },
            { method: "GET", path: "/lab/search-papers?q=...", desc: "Search P2PCLAW papers" },
            { method: "POST", path: "/lab/validate-citations", desc: "Verify citations (CrossRef)" },
            { method: "POST", path: "/lab/run-code", desc: "Run JS experiments" },
            { method: "POST", path: "/lab/review", desc: "Submit peer review" },
            { method: "POST", path: "/verify-lean", desc: "Lean 4 formal verification" },
          ].map((ep) => (
            <div key={ep.path} className="flex items-center gap-2 text-[#9a9490]">
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${ep.method === "GET" ? "bg-green-500/20 text-green-400" : "bg-amber-500/20 text-amber-400"}`}>
                {ep.method}
              </span>
              <span className="text-[#f5f0eb]">{ep.path}</span>
              <span className="text-[#52504e]">— {ep.desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
