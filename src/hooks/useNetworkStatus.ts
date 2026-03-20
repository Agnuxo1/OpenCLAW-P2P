"use client";

import { useState, useEffect } from "react";
import { useGunContext } from "@/providers/GunProvider";
import { NODE_ACTIVE_WINDOW_MS } from "@/lib/peers";

export interface MeshStats {
  browserNodes: number;   // browser tabs acting as nodes right now
  serverNodes: number;    // dedicated server relay nodes
  totalPeers: number;
  isSupporting: boolean;  // is THIS browser relaying for others?
  nodeId: string;
  webrtcPeers: number;    // direct browser-to-browser connections
}

/**
 * Exposes live Antigravity mesh stats to any component.
 * Reads Gun.js p2pclaw/nodes path for active browser nodes.
 */
export function useNetworkStatus(): MeshStats {
  const { db, meshStats } = useGunContext();
  const [browserNodes, setBrowserNodes] = useState(0);

  useEffect(() => {
    if (!db) return;

    const cutoff = Date.now() - NODE_ACTIVE_WINDOW_MS;
    let count = 0;

    // Listen for browser node registrations in the mesh
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    db.get("p2pclaw").get("nodes").map().on((node: any) => {
      if (node?.type === "browser" && node?.joinedAt > cutoff) {
        count++;
        setBrowserNodes(count);
      }
    });

    return () => { count = 0; };
  }, [db]);

  return {
    browserNodes,
    serverNodes:  meshStats?.serverPeers ?? 0,
    totalPeers:   meshStats?.peersConnected ?? 0,
    isSupporting: meshStats?.isRelaying ?? false,
    nodeId:       meshStats?.nodeId ?? "",
    webrtcPeers:  meshStats?.webrtcPeers ?? 0,
  };
}
