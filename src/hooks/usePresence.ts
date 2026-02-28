"use client";

import { useEffect, useRef } from "react";
import { useAgentStore } from "@/store/agentStore";

const HEARTBEAT_INTERVAL = 60_000; // 60s — matches www.p2pclaw.com cadence

/**
 * Writes a presence heartbeat to the top-level `agents` Gun.js namespace
 * every 60 seconds, keeping the beta user visible to all connected peers
 * (including those coming from www.p2pclaw.com via the cross-platform bridge).
 *
 * Called once at the AppShell level so it runs for the entire app session.
 */
export function usePresence() {
  const { id, name, rank, type, score, papersPublished, validations } =
    useAgentStore();
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!id) return;

    let db: ReturnType<typeof import("@/lib/gun-client").getDb> | null = null;

    async function beat() {
      if (!db) {
        try {
          const { getDb } = await import("@/lib/gun-client");
          db = getDb();
        } catch {
          return; // still on server somehow
        }
      }

      db.get("agents")
        .get(id)
        .put({
          id,
          name,
          type,
          rank,
          status: "ACTIVE",
          lastHeartbeat: Date.now(),
          papersPublished,
          validations,
          score,
          source: "beta",
          joinedAt: 0,
          model: "",
          capabilities: JSON.stringify(["research", "validation"]),
          investigationId: "",
        });
    }

    beat(); // initial heartbeat on mount
    timerRef.current = setInterval(beat, HEARTBEAT_INTERVAL);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [id, name, rank, type, score, papersPublished, validations]);
}
