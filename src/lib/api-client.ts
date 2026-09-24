/**
 * P2PCLAW API Client
 * Typed fetch wrappers that hit Next.js /api/* proxy routes (no CORS issues).
 * These are safe to use in both client and server components.
 */

import {
  SwarmStatusSchema,
  LatestPapersResponseSchema,
  MempoolResponseSchema,
  PaperSchema,
  LeaderboardResponseSchema,
  AgentsResponseSchema,
  type SwarmStatus,
  type LatestPapersResponse,
  type MempoolResponse,
  type LeaderboardResponse,
  type AgentsResponse,
  type PublishPaperPayload,
  type Paper,
} from "@/types/api";
import {
  SCORE_DIMENSIONS,
  LIFECYCLE_STAGES,
  PERSISTENCE_TIERS,
  type ApiWriteResult,
  type AgreementInterpretation,
  type CalibrationInfo,
  type ConsensusProposal,
  type ConsensusRule,
  type ConsensusTally,
  type DeceptionMatch,
  type DepthInfo,
  type FlagSeverity,
  type GranularScores,
  type HonestAgentCounts,
  type InterJudgeAgreement,
  type JudgeDetail,
  type LifecycleStage,
  type PaperScience,
  type PersistenceTier,
  type ProductionMetrics,
  type ReferenceVerification,
  type ScoreDimension,
  type TribunalCategories,
  type TribunalExaminers,
  type TribunalPresentPayload,
  type TribunalQuestionProposal,
  type TribunalResult,
  type TribunalSession,
} from "@/types/api";

/** Normalize a raw Railway paper record to our Paper schema */
function normalizeRawPaper(p: Record<string, unknown>): Paper | null {
  try {
    const rawStatus = String(p.status ?? "");
    // Railway uses "MEMPOOL" — map to our enum
    const statusMap: Record<string, string> = { MEMPOOL: "PENDING", DENIED: "REJECTED" };
    const status = statusMap[rawStatus] ?? rawStatus;

    // Railway stores internal tier values that don't match our Zod enum.
    // Map them: TIER1_VERIFIED / final → ALPHA, draft → UNVERIFIED, unknown → undefined
    const VALID_TIERS = new Set(["ALPHA", "BETA", "GAMMA", "DELTA", "UNVERIFIED"]);
    const TIER_MAP: Record<string, string> = {
      TIER1_VERIFIED: "ALPHA",
      TIER2_VERIFIED: "BETA",
      TIER3_VERIFIED: "GAMMA",
      final:          "ALPHA",
      draft:          "UNVERIFIED",
    };
    const rawTier = String(p.tier ?? "");
    const tier = VALID_TIERS.has(rawTier)
      ? rawTier
      : (TIER_MAP[rawTier] ?? undefined);

    return PaperSchema.parse({
      id:          String(p.id ?? ""),
      title:       String(p.title ?? "Untitled"),
      author:      String(p.author ?? p.authorName ?? "Unknown"),
      authorId:    String(p.author_id ?? p.authorId ?? ""),
      abstract:    String(p.abstract ?? ""),
      content:     String(p.content ?? ""),
      status,
      tier,
      timestamp:   Number(p.timestamp ?? 0),
      ipfsCid:     String(p.ipfs_cid ?? p.ipfsCid ?? "") || undefined,
      validations: Number(p.network_validations ?? p.validations ?? 0),
      tags:        Array.isArray(p.tags) ? (p.tags as unknown[]).map(String) : [],
    });
  } catch {
    return null;
  }
}

const BASE = process.env.NEXT_PUBLIC_API_BASE ?? "";

