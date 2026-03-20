"use client";

import { useEffect, useState, useMemo } from "react";
import { useGunContext } from "@/providers/GunProvider";
import { useApiAgents } from "@/hooks/useApiAgents";
import type { Agent, AgentType, AgentRank } from "@/types/api";
import { AgentSchema } from "@/types/api";

// Gun.js: mark IDLE only if heartbeat is older than 5 min AND we have no fresher API data
const HEARTBEAT_TIMEOUT = 5 * 60 * 1000;

const GUN_TYPE_MAP: Record<string, AgentType> = {
  "ai-agent": "SILICON", silicon: "SILICON",
  human: "CARBON",      carbon: "CARBON",
  hybrid: "HYBRID",     relay: "RELAY",
  keeper: "KEEPER",     writer: "WRITER",
};
const GUN_RANK_MAP: Record<string, AgentRank> = {
  DIRECTOR: "DIRECTOR", ARCHITECT: "ARCHITECT", RESEARCHER: "RESEARCHER",
  ANALYST: "ANALYST",   CITIZEN: "CITIZEN",
  SCIENTIST: "RESEARCHER", SENIOR: "RESEARCHER",
  NEWCOMER: "CITIZEN",  VISITOR: "CITIZEN",
};

/**
 * Normalize a raw Gun.js agent record to our AgentSchema.
 * Gun.js uses snake_case / lowercase fields that differ from the Zod schema.
 * Returning null silently drops invalid/incomplete entries.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeGunAgent(data: any, id: string): Agent | null {
  try {
    const rawType  = String(data.type  ?? "").toLowerCase();
    const rawRank  = String(data.rank  ?? "citizen").toUpperCase();
    const lastHB   = Number(data.lastHeartbeat ?? data.lastSeen ?? 0);
    const isActive = lastHB > 0 && Date.now() - lastHB < HEARTBEAT_TIMEOUT;
    return AgentSchema.parse({
      id:              String(data.id ?? id),
      name:            String(data.name ?? "Unknown Agent"),
      type:            GUN_TYPE_MAP[rawType]  ?? "SILICON",
      rank:            GUN_RANK_MAP[rawRank]  ?? "CITIZEN",
      status:          isActive ? "ACTIVE" : "IDLE",
      lastHeartbeat:   lastHB,
      papersPublished: Number(data.papersPublished ?? data.papers ?? 0),
      validations:     Number(data.validations ?? 0),
      score:           Number(data.score ?? data.contributions ?? 0),
      model:           String(data.model ?? data.role ?? ""),
      capabilities:    [],
      joinedAt:        Number(data.joinedAt ?? 0),
    });
  } catch {
    return null;
  }
}

/**
 * Dual-source agent list:
 *  1. Railway API  — Silicon agents (openclaw-z, nebula, ds-theorist, citizens)
 *  2. Gun.js mesh  — P2P connected agents (beta users, www cross-bridge agents)
 *
 * Gun.js data wins over API data when both have the same ID (more real-time).
 */
export function useAgents() {
  const { db, ready } = useGunContext();
  const { data: apiData, isLoading: apiLoading } = useApiAgents();

  const [gunAgents, setGunAgents] = useState<Map<string, Agent>>(new Map());

  // ── Gun.js real-time subscription ─────────────────────────────────────
  useEffect(() => {
    if (!ready || !db) return;

    const seen = new Map<string, Agent>();

    const unsub = db.get("agents").map().on(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (data: any, id: string) => {
        if (!data || typeof data !== "object") return;
        const agent = normalizeGunAgent(data, id);
        if (agent) {
          seen.set(id, agent);
          setGunAgents(new Map(seen));
        }
      },
    );

    return () => {
      if (typeof unsub === "function") unsub();
    };
  }, [db, ready]);

  // ── Merge: API agents as base, Gun.js agents overlay ─────────────────
  const agents = useMemo(() => {
    const merged = new Map<string, Agent>();

    // 1. Seed with Railway API agents (Silicon backbone)
    for (const a of apiData?.agents ?? []) {
      merged.set(a.id, a);
    }

    // 2. Overlay Gun.js agents (real-time P2P)
    // Gun.js wins ONLY if its heartbeat is fresher than the API's data.
    // This prevents stale IndexedDB cache from downgrading ACTIVE → IDLE.
    for (const [id, a] of gunAgents) {
      const existing = merged.get(id);
      if (!existing || a.lastHeartbeat > (existing.lastHeartbeat ?? 0)) {
        merged.set(id, a);
      }
      // else: API data is fresher — keep it (guards against stale browser cache)
    }

    return Array.from(merged.values()).sort((a, b) => b.score - a.score);
  }, [apiData?.agents, gunAgents]);

  const activeAgents = useMemo(
    () => agents.filter((a) => a.status === "ACTIVE"),
    [agents],
  );

  // loading = true only while the API fetch is in flight AND we have no data yet
  // Gun.js is optional real-time overlay — never blocks the loading state
  const loading = apiLoading && agents.length === 0;

  return { agents, activeAgents, loading };
}
