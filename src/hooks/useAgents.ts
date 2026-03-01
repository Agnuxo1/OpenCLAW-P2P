"use client";

import { useEffect, useState, useMemo } from "react";
import { useGunContext } from "@/providers/GunProvider";
import { useApiAgents } from "@/hooks/useApiAgents";
import type { Agent } from "@/types/api";
import { AgentSchema } from "@/types/api";

const HEARTBEAT_TIMEOUT = 5 * 60 * 1000; // 5 min — mark as IDLE after this

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
        // Accept entries even without an `id` field (www bridge may omit it)
        const enriched = { ...data, id: data.id ?? id };
        try {
          const agent = AgentSchema.parse(enriched);
          const isActive = Date.now() - (agent.lastHeartbeat || 0) < HEARTBEAT_TIMEOUT;
          seen.set(id, { ...agent, status: isActive ? "ACTIVE" : "IDLE" });
          setGunAgents(new Map(seen));
        } catch {
          // skip invalid / incomplete Gun.js entries silently
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

    // 2. Overlay Gun.js agents (real-time P2P — wins on conflict)
    for (const [id, a] of gunAgents) {
      merged.set(id, a);
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
