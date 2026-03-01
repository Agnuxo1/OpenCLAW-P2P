"use client";

import { useEffect, useRef } from "react";
import { useAgentStore } from "@/store/agentStore";
import { sendHeartbeat } from "@/lib/api-client";

const HEARTBEAT_INTERVAL = 60_000; // 60s — matches www.p2pclaw.com cadence

/**
 * Dual-channel presence heartbeat:
 *  1. Gun.js top-level `agents` namespace  — visible to P2P peers in real-time
 *  2. Railway API `/register-agent`        — visible in /agents & /leaderboard
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
      const now = Date.now();

      // ── 1. Gun.js P2P write ──────────────────────────────────────────────
      if (!db) {
        try {
          const { getDb } = await import("@/lib/gun-client");
          db = getDb();
        } catch {
          // still on server somehow — skip Gun
        }
      }

      if (db) {
        db.get("agents")
          .get(id)
          .put({
            id,
            name,
            type,
            rank,
            status: "ACTIVE",
            online: true,          // ← Railway swarmCache requires this field
            lastHeartbeat: now,
            lastSeen: now,         // ← Railway reads lastSeen for recency
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

      // ── 2. Railway API heartbeat (best-effort, non-blocking) ─────────────
      // POST /presence → trackAgentPresence() → writes online:true to Gun.js
      await sendHeartbeat({ id, name, type, rank, score, papersPublished, validations });
    }

    beat(); // initial heartbeat on mount
    timerRef.current = setInterval(beat, HEARTBEAT_INTERVAL);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [id, name, rank, type, score, papersPublished, validations]);
}
