"use client";

import { useEffect, useState } from "react";
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

interface DatasetPaper {
  id: string;
  title: string;
  author: string;
  status: string;
  tier: string;
  lean_verified: boolean;
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

export default function DatasetPage() {
  const [stats, setStats] = useState<DatasetStats | null>(null);
  const [papers, setPapers] = useState<DatasetPaper[]>([]);
  const [podium, setPodium] = useState<PodiumEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [minScore, setMinScore] = useState(0);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  async function fetchData() {
    setLoading(true);
    try {
      const [statsRes, papersRes, podiumRes] = await Promise.all([
        fetch(`${API}/dataset/stats`),
        fetch(`${API}/dataset/papers?limit=100&min_score=${minScore}&verified_only=${verifiedOnly}`),
        fetch(`${API}/podium`),
      ]);
      if (statsRes.ok) setStats(await statsRes.json());
      if (papersRes.ok) {
        const data = await papersRes.json();
        setPapers(data.papers || []);
      }
      if (podiumRes.ok) {
        const data = await podiumRes.json();
        setPodium(data.podium || []);
      }
    } catch (e) {
      console.error("Dataset fetch error:", e);
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [minScore, verifiedOnly]);

  const filtered = papers.filter((p) =>
    searchQuery ? p.title.toLowerCase().includes(searchQuery.toLowerCase()) : true
  );

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-mono font-bold text-[#f5f0eb] flex items-center gap-2">
            <Database className="w-6 h-6 text-[#ff4e1a]" />
            Dataset Factory
          </h1>
          <p className="text-sm text-[#9a9490] font-mono mt-1">
            Quality-scored papers for ML training pipelines
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchData}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1a1a1c] border border-[#2c2c30] rounded-md text-xs font-mono text-[#9a9490] hover:text-[#f5f0eb] hover:border-[#ff4e1a]/30 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <a
            href={`${API}/dataset/export?min_score=${minScore}&fields=title,content,granular_scores,lean_verified`}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#ff4e1a] rounded-md text-xs font-mono text-black font-semibold hover:bg-[#ff6a3a] transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Export JSONL
          </a>
        </div>
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
            placeholder="Search papers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-transparent border-none text-sm font-mono text-[#f5f0eb] placeholder-[#52504e] outline-none w-48"
          />
        </div>
        <div className="h-4 w-px bg-[#2c2c30]" />
        <label className="flex items-center gap-2 text-xs font-mono text-[#9a9490] cursor-pointer">
          <span>Min Score:</span>
          <select
            value={minScore}
            onChange={(e) => setMinScore(Number(e.target.value))}
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
            onChange={(e) => setVerifiedOnly(e.target.checked)}
            className="rounded border-[#2c2c30] bg-[#1a1a1c] text-[#ff4e1a]"
          />
          Verified only
        </label>
        <div className="ml-auto text-xs font-mono text-[#52504e]">
          {filtered.length} papers
        </div>
      </div>

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
      <div className="space-y-3">
        {loading ? (
          <div className="text-center py-12 text-[#52504e] font-mono text-sm">
            Loading dataset...
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-[#52504e] font-mono text-sm">
            No papers match your filters. Try lowering the minimum score.
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
                      {paper.title}
                    </h3>
                    {paper.lean_verified && (
                      <span className="shrink-0 bg-green-500/20 text-green-400 text-[10px] px-1.5 py-0.5 rounded font-mono">
                        LEAN 4
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
                    {Object.entries(paper.granular_scores.sections).map(([key, val]) => (
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
                    <span>Judges: {paper.granular_scores.judges.join(", ")} ({paper.granular_scores.judge_count})</span>
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
                    {paper.lean_verified && (
                      <span className="px-1.5 py-0.5 rounded bg-green-500/20 text-green-400">
                        Lean 4 Verified
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
