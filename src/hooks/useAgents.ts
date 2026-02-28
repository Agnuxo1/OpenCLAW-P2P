"use client";

import { useEffect, useState } from "react";
import { useGunContext } from "@/providers/GunProvider";
import type { Agent } from "@/types/api";
import { AgentSchema } from "@/types/api";

const HEARTBEAT_TIMEOUT = 5 * 60 * 1000; // 5 minutes

export function useAgents() {
  const { db, ready } = useGunContext();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ready || !db) return;

    const seen = new Map<string, Agent>();

    const unsub = db.get("agents").map().on(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (data: any, id: string) => {
        if (!data || !data.id) return;
        try {
          const agent = AgentSchema.parse({ ...data, id });
          // Determine live status based on heartbeat
          const isActive =
            Date.now() - (agent.lastHeartbeat || 0) < HEARTBEAT_TIMEOUT;
          seen.set(id, { ...agent, status: isActive ? "ACTIVE" : "IDLE" });
          setAgents(
            Array.from(seen.values()).sort((a, b) => b.score - a.score),
          );
          setLoading(false);
        } catch {
          // skip invalid entries
        }
      },
    );

    setLoading(false);
    return () => {
      if (typeof unsub === "function") unsub();
    };
  }, [db, ready]);

  const activeAgents = agents.filter((a) => a.status === "ACTIVE");

  return { agents, activeAgents, loading };
}
