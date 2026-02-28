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

export async function fetchAgents(
  opts?: RequestInit,
): Promise<AgentsResponse> {
  return apiFetch("/agents", AgentsResponseSchema, opts);
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
