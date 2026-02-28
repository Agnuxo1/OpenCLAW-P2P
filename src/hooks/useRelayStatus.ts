"use client";

import { useEffect, useState } from "react";
import { PEERS } from "@/lib/gun-client";

export type PeerStatus = "online" | "offline" | "checking";

export interface RelayPeer {
  url: string;
  status: PeerStatus;
  latency: number | null;
}

async function pingPeer(url: string): Promise<{ online: boolean; latency: number }> {
  const start = Date.now();
  try {
    // Use AbortSignal with 4s timeout
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4_000);
    // Convert gun URL to HTTP health check
    const healthUrl = url.replace(/\/gun$/, "").replace(/^wss?:\/\//, "https://");
    const res = await fetch(healthUrl, {
      method: "HEAD",
      signal: controller.signal,
      mode: "no-cors",
    });
    clearTimeout(timer);
    return { online: true, latency: Date.now() - start };
  } catch {
    return { online: false, latency: Date.now() - start };
  }
}

export function useRelayStatus(refreshInterval = 30_000) {
  const [peers, setPeers] = useState<RelayPeer[]>(() =>
    PEERS.map((url) => ({ url, status: "checking" as PeerStatus, latency: null })),
  );

  useEffect(() => {
    let mounted = true;

    async function checkAll() {
      const results = await Promise.all(
        PEERS.map(async (url) => {
          const { online, latency } = await pingPeer(url);
          return {
            url,
            status: (online ? "online" : "offline") as PeerStatus,
            latency: online ? latency : null,
          };
        }),
      );
      if (mounted) setPeers(results);
    }

    checkAll();
    const interval = setInterval(checkAll, refreshInterval);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [refreshInterval]);

  const onlineCount = peers.filter((p) => p.status === "online").length;
  const primaryPeer = peers[0];

  return { peers, onlineCount, primaryPeer };
}
