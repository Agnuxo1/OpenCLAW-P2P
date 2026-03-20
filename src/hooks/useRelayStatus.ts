"use client";

import { useEffect, useState } from "react";
import { RELAY_HTTP_URLS } from "@/lib/peers";

export type PeerStatus = "online" | "offline" | "checking";

export interface RelayPeer {
  url: string;
  status: PeerStatus;
  latency: number | null;
}

/**
 * Pings a relay node via HTTP HEAD request.
 * RELAY_HTTP_URLS are already https:// — no wss→https conversion needed.
 * mode: no-cors means we get an opaque response (status 0) but no CORS error.
 * Any response (even opaque) means the server is alive.
 */
async function pingPeer(url: string): Promise<{ online: boolean; latency: number }> {
  const start = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5_000);
  try {
    await fetch(url, {
      method: "HEAD",
      signal: controller.signal,
      mode: "no-cors",
      cache: "no-store",
    });
    clearTimeout(timer);
    return { online: true, latency: Date.now() - start };
  } catch {
    clearTimeout(timer);
    return { online: false, latency: Date.now() - start };
  }
}

export function useRelayStatus(refreshInterval = 30_000) {
  const [peers, setPeers] = useState<RelayPeer[]>(() =>
    RELAY_HTTP_URLS.map((url) => ({ url, status: "checking" as PeerStatus, latency: null })),
  );

  useEffect(() => {
    let mounted = true;

    async function checkAll() {
      const results = await Promise.all(
        RELAY_HTTP_URLS.map(async (url) => {
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
