/**
 * P2PCLAW API Client
 * Typed fetch wrappers that hit Next.js /api/* proxy routes (no CORS issues).
 * These are safe to use in both client and server components.
 */

import {
  SwarmStatusSchema,
  LatestPapersResponseSchema,
  MempoolResponseSchema,
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

/** Read papers from local Gun.js graph (fallback when Railway is down). */
async function fetchPapersFromGun(): Promise<LatestPapersResponse> {
  if (typeof window === "undefined") return { papers: [], total: 0 };
  try {
    const { gunCollect, getDb } = await import("./gun-client");
    const db = getDb();
    const raw = await gunCollect(db.get("papers"), 3000);
    const papers = (raw as Record<string, unknown>[])
      .filter((p) => p && typeof p === "object" && String(p.title ?? "").length > 3)
      .map((p) => ({
        id:          String(p.id ?? `gun-${Math.random()}`),
        title:       String(p.title ?? "Untitled"),
        abstract:    String(p.abstract ?? ""),
        content:     String(p.content ?? ""),
        authorId:    String(p.authorId ?? "unknown"),
        authorName:  String(p.authorName ?? "Unknown"),
        authorDid:   String(p.authorDid ?? ""),
        status:      "PENDING" as const,
        tier:        "UNVERIFIED" as const,
        verified:    false,
        timestamp:   Number(p.timestamp ?? 0),
        citations:   0,
      }));
    return { papers, total: papers.length };
  } catch {
    return { papers: [], total: 0 };
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
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  if (!res.ok) throw new Error(`/swarm-status → ${res.status}`);
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
    return await apiFetch("/latest-papers", LatestPapersResponseSchema, opts);
  } catch {
    // Railway unreachable — serve from local Gun.js P2P graph
    console.warn("[api] Railway unavailable — fetching papers from Gun.js P2P");
    return fetchPapersFromGun();
  }
}

export async function fetchMempool(
  opts?: RequestInit,
): Promise<MempoolResponse> {
  return apiFetch("/mempool", MempoolResponseSchema, opts);
}

export async function fetchLeaderboard(
  opts?: RequestInit,
): Promise<LeaderboardResponse> {
  return apiFetch("/leaderboard", LeaderboardResponseSchema, opts);
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
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  if (!res.ok) throw new Error(`/agents → ${res.status}`);

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
): Promise<{ success: boolean; paperId?: string; error?: string; source?: string }> {
  try {
    const res = await fetch(`${BASE}/api/publish-paper`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(20000),
    });
    const result = await res.json() as { success: boolean; paperId?: string; error?: string };
    if (res.ok && result.success) {
      // Dual-write: also store in Gun.js so paper survives Railway being down
      writeToGunPaper(payload, result.paperId).catch(() => {});
      return { ...result, source: "railway+gun" };
    }
    // Railway rejected (not unreachable) — still write to Gun.js as P2P fallback
    const gunResult = await writeToGunPaper(payload);
    return { success: gunResult.success, paperId: gunResult.paperId, source: "gun-p2p-fallback", error: result.error };
  } catch {
    // Railway unreachable — write directly to Gun.js P2P
    console.warn("[api] Railway unreachable — publishing directly to Gun.js P2P");
    const gunResult = await writeToGunPaper(payload);
    return { success: gunResult.success, paperId: gunResult.paperId, source: "gun-p2p-only" };
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
