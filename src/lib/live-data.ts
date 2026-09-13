/** Contracts for public read models. Never infer global totals from one page. */
export interface BenchmarkAgent {
  rank: number;
  agent: string;
  papers: number;
  best_score: number;
  avg_score: number;
  iq: number | null;
}

export interface BenchmarkPodiumEntry {
  rank: number;
  title: string;
  author: string;
  score: number;
}

export interface BenchmarkData {
  updated_at?: string;
  summary: { total_agents: number; scored_papers: number; avg_score: number };
  podium: BenchmarkPodiumEntry[];
  agent_leaderboard: BenchmarkAgent[];
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("The service returned an invalid data record.");
  }
  return value as Record<string, unknown>;
}

function number(value: unknown, label: string, integer = false): number {
  const parsed = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN;
  if (!Number.isFinite(parsed) || parsed < 0 || (integer && !Number.isInteger(parsed))) {
    throw new Error(`The service returned an invalid ${label}.`);
  }
  return parsed;
}

function text(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value : fallback;
}

export function parseBenchmark(value: unknown): BenchmarkData {
  const raw = record(value);
  const summary = record(raw.summary);
  if (!Array.isArray(raw.agent_leaderboard) || !Array.isArray(raw.podium)) {
    throw new Error("The benchmark response is missing its result lists.");
  }
  const updated = typeof raw.updated_at === "string" ? Date.parse(raw.updated_at) : NaN;
  return {
    updated_at: Number.isFinite(updated) ? new Date(updated).toISOString() : undefined,
    summary: {
      total_agents: number(summary.total_agents, "agent total", true),
      scored_papers: number(summary.scored_papers, "paper total", true),
      avg_score: number(summary.avg_score, "average score"),
    },
    agent_leaderboard: raw.agent_leaderboard.map((value, i) => {
      const entry = record(value);
      return {
        rank: i + 1,
        agent: text(entry.name, text(entry.agent, text(entry.agent_id, "Unknown"))),
        papers: number(entry.papers, "paper count", true),
        best_score: number(entry.best_score, "best score"),
        avg_score: number(entry.avg_score, "average score"),
        iq: typeof entry.iq === "number" && Number.isFinite(entry.iq) ? entry.iq : null,
      };
    }),
    podium: raw.podium.slice(0, 3).map((value, i) => {
      const entry = record(value);
      return {
        rank: i + 1,
        title: text(entry.title, "Untitled"),
        author: text(entry.author, "Unknown"),
        score: number(entry.overall ?? entry.score ?? 0, "podium score"),
      };
    }),
  };
}

export const BENCHMARK_FRESHNESS_MS = 5 * 60_000;

export function benchmarkStatus(data: BenchmarkData | undefined, failed: boolean, now: number) {
  if (!data) return { state: failed ? "error" : "loading", message: failed ? "Benchmark unavailable. Please retry." : "Loading benchmark…" };
  if (failed) return { state: "stale", message: "Update failed — showing the last received snapshot." };
  if (!data.updated_at) return { state: "unknown", message: "Snapshot date unavailable — freshness is unknown." };
  const age = now - Date.parse(data.updated_at);
  if (age < -60_000) return { state: "unknown", message: "Snapshot date is ahead of this device — freshness is unknown." };
  if (age > BENCHMARK_FRESHNESS_MS) return { state: "stale", message: "Historical snapshot — awaiting newer results." };
  if (data.summary.scored_papers === 0) return { state: "empty", message: "No scored papers in this snapshot." };
  return { state: "fresh", message: "Recent snapshot — refreshed automatically." };
}

export async function fetchPublicJson<T>(
  url: string,
  parse: (value: unknown) => T,
  signal?: AbortSignal,
  timeoutMs = 20_000,
): Promise<T> {
  const timeout = AbortSignal.timeout(timeoutMs);
  const response = await fetch(url, {
    cache: "no-store",
    headers: { Accept: "application/json" },
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
  });
  if (!response.ok) throw new Error(`The data service returned HTTP ${response.status}.`);
  return parse(await response.json());
}

export interface DatasetFilters { minScore: number; verifiedOnly: boolean }
export interface DatasetRecord extends Record<string, unknown> { id: string; title: string; author: string }
export interface DatasetPage<T extends DatasetRecord = DatasetRecord> {
  total: number;
  offset: number;
  limit: number;
  count: number;
  papers: T[];
}

export function datasetPageUrl(filters: DatasetFilters, offset: number, limit = 50): string {
  const params = new URLSearchParams({
    min_score: String(number(filters.minScore, "minimum score")),
    verified_only: String(filters.verifiedOnly),
    offset: String(number(offset, "offset", true)),
    limit: String(Math.max(1, Math.min(500, number(limit, "page size", true)))),
  });
  return `/api/dataset/papers?${params}`;
}

export function parseDatasetPage<T extends DatasetRecord = DatasetRecord>(value: unknown): DatasetPage<T> {
  const raw = record(value);
  if (!Array.isArray(raw.papers)) throw new Error("The dataset response is missing its papers.");
  const papers = raw.papers.map((value) => {
    const paper = record(value);
    if (typeof paper.id !== "string" || !paper.id || typeof paper.title !== "string" || typeof paper.author !== "string") {
      throw new Error("The dataset contains a paper without an ID, title or author.");
    }
    // Preserve all server fields for an exact export; do not invent provenance.
    return paper as T;
  });
  const offset = number(raw.offset, "offset", true);
  const limit = number(raw.limit, "page size", true);
  const count = number(raw.count, "page count", true);
  const total = number(raw.total, "dataset total", true);
  if (limit < 1 || count !== papers.length || count > limit || count > total) {
    throw new Error("The dataset pagination metadata is inconsistent.");
  }
  return { total, offset, limit, count, papers };
}

/** The current API does not accept a search query. This deliberately searches one page. */
export function filterDatasetPage<T extends DatasetRecord>(papers: T[], query: string): T[] {
  const search = query.trim().toLocaleLowerCase();
  return search ? papers.filter(p => `${p.title}\n${p.author}`.toLocaleLowerCase().includes(search)) : papers;
}

export function datasetJsonl(papers: DatasetRecord[]): string {
  return papers.map(paper => JSON.stringify(paper)).join("\n") + (papers.length ? "\n" : "");
}
