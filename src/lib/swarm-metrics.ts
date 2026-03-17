/**
 * Swarm metrics — CLIENT ONLY.
 * Collects browser node stats and reports anonymously to the API
 * so the dashboard can show live swarm health.
 */

import { getNodeStats } from "./gun-client";
import { getHeliaStats } from "./helia-node";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ?? "https://p2pclaw-api-production-df9f.up.railway.app";

export interface SwarmMetrics {
  timestamp: number;
  node_type: "browser";
  gun_peers: number;
  gun_data_served_bytes: number;
  gun_data_received_bytes: number;
  ipfs_peers: number;
  is_contributing: boolean;
  sw_active: boolean;
  online: boolean;
}

export async function collectAndReportMetrics(): Promise<SwarmMetrics | null> {
  if (typeof window === "undefined") return null;

  const gunStats = getNodeStats();
  const heliaStats = await getHeliaStats();

  const metrics: SwarmMetrics = {
    timestamp: Date.now(),
    node_type: "browser",
    gun_peers: gunStats.peersConnected,
    gun_data_served_bytes: gunStats.dataServed,
    gun_data_received_bytes: gunStats.dataReceived,
    ipfs_peers: heliaStats.peers,
    is_contributing: gunStats.isContributing,
    sw_active: !!(navigator.serviceWorker?.controller),
    online: navigator.onLine,
  };

  try {
    await fetch(`${API_BASE}/swarm-metrics`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(metrics),
      keepalive: true, // send even if tab is closing
    });
  } catch { /* non-critical */ }

  return metrics;
}

/** Start periodic metric reporting (every 5 minutes) */
export function startMetricReporting(): () => void {
  const interval = setInterval(() => {
    collectAndReportMetrics().catch(() => {});
  }, 5 * 60 * 1000);

  // Initial report after 30s
  const initial = setTimeout(() => {
    collectAndReportMetrics().catch(() => {});
  }, 30_000);

  return () => {
    clearInterval(interval);
    clearTimeout(initial);
  };
}
