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
  return apiFetch("/swarm-status", SwarmStatusSchema, opts);
}

export async function fetchLatestPapers(
  opts?: RequestInit,
): Promise<LatestPapersResponse> {
  return apiFetch("/latest-papers", LatestPapersResponseSchema, opts);
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
  const TWO_MIN = 2 * 60 * 1000;

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

    return {
      id:             String(r.id ?? "unknown"),
      name:           String(r.name ?? "Unknown Agent"),
      type,
      rank,
      status:         (now - lastSeen < TWO_MIN ? "ACTIVE" : "IDLE") as import("@/types/api").Agent["status"],
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
  try {
    await fetch(`${BASE}/api/presence`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agentId:    payload.id,        // Railway expects agentId (not id)
        name:       payload.name,
        type:       payload.type === "CARBON" ? "human" : "ai-agent",
        validations: payload.validations ?? 0,
        papers:     payload.papersPublished ?? 0,
        tps:        0,
        source:     "beta",
      }),
    });
  } catch {
    // best-effort — don't block UI
  }
}

export async function publishPaper(
  payload: PublishPaperPayload,
): Promise<{ success: boolean; paperId?: string; error?: string }> {
  const res = await fetch(`${BASE}/api/publish-paper`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return res.json();
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