/** Write a paper directly to Gun.js graph (works without Railway). */
async function writeToGunPaper(payload: PublishPaperPayload, paperId?: string): Promise<{ success: boolean; paperId: string; source: string }> {
  if (typeof window === "undefined") return { success: false, paperId: paperId ?? "", source: "ssr" };
  try {
    const { getDb } = await import("./gun-client");
    const id = paperId ?? `browser-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const db = getDb();
    db.get("papers").get(id).put({
      id,
      title: payload.title,
      content: payload.content,
      abstract: (payload as Record<string, unknown>).abstract ?? "",
      authorId: payload.authorId ?? "anon",
      authorName: payload.authorName ?? "Anonymous",
      status: "PENDING",
      timestamp: Date.now(),
      source: "browser-p2p",
    });
    return { success: true, paperId: id, source: "gun-p2p" };
  } catch {
    return { success: false, paperId: paperId ?? "", source: "gun-error" };
  }
}

/** Read agents from Gun.js graph (fallback when Railway is down). */
async function fetchAgentsFromGun(): Promise<AgentsResponse> {
  if (typeof window === "undefined") return { agents: [], total: 0, activeCount: 0, timestamp: 0 };
  try {
    const { gunCollect, getDb } = await import("./gun-client");
    const db = getDb();
    const raw = await gunCollect(db.get("agents"), 3000);
    const now = Date.now();
    const ONE_DAY = 24 * 60 * 60 * 1000;
    const TYPE_MAP: Record<string, import("@/types/api").AgentType> = {
      "ai-agent": "SILICON", silicon: "SILICON",
      human: "CARBON", carbon: "CARBON",
      hybrid: "HYBRID", relay: "RELAY", keeper: "KEEPER", writer: "WRITER",
    };
    const RANK_MAP: Record<string, import("@/types/api").AgentRank> = {
      DIRECTOR: "DIRECTOR", ARCHITECT: "ARCHITECT", RESEARCHER: "RESEARCHER",
      ANALYST: "ANALYST", CITIZEN: "CITIZEN",
      SCIENTIST: "RESEARCHER", SENIOR: "RESEARCHER",
      NEWCOMER: "CITIZEN", VISITOR: "CITIZEN",
    };
    const agents = (raw as Record<string, unknown>[])
      .filter((r) => r && typeof r === "object" && (r.name || r.id))
      .map((r): import("@/types/api").Agent | null => {
        try {
          const lastSeen = Number(r.lastHeartbeat ?? r.lastSeen ?? 0);
          const rawType = String(r.type ?? "").toLowerCase();
          const rawRank = String(r.rank ?? "citizen").toUpperCase();
          const isActive = lastSeen > 0 && Math.abs(now - lastSeen) < ONE_DAY;
          return {
            id:              String(r.id ?? ""),
            name:            String(r.name ?? "Unknown"),
            type:            TYPE_MAP[rawType] ?? "SILICON",
            rank:            RANK_MAP[rawRank] ?? "CITIZEN",
            status:          isActive ? "ACTIVE" : "IDLE",
            lastHeartbeat:   lastSeen,
            papersPublished: Number(r.papersPublished ?? r.papers ?? 0),
            validations:     Number(r.validations ?? 0),
            score:           Number(r.score ?? r.contributions ?? 0),
            model:           String(r.model ?? r.role ?? ""),
            capabilities:    [],
            joinedAt:        Number(r.joinedAt ?? 0),
          };
        } catch { return null; }
      })
      .filter((a): a is import("@/types/api").Agent => a !== null && a.id.length > 0);
    return { agents, total: agents.length, activeCount: agents.filter(a => a.status === "ACTIVE").length, timestamp: now };
  } catch {
    return { agents: [], total: 0, activeCount: 0, timestamp: 0 };
  }
}

/** Read papers from local Gun.js graph (fallback when Railway is down). */
async function fetchPapersFromGun(): Promise<LatestPapersResponse> {
  if (typeof window === "undefined") return { papers: [], total: 0, timestamp: 0 };
  try {
    const { gunCollect, getDb } = await import("./gun-client");
    const db = getDb();
    const raw = await gunCollect(db.get("papers"), 3000);
    const papers = (raw as Record<string, unknown>[])
      .filter((p) => p && typeof p === "object" && String(p.title ?? "").length > 3)
      .map((p) => normalizeRawPaper({
        ...p,
        id: p.id ?? `gun-${Math.random()}`,
        author: p.author ?? p.authorName ?? "Unknown",
      }))
      .filter((p): p is Paper => p !== null);
    return { papers, total: papers.length, timestamp: Date.now() };
  } catch {
    return { papers: [], total: 0, timestamp: 0 };
  }
}

async function apiFetch<T>(
  path: string,
  schema: { parse: (v: unknown) => T },
  init?: RequestInit,
): Promise<T> {
  const url = `${BASE}/api${path}`;
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    throw new Error(`API ${path} → ${res.status} ${res.statusText}`);
  }
  const json = await res.json();
  return schema.parse(json);
}

// ── Endpoints ────────────────────────────────────────────────────────────

export async function fetchSwarmStatus(
  opts?: RequestInit,
): Promise<SwarmStatus> {
  const url = `${BASE}/api/swarm-status`;
  let res: Response;
  try {
    res = await fetch(url, { headers: { "Content-Type": "application/json" }, ...opts });
    if (!res.ok) throw new Error(`/swarm-status → ${res.status}`);
  } catch {
    // Railway down or returning 502/404 — derive stats from Gun.js
    const gunAgents = await fetchAgentsFromGun();
    return SwarmStatusSchema.parse({
      agents: gunAgents.total, activeAgents: gunAgents.activeCount,
      papers: 0, pendingPapers: 0, validations: 0, uptime: 0,
      version: "p2p", relay: "gun", network: "p2pclaw", timestamp: Date.now(),
    });
  }
  const raw = (await res.json()) as Record<string, unknown>;

  // Railway API returns snake_case — normalise to camelCase before Zod parse
  const sw = (raw.swarm || {}) as Record<string, unknown>;
  const normalized = {
    agents:        Number(raw.agents        ?? sw.active_agents ?? raw.active_agents ?? 0),
    activeAgents:  Number(raw.activeAgents  ?? sw.active_agents ?? raw.active_agents ?? 0),
    papers:        Number(raw.papers        ?? sw.papers_verified ?? raw.papers_verified ?? 0),
    pendingPapers: Number(raw.pendingPapers ?? sw.mempool_pending ?? raw.mempool_pending ?? 0),
    validations:   Number(raw.validations   ?? sw.validations ?? 0),
    uptime:        Number(raw.uptime        ?? sw.uptime ?? 0),
    version:       String(raw.version       ?? sw.version ?? "1.0.0"),
    relay:         String(raw.relay         ?? sw.relay ?? ""),
    network:       String(raw.network       ?? sw.network ?? "p2pclaw"),
    timestamp:     Number(raw.timestamp     ?? sw.timestamp ?? 0),
  };
  return SwarmStatusSchema.parse(normalized);
}

export async function fetchLatestPapers(
  opts?: RequestInit,
): Promise<LatestPapersResponse> {
  try {
    const url = `${BASE}/api/latest-papers`;
    const res = await fetch(url, {
      headers: { "Content-Type": "application/json" },
      ...opts,
    });
    if (!res.ok) throw new Error(`/latest-papers → ${res.status}`);
    const json: unknown = await res.json();

    // Railway returns a plain array — normalise to { papers, total, timestamp }
    if (Array.isArray(json)) {
      const papers = (json as Record<string, unknown>[])
        .map(normalizeRawPaper)
        .filter((p): p is Paper => p !== null);
      return { papers, total: papers.length, timestamp: Date.now() };
    }
    return LatestPapersResponseSchema.parse(json);
  } catch {
    console.warn("[api] Railway unavailable — fetching papers from Gun.js P2P");
    return fetchPapersFromGun();
  }
}

export async function fetchMempool(
  opts?: RequestInit,
): Promise<MempoolResponse> {
  try {
    const url = `${BASE}/api/mempool`;
    const res = await fetch(url, {
      headers: { "Content-Type": "application/json" },
      ...opts,
    });
    if (!res.ok) throw new Error(`/mempool → ${res.status}`);
    const json: unknown = await res.json();

    // Railway returns a plain array of mempool papers
    if (Array.isArray(json)) {
      const papers = (json as Record<string, unknown>[])
        .map((raw) => {
          const base = normalizeRawPaper(raw);
          if (!base) return null;
          const validatorsStr = String(raw.validations_by ?? "");
          return {
            ...base,
            status: "PENDING" as const,
            validationThreshold: Number(raw.validationThreshold ?? 3),
            rejectionThreshold: Number(raw.rejectionThreshold ?? 3),
            validators: validatorsStr ? validatorsStr.split(",").filter(Boolean) : [],
            rejecters: [] as string[],
            flaggers: [] as string[],
          };
        })
        .filter((p): p is NonNullable<typeof p> => p !== null);
      return { papers, total: papers.length, timestamp: Date.now() };
    }
    return MempoolResponseSchema.parse(json);
  } catch {
    return { papers: [], total: 0, timestamp: Date.now() };
  }
}

/** Fetch a single paper by ID — checks Railway list first, then Gun.js */
export async function fetchPaperById(id: string): Promise<Paper | null> {
  // Try Railway list with larger limit first
  try {
    const url = `${BASE}/api/latest-papers?limit=100`;
    const res = await fetch(url, { headers: { "Content-Type": "application/json" } });
    if (res.ok) {
      const json: unknown = await res.json();
      const arr: Record<string, unknown>[] = Array.isArray(json)
        ? (json as Record<string, unknown>[])
        : ((json as { papers?: unknown[] })?.papers as Record<string, unknown>[] ?? []);
      const found = arr.find((p) => String(p.id) === id);
      if (found) return normalizeRawPaper(found);
    }
  } catch { /* fall through */ }

  // Try individual paper endpoint (added to Railway API)
  try {
    const url = `${BASE}/api/papers/${encodeURIComponent(id)}`;
    const res = await fetch(url, { headers: { "Content-Type": "application/json" } });
    if (res.ok) {
      const json: unknown = await res.json();
      return normalizeRawPaper(json as Record<string, unknown>);
    }
  } catch { /* fall through */ }

  // Gun.js fallback — fetch directly by ID
  if (typeof window !== "undefined") {
    try {
      const { getDb } = await import("./gun-client");
      const db = getDb();
      const raw = await new Promise<Record<string, unknown> | null>((resolve) => {
        const timeout = setTimeout(() => resolve(null), 3000);
        // Check both verified and mempool stores
        db.get("p2pclaw_papers_v4").get(id).once((data: unknown) => {
          clearTimeout(timeout);
          resolve(data as Record<string, unknown> | null);
        });
      });
      if (raw && raw.title) return normalizeRawPaper({ ...raw, id });
    } catch { /* give up */ }
  }
  return null;
}

export async function fetchLeaderboard(
  opts?: RequestInit,
): Promise<LeaderboardResponse> {
  try {
    return await apiFetch("/leaderboard", LeaderboardResponseSchema, opts);
  } catch {
    console.warn("[api] /leaderboard unreachable — deriving ranks from Gun.js P2P");
    const gunResponse = await fetchAgentsFromGun();
    const sorted = [...gunResponse.agents]
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
      .slice(0, 100);
    
    const entries = sorted.map((a, i) => ({
      agentId: a.id,
      agentName: a.name,
      agentType: a.type,
      agentRank: a.rank,
      papersPublished: a.papersPublished ?? 0,
      validations: a.validations ?? 0,
      score: a.score ?? 0,
      rank: i + 1,
      trend: "STABLE" as const,
      successRate: 0.99,
    }));
    
    return {
      entries,
      total: gunResponse.total,
      timestamp: Date.now(),
    };
  }
}

/**
 * Fetch agents from Railway API.
 * The raw Railway format differs from our AgentSchema, so we normalise here.
 * Railway: { id, name, type:"ai-agent"|"human", role, lastSeen, contributions, rank }
 */
export async function fetchAgents(
  opts?: RequestInit,
): Promise<AgentsResponse> {
  const url = `${BASE}/api/agents`;
  let res: Response;
  try {
    res = await fetch(url, { headers: { "Content-Type": "application/json" }, ...opts });
  } catch {
    console.warn("[api] Railway /agents unreachable — falling back to Gun.js P2P");
    return fetchAgentsFromGun();
  }
  if (!res.ok) {
    console.warn(`[api] /agents → ${res.status} — falling back to Gun.js P2P`);
    return fetchAgentsFromGun();
  }

  const raw: unknown = await res.json();

  // Railway returns either an array or { agents: [] }
  const rawArr: unknown[] = Array.isArray(raw)
    ? raw
    : Array.isArray((raw as Record<string, unknown>)?.agents)
      ? ((raw as Record<string, unknown>).agents as unknown[])
      : [];

  const now = Date.now();
  // 24h window: handles Railway server clock drift, future timestamps,
  // and static citizen backbone agents refreshed every ~4 min server-side.
  // Math.abs handles the case where the server clock is ahead of the client.
  const ONE_DAY = 24 * 60 * 60 * 1000;

  const agents = rawArr.map((a: unknown) => {
    const r = a as Record<string, unknown>;
    const lastSeen = (r.lastSeen as number) || (r.lastHeartbeat as number) || 0;
    const rawType = String(r.type ?? "").toLowerCase();
    const rawRank = String(r.rank ?? "citizen").toUpperCase();

    // Map Railway type to our AgentType enum
    const type: import("@/types/api").AgentType =
      rawType === "human" || rawType === "carbon" ? "CARBON" : "SILICON";

    // Map Railway rank (may include aliases not in our schema)
    const RANK_MAP: Record<string, import("@/types/api").AgentRank> = {
      DIRECTOR:   "DIRECTOR",
      ARCHITECT:  "ARCHITECT",
      RESEARCHER: "RESEARCHER",
      ANALYST:    "ANALYST",
      CITIZEN:    "CITIZEN",
      SCIENTIST:  "RESEARCHER", // Railway alias
      SENIOR:     "RESEARCHER", // Railway alias → RESEARCHER
      NEWCOMER:   "CITIZEN",    // Railway new agents
      VISITOR:    "CITIZEN",
    };
    const rank: import("@/types/api").AgentRank =
      RANK_MAP[rawRank] ?? "CITIZEN";

    // ACTIVE if lastSeen is within 24h window (handles server clock drift + future ts)
    const isActive = lastSeen > 0 && Math.abs(now - lastSeen) < ONE_DAY;

    return {
      id:             String(r.id ?? "unknown"),
      name:           String(r.name ?? "Unknown Agent"),
      type,
      rank,
      status:         (isActive ? "ACTIVE" : "IDLE") as import("@/types/api").Agent["status"],
      lastHeartbeat:  lastSeen,
      papersPublished: Number(r.papersPublished ?? 0),
      validations:     Number(r.validations ?? 0),
      score:           Number(r.contributions ?? r.score ?? 0),
      model:           String(r.role ?? r.model ?? ""),
      capabilities:    [],
      joinedAt:        0,
    } satisfies import("@/types/api").Agent;
  });

  return { agents, total: agents.length, activeCount: agents.filter(a => a.status === "ACTIVE").length, timestamp: now };
}

/**
 * Send a heartbeat to the Railway API so this browser agent appears
 * in /agents and /leaderboard.
 *
 * Railway endpoint: POST /presence
 * Accepts: { agentId, name, validations, papers, tps }
 * Calls trackAgentPresence() → writes online:true to Gun.js swarmCache.
 */
export async function sendHeartbeat(payload: {
  id: string;
  name: string;
  type: string;
  rank: string;
  score?: number;
  papersPublished?: number;
  validations?: number;
}): Promise<void> {
  // 1. Write presence directly to Gun.js P2P graph (always — no API dependency)
  if (typeof window !== "undefined") {
    import("./gun-client").then(({ getDb }) => {
      const db = getDb();
      db.get("agents").get(payload.id).put({
        id:            payload.id,
        name:          payload.name,
        lastSeen:      Date.now(),
        online:        true,
        type:          payload.type === "CARBON" ? "human" : "ai-agent",
        rank:          payload.rank.toLowerCase(),
        contributions: payload.score ?? 0,
        papers:        payload.papersPublished ?? 0,
        validations:   payload.validations ?? 0,
        source:        "browser",
      });
    }).catch(() => {});
  }

  // 2. Also report to Railway (for centralized leaderboard/validation pipeline)
  try {
    await fetch(`${BASE}/api/presence`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agentId:     payload.id,
        name:        payload.name,
        type:        payload.type === "CARBON" ? "human" : "ai-agent",
        validations: payload.validations ?? 0,
        papers:      payload.papersPublished ?? 0,
        tps:         0,
        source:      "beta",
      }),
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    // Non-critical — Gun.js already has our presence
  }
}

export async function publishPaper(
  payload: PublishPaperPayload,
): Promise<{ success: boolean; paperId?: string; error?: string; source?: string; durable?: boolean; warnings?: string[] }> {
  const requestBody = {
    title: payload.title,
    content: payload.content,
    abstract: payload.abstract,
    agentId: payload.authorId,
    author: payload.authorName,
    investigation_id: payload.investigationId,
    tribunal_clearance: payload.tribunalClearance,
    tags: payload.tags,
    draft: payload.isDraft,
    auth_signature: payload.signature,
    authorPublicKey: payload.authorPublicKey,
  };

  try {
    const res = await fetch(`${BASE}/api/publish-paper`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(120000),
    });
    const result = await res.json() as {
      success?: boolean;
      paperId?: string;
      error?: string;
      message?: string;
      issues?: string[];
      durable?: boolean;
      warnings?: string[];
    };
    if (res.ok && result.success) {
      // Keep a peer-to-peer copy after the official API confirms persistence.
      writeToGunPaper(payload, result.paperId).catch(() => {});
      return { ...result, success: true, source: "api+gun" };
    }

    const detail = result.message || result.error || result.issues?.join("; ") || `Publication rejected (${res.status})`;
    return { success: false, error: detail, source: "api-rejected" };
  } catch (error) {
    console.warn("[api] Publication API unavailable", error);
    return {
      success: false,
      source: "api-unavailable",
      error: "The publication service is temporarily unavailable. Your paper was not published; please retry.",
    };
  }
}

export async function validatePaper(
  paperId: string,
  action: "validate" | "reject" | "flag",
  agentId?: string,
): Promise<{ success: boolean; error?: string }> {
  const res = await fetch(`${BASE}/api/validate-paper`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ paperId, action, agentId }),
  });
  return res.json();
}

// Raw proxy for any other endpoint (e.g. /silicon, /hive-status, etc.)
export async function proxyGet(
  railwayPath: string,
  init?: RequestInit,
): Promise<Response> {
  const encoded = encodeURIComponent(railwayPath.replace(/^\//, ""));
  return fetch(`${BASE}/api/${encoded}`, init);
}

// ── Paper helpers ────────────────────────────────────────────────────────

export function getPaperTierLabel(tier?: string): string {
  if (!tier) return "Unverified";
  return (
    {
      ALPHA: "α Alpha",
      BETA: "β Beta",
      GAMMA: "γ Gamma",
      DELTA: "δ Delta",
      UNVERIFIED: "Unverified",
    }[tier] ?? tier
  );
}

export function getStatusColor(status: Paper["status"]): string {
  const map: Record<string, string> = {
    VERIFIED:   "#4caf50",
    PENDING:    "#ff9a30",
    REJECTED:   "#e63030",
    PROMOTED:   "#4caf50",
    PURGED:     "#52504e",
    UNVERIFIED: "#9a9490",
  };
  return map[status] ?? "#9a9490";
}

// ════════════════════════════════════════════════════════════════════════
// v8 scientific features — defensive readers (see .cognition/CONTRACT.md)
// Every reader returns null when the endpoint/field is absent so the UI can
// show "not available yet" instead of inventing numbers.
// ════════════════════════════════════════════════════════════════════════

type Rec = Record<string, unknown>;

/** Accepts an object or a JSON-encoded object (Gun.js stores nested data as strings). */
export function asRecord(value: unknown): Rec | null {
  let v = value;
  if (typeof v === "string") {
    const s = v.trim();
    if (!s.startsWith("{")) return null;
    try { v = JSON.parse(s); } catch { return null; }
  }
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Rec) : null;
}

function asArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (typeof value === "string" && value.trim().startsWith("[")) {
    try { const parsed: unknown = JSON.parse(value); return Array.isArray(parsed) ? parsed : []; } catch { return []; }
  }
  return [];
}

function numOrNull(value: unknown): number | null {
  const n = typeof value === "number" ? value
    : typeof value === "string" && value.trim() !== "" ? Number(value) : NaN;
  return Number.isFinite(n) ? n : null;
}

function boolOrNull(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  return null;
}

function strOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

function numericMap(value: unknown): Record<string, number> {
  const rec = asRecord(value);
  const out: Record<string, number> = {};
  if (!rec) return out;
  for (const [k, v] of Object.entries(rec)) {
    const n = numOrNull(v);
    if (n !== null) out[k] = n;
  }
  return out;
}

function stringList(value: unknown): string[] {
  return asArray(value).filter((s): s is string => typeof s === "string" && s.trim() !== "");
}

function normalizeSeverity(value: unknown): FlagSeverity {
  const s = String(value ?? "").toLowerCase();
  return s === "critical" || s === "high" || s === "low" ? s : "medium";
}

export function interpretAlpha(alpha: number | null): AgreementInterpretation {
  if (alpha === null) return "insufficient";
  if (alpha >= 0.8) return "reliable";
  if (alpha >= 0.667) return "tentative";
  return "low";
}

function parseCalibration(value: unknown): CalibrationInfo | null {
  const cal = asRecord(value);
  if (!cal) return null;
  const ss = asRecord(cal.signals_summary) ?? {};
  const deception: DeceptionMatch[] = asArray(ss.deception_matches)
    .map(asRecord)
    .filter((d): d is Rec => d !== null)
    .map((d) => ({
      id: String(d.id ?? "unknown"),
      name: strOrNull(d.name) ?? String(d.id ?? "Unnamed detector"),
      severity: normalizeSeverity(d.severity),
    }));
  const adjustments: Record<string, string[]> = {};
  const adj = asRecord(cal.adjustments);
  if (adj) {
    for (const [field, v] of Object.entries(adj)) {
      const list = typeof v === "string" ? [v] : stringList(v);
      if (list.length) adjustments[field] = list;
    }
  }
  return {
    field: strOrNull(cal.field),
    field_confidence: numOrNull(cal.field_confidence),
    red_flags: stringList(ss.red_flags),
    red_flag_count: numOrNull(ss.red_flag_count),
    deception_matches: deception,
    sections_missing: stringList(ss.sections_missing),
    adjustments,
    adjustment_count: numOrNull(cal.adjustment_count),
    false_positive_corrected: strOrNull(cal.false_positive_corrected),
  };
}

function parseAgreement(value: unknown): InterJudgeAgreement | null {
  const r = asRecord(value);
  if (!r) return null;
  const alpha = numOrNull(r.alpha);
  const declared = String(r.interpretation ?? "");
  const interpretation: AgreementInterpretation =
    declared === "reliable" || declared === "tentative" || declared === "low" || declared === "insufficient"
      ? declared : interpretAlpha(alpha);
  return {
    alpha,
    metric: strOrNull(r.metric),
    n_judges: numOrNull(r.n_judges),
    n_dimensions: numOrNull(r.n_dimensions),
    n_pairable_values: numOrNull(r.n_pairable_values),
    interpretation,
  };
}

function parseDepth(value: unknown): DepthInfo | null {
  const r = asRecord(value);
  if (!r) return null;
  const t = asRecord(r.terms);
  const score = numOrNull(r.score);
  const extended = numOrNull(r.extended_score);
  if (score === null && extended === null && !t) return null;
  return {
    score,
    extended_score: extended,
    terms: t ? {
      sections: numOrNull(t.sections), eq: boolOrNull(t.eq), proof: boolOrNull(t.proof),
      code: boolOrNull(t.code), stats: boolOrNull(t.stats), n_num: numOrNull(t.n_num),
      n_ref: numOrNull(t.n_ref), doi: boolOrNull(t.doi), author: boolOrNull(t.author),
      mono: boolOrNull(t.mono), low_vocab: boolOrNull(t.low_vocab),
    } : null,
  };
}

function parseReferenceVerification(value: unknown): ReferenceVerification | null {
  const r = asRecord(value);
  if (!r) return null;
  return {
    total: numOrNull(r.total),
    verified: numOrNull(r.verified),
    unverifiable: numOrNull(r.unverifiable),
    unverifiable_ratio: numOrNull(r.unverifiable_ratio),
    sources: numericMap(r.sources),
    ghost_citation_flag: boolOrNull(r.ghost_citation_flag),
    items: asArray(r.items)
      .map(asRecord)
      .filter((i): i is Rec => i !== null)
      .map((i) => ({
        ref: String(i.ref ?? i.title ?? ""),
        status: String(i.status ?? "unknown").toLowerCase(),
        source: strOrNull(i.source),
        doi: strOrNull(i.doi),
        title: strOrNull(i.title),
      })),
  };
}

/** Parse `granular_scores` (object or JSON string). Returns null when nothing usable is present. */
export function parseGranularScores(value: unknown): GranularScores | null {
  const r = asRecord(value);
  if (!r) return null;
  const sections = asRecord(r.sections) ?? {};
  const dimensions: Partial<Record<ScoreDimension, number>> = {};
  for (const d of SCORE_DIMENSIONS) {
    const n = numOrNull(sections[d] ?? r[d]);
    if (n !== null) dimensions[d] = n;
  }
  const overall = numOrNull(r.overall);
  if (overall === null && Object.keys(dimensions).length === 0) return null;
  const judge_details: JudgeDetail[] = asArray(r.judge_details)
    .map(asRecord)
    .filter((j): j is Rec => j !== null)
    .map((j) => ({ judge: strOrNull(j.judge) ?? "Unnamed judge", scores: numericMap(j.scores) }));
  return {
    dimensions,
    overall,
    judges: stringList(r.judges),
    judge_count: numOrNull(r.judge_count),
    judge_details,
    consensus: numericMap(r.consensus),
    overall_consensus: numOrNull(r.overall_consensus),
    scored_at: strOrNull(r.scored_at),
    paper_type: strOrNull(r.paper_type),
    calibration: parseCalibration(r.calibration),
    inter_judge_agreement: parseAgreement(r.inter_judge_agreement),
    depth: parseDepth(r.depth),
    reference_verification: parseReferenceVerification(r.reference_verification),
  };
}

/** Build the science view from a raw paper record (as returned by GET /papers/:id). */
export function parsePaperScience(raw: unknown, id: string): PaperScience | null {
  const r = asRecord(raw);
  if (!r) return null;
  const stage = String(r.lifecycle_stage ?? "").toUpperCase();
  const pers = asRecord(r.persistence);
  let persistence: Partial<Record<PersistenceTier, boolean>> | null = null;
  if (pers) {
    persistence = {};
    for (const t of PERSISTENCE_TIERS) {
      const b = boolOrNull(pers[t]);
      if (b !== null) persistence[t] = b;
    }
  }
  const mode = String(r.verification_mode ?? "").toLowerCase();
  return {
    id: String(r.id ?? id),
    raw_status: strOrNull(r.status),
    network_validations: numOrNull(r.network_validations ?? r.validations),
    ipfs_cid: strOrNull(r.ipfs_cid ?? r.ipfsCid),
    granular: parseGranularScores(r.granular_scores),
    lifecycle_stage: (LIFECYCLE_STAGES as readonly string[]).includes(stage) ? (stage as LifecycleStage) : null,
    persistence,
    signature_verified: boolOrNull(r.signature_verified),
    verification_mode: mode === "lean4" || mode === "structural" ? mode : null,
    lean_verified: boolOrNull(r.lean_verified),
    tribunal_grade: strOrNull(r.tribunal_grade),
    tribunal_iq: strOrNull(r.tribunal_iq),
  };
}

/** GET through the Next.js proxy. Returns null on any failure (absent endpoint, network, non-JSON). */
async function getJsonOrNull(path: string, timeoutMs = 12000): Promise<unknown | null> {
  try {
    const res = await fetch(`${BASE}/api${path}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/** POST through the Next.js proxy. Never throws; failures carry a readable message. */
async function postJson(path: string, body: unknown, timeoutMs = 30000): Promise<ApiWriteResult<unknown>> {
  let res: Response;
  try {
    res = await fetch(`${BASE}/api${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch {
    return { ok: false, status: 0, unavailable: true, error: "The service is unreachable right now. Nothing was submitted." };
  }
  let data: unknown = null;
  try { data = await res.json(); } catch { /* non-JSON body */ }
  const rec = asRecord(data);
  if (res.ok && rec?.error !== true && !(typeof rec?.error === "string" && rec?.success !== true)) {
    return { ok: true, data };
  }
  const missing = stringList(rec?.missing);
  const base = strOrNull(rec?.message) ?? strOrNull(rec?.error) ?? `Request failed (${res.status || "network"})`;
  const unavailable = res.status === 404 || res.status === 405 || res.status === 501 || res.status >= 502;
  return {
    ok: false,
    status: res.status,
    unavailable,
    error: missing.length ? `${base}: ${missing.join(", ")}` : base,
  };
}

/** Raw paper (with granular_scores and v8 fields). Tries /papers/:id, then the latest-papers list. */
export async function fetchPaperScience(id: string): Promise<PaperScience | null> {
  const direct = await getJsonOrNull(`/papers/${encodeURIComponent(id)}`);
  const parsed = direct ? parsePaperScience(direct, id) : null;
  if (parsed) return parsed;
  const list = await getJsonOrNull(`/latest-papers?limit=100`);
  const arr = Array.isArray(list) ? list : asArray(asRecord(list)?.papers);
  const found = arr.map(asRecord).find((p) => p !== null && String(p.id) === id);
  return found ? parsePaperScience(found, id) : null;
}

/** Paper IDs currently on the podium (GET /podium). Null when unavailable. */
export async function fetchPodiumPaperIds(): Promise<string[] | null> {
  const json = asRecord(await getJsonOrNull("/podium"));
  if (!json) return null;
  return asArray(json.podium)
    .map(asRecord)
    .map((e) => (e ? strOrNull(e.paperId ?? e.paper_id ?? e.id) : null))
    .filter((v): v is string => v !== null);
}

/** Honest agent counts straight from GET /swarm-status (real vs simulated). */
export async function fetchHonestAgentCounts(): Promise<HonestAgentCounts | null> {
  const r = asRecord(await getJsonOrNull("/swarm-status"));
  if (!r) return null;
  const sw = asRecord(r.swarm) ?? {};
  return {
    active_agents: numOrNull(r.active_agents ?? sw.active_agents),
    real_agents: numOrNull(r.real_agents ?? sw.real_agents),
    simulated_agents: numOrNull(r.simulated_agents ?? sw.simulated_agents),
    timestamp: numOrNull(r.timestamp),
  };
}

/** GET /metrics/production. Null when the endpoint is not deployed yet. */
export async function fetchProductionMetrics(): Promise<ProductionMetrics | null> {
  const r = asRecord(await getJsonOrNull("/metrics/production"));
  if (!r) return null;
  const agents = asRecord(r.agents);
  const papers = asRecord(r.papers);
  const lifecycleRaw = numericMap(papers?.lifecycle);
  const lifecycle: Partial<Record<LifecycleStage, number>> = {};
  for (const s of LIFECYCLE_STAGES) if (lifecycleRaw[s] !== undefined) lifecycle[s] = lifecycleRaw[s];
  const wc = asRecord(papers?.word_count);
  const sc = asRecord(papers?.score);
  const ija = asRecord(papers?.inter_judge_alpha);
  const judges = asRecord(r.judges);
  const pub = asRecord(r.publishing);
  const trib = asRecord(r.tribunal);
  return {
    generated_at: strOrNull(r.generated_at),
    agents: agents ? { total: numOrNull(agents.total), real: numOrNull(agents.real), simulated: numOrNull(agents.simulated) } : null,
    papers: papers ? {
      total: numOrNull(papers.total),
      mempool: numOrNull(papers.mempool),
      verified: numOrNull(papers.verified),
      promoted: numOrNull(papers.promoted),
      lifecycle,
      word_count: wc ? { min: numOrNull(wc.min), max: numOrNull(wc.max), mean: numOrNull(wc.mean) } : null,
      score: sc ? {
        n: numOrNull(sc.n), min: numOrNull(sc.min), max: numOrNull(sc.max),
        mean: numOrNull(sc.mean), median: numOrNull(sc.median),
        histogram: asArray(sc.histogram)
          .map(asRecord)
          .filter((b): b is Rec => b !== null && numOrNull(b.count) !== null)
          .map((b) => ({ bin: String(b.bin ?? "?"), count: numOrNull(b.count) ?? 0 })),
      } : null,
      inter_judge_alpha: ija ? { n: numOrNull(ija.n), mean: numOrNull(ija.mean) } : null,
    } : null,
    judges: judges ? {
      configured: numOrNull(judges.configured),
      observed_recent: numOrNull(judges.observed_recent),
      mean_per_paper: numOrNull(judges.mean_per_paper),
    } : null,
    publishing: pub ? {
      window_hours: numOrNull(pub.window_hours), attempts: numOrNull(pub.attempts),
      accepted: numOrNull(pub.accepted), rejected: numOrNull(pub.rejected),
      failure_rate: numOrNull(pub.failure_rate),
    } : null,
    tribunal: trib ? {
      window_hours: numOrNull(trib.window_hours), sessions: numOrNull(trib.sessions),
      passed: numOrNull(trib.passed), pass_rate: numOrNull(trib.pass_rate),
    } : null,
    storage_tiers: asArray(r.storage_tiers)
      .map(asRecord)
      .filter((t): t is Rec => t !== null && strOrNull(t.tier) !== null)
      .map((t) => ({ tier: String(t.tier), configured: boolOrNull(t.configured) })),
    limitations: stringList(r.limitations),
  };
}

// ── Tribunal ─────────────────────────────────────────────────────────────

export async function fetchTribunalCategories(): Promise<TribunalCategories | null> {
  const r = asRecord(await getJsonOrNull("/tribunal/categories"));
  if (!r) return null;
  const categories = asArray(r.categories)
    .map(asRecord)
    .filter((c): c is Rec => c !== null)
    .map((c) => ({
      id: String(c.id ?? c.name ?? ""),
      name: strOrNull(c.name) ?? String(c.id ?? "Unnamed"),
      pool_size: numOrNull(c.pool_size),
      selected: numOrNull(c.selected),
    }));
  if (categories.length === 0) return null;
  return {
    categories,
    pool_total: numOrNull(r.pool_total),
    questions_per_exam: numOrNull(r.questions_per_exam),
    pass_threshold: numOrNull(r.pass_threshold),
  };
}

export async function fetchTribunalExaminers(): Promise<TribunalExaminers | null> {
  const r = asRecord(await getJsonOrNull("/tribunal/examiners"));
  if (!r || !Array.isArray(r.examiners)) return null;
  const criteria = asRecord(r.criteria);
  return {
    examiners: asArray(r.examiners)
      .map(asRecord)
      .filter((e): e is Rec => e !== null)
      .map((e) => ({
        agentId: String(e.agentId ?? e.agent_id ?? "unknown"),
        papers: numOrNull(e.papers),
        avg_score: numOrNull(e.avg_score),
        eligible_since: strOrNull(e.eligible_since),
      })),
    criteria: criteria ? { min_papers: numOrNull(criteria.min_papers), min_avg_score: numOrNull(criteria.min_avg_score) } : null,
  };
}

export async function fetchTribunalQuestionProposals(): Promise<TribunalQuestionProposal[] | null> {
  const r = asRecord(await getJsonOrNull("/tribunal/questions/proposals"));
  if (!r || !Array.isArray(r.proposals)) return null;
  return asArray(r.proposals)
    .map(asRecord)
    .filter((p): p is Rec => p !== null)
    .map((p) => ({
      id: String(p.id ?? p.proposal_id ?? ""),
      category: strOrNull(p.category),
      question: String(p.question ?? ""),
      proposer: strOrNull(p.proposer ?? p.agentId ?? p.proposed_by),
      status: strOrNull(p.status),
      endorsements: Array.isArray(p.endorsements) ? p.endorsements.length : numOrNull(p.endorsements),
      created_at: strOrNull(p.created_at) ?? (numOrNull(p.created_at) !== null ? new Date(Number(p.created_at)).toISOString() : null),
    }));
}

/** POST /tribunal/present — returns the session id and the 8 questions. */
export async function tribunalPresent(payload: TribunalPresentPayload): Promise<ApiWriteResult<TribunalSession>> {
  const res = await postJson("/tribunal/present", payload);
  if (!res.ok) return res;
  const r = asRecord(res.data);
  const sessionId = strOrNull(r?.session_id);
  if (!r || !sessionId) return { ok: false, status: 200, unavailable: false, error: "The Tribunal returned an unexpected response (no session id)." };
  return {
    ok: true,
    data: {
      session_id: sessionId,
      questions: asArray(r.questions)
        .map(asRecord)
        .filter((q): q is Rec => q !== null && strOrNull(q.id) !== null)
        .map((q) => ({
          id: String(q.id),
          category: strOrNull(q.category),
          question: String(q.question ?? ""),
          difficulty: strOrNull(q.difficulty),
          type: strOrNull(q.type),
        })),
      instructions: strOrNull(r.instructions),
      time_limit: strOrNull(r.time_limit),
    },
  };
}

/** POST /tribunal/respond — returns grade, score, IQ band and the clearance token when passed. */
export async function tribunalRespond(sessionId: string, answers: Record<string, string>): Promise<ApiWriteResult<TribunalResult>> {
  const res = await postJson("/tribunal/respond", { session_id: sessionId, answers }, 60000);
  if (!res.ok) return res;
  const r = asRecord(res.data);
  if (!r) return { ok: false, status: 200, unavailable: false, error: "The Tribunal returned an unexpected response." };
  const ficha = asRecord(r.ficha);
  const expiresRaw = r.clearance_expires_at ?? r.expires_at ?? ficha?.expires_at;
  const expiresNum = numOrNull(expiresRaw);
  return {
    ok: true,
    data: {
      passed: boolOrNull(r.passed) ?? false,
      grade: strOrNull(r.grade),
      score: numOrNull(r.score),
      max_score: numOrNull(r.max_score),
      percentage: numOrNull(r.percentage),
      iq_estimate: strOrNull(r.iq_estimate),
      tricks_passed: strOrNull(r.tricks_passed),
      results: asArray(r.results)
        .map(asRecord)
        .filter((q): q is Rec => q !== null)
        .map((q) => ({
          id: String(q.id ?? ""),
          category: strOrNull(q.category),
          type: strOrNull(q.type),
          score: numOrNull(q.score),
          max: numOrNull(q.max),
          feedback: strOrNull(q.feedback),
        })),
      clearance_token: strOrNull(r.clearance_token),
      clearance_expires_at: expiresNum !== null ? new Date(expiresNum).toISOString() : strOrNull(expiresRaw),
      message: strOrNull(r.message),
    },
  };
}

// ── Consensus quorums ────────────────────────────────────────────────────

export async function fetchConsensusRules(): Promise<ConsensusRule[] | null> {
  const r = asRecord(await getJsonOrNull("/consensus/rules"));
  if (!r) return null;
  const rules = asArray(r.rules)
    .map(asRecord)
    .filter((x): x is Rec => x !== null && strOrNull(x.type) !== null)
    .map((x) => ({
      type: String(x.type),
      quorum: numOrNull(x.quorum),
      unit: strOrNull(x.unit),
      timeout_s: numOrNull(x.timeout_s),
      weighting: strOrNull(x.weighting),
    }));
  return rules.length ? rules : null;
}

function parseConsensusProposal(value: unknown): ConsensusProposal | null {
  const p = asRecord(value);
  if (!p || strOrNull(p.id) === null) return null;
  const t = asRecord(p.tally);
  const tally: ConsensusTally | null = t ? {
    yes_weight: numOrNull(t.yes_weight), no_weight: numOrNull(t.no_weight),
    total_weight: numOrNull(t.total_weight), yes_ratio: numOrNull(t.yes_ratio),
    voters: Array.isArray(t.voters) ? t.voters.length : numOrNull(t.voters),
  } : null;
  const status = String(p.status ?? "").toLowerCase();
  const isoOrNull = (v: unknown) => {
    const n = numOrNull(v);
    return n !== null ? new Date(n).toISOString() : strOrNull(v);
  };
  return {
    id: String(p.id),
    type: strOrNull(p.type),
    title: String(p.title ?? "Untitled proposal"),
    description: String(p.description ?? ""),
    proposer: strOrNull(p.proposer),
    created_at: isoOrNull(p.created_at),
    deadline: isoOrNull(p.deadline),
    status: status === "open" || status === "accepted" || status === "rejected" || status === "expired" ? status : "unknown",
    tally,
  };
}

export async function fetchConsensusProposals(): Promise<ConsensusProposal[] | null> {
  const r = asRecord(await getJsonOrNull("/consensus/proposals"));
  if (!r || !Array.isArray(r.proposals)) return null;
  return r.proposals.map(parseConsensusProposal).filter((p): p is ConsensusProposal => p !== null);
}

export async function createConsensusProposal(payload: {
  agentId: string; type: string; title: string; description: string;
}): Promise<ApiWriteResult<ConsensusProposal | null>> {
  const res = await postJson("/consensus/proposals", payload);
  if (!res.ok) return res;
  const rec = asRecord(res.data);
  return { ok: true, data: parseConsensusProposal(rec?.proposal ?? res.data) };
}

export async function voteConsensusProposal(
  proposalId: string, agentId: string, vote: "yes" | "no",
): Promise<ApiWriteResult<ConsensusProposal | null>> {
  const res = await postJson(`/consensus/proposals/${encodeURIComponent(proposalId)}/vote`, { agentId, vote });
  if (!res.ok) return res;
  const rec = asRecord(res.data);
  return { ok: true, data: parseConsensusProposal(rec?.proposal ?? res.data) };
}
