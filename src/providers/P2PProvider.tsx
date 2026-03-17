"use client";

/**
 * P2P Provider — v3 P2P subsystem initialization.
 * Boots Gun.js node, Service Worker, Helia (IPFS), and metric reporting
 * on the client side without blocking the React render tree.
 */

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

interface P2PContextValue {
  gunReady: boolean;
  heliaReady: boolean;
  swReady: boolean;
  nodeStats: {
    gunPeers: number;
    ipfsPeers: number;
    isContributing: boolean;
  };
}

const P2PContext = createContext<P2PContextValue>({
  gunReady: false,
  heliaReady: false,
  swReady: false,
  nodeStats: { gunPeers: 0, ipfsPeers: 0, isContributing: false },
});

export function P2PProvider({ children }: { children: ReactNode }) {
  const [gunReady, setGunReady] = useState(false);
  const [heliaReady, setHeliaReady] = useState(false);
  const [swReady, setSwReady] = useState(false);
  const [nodeStats, setNodeStats] = useState({ gunPeers: 0, ipfsPeers: 0, isContributing: false });

  useEffect(() => {
    let stopMetrics: (() => void) | null = null;
    let statsInterval: ReturnType<typeof setInterval> | null = null;

    // Phase 1: Gun.js node (synchronous after lazy import)
    import("@/lib/gun-client").then(({ initGunNode, getNodeStats }) => {
      initGunNode();
      setGunReady(true);

      // Poll node stats every 5 seconds
      statsInterval = setInterval(() => {
        const s = getNodeStats();
        setNodeStats({
          gunPeers: s.peersConnected,
          ipfsPeers: 0,
          isContributing: s.isContributing,
        });
      }, 5000);
    }).catch((e) => console.warn("[P2P] Gun init failed:", e));

    // Phase 2: Service Worker (non-blocking)
    import("@/lib/sw-manager").then(({ initServiceWorker }) => {
      initServiceWorker().then((reg) => {
        if (reg) setSwReady(true);
      });
    }).catch(() => {});

    // Phase 3: Helia IPFS node (async, non-blocking, lazy)
    const heliaTimer = setTimeout(() => {
      import("@/lib/helia-node").then(({ initHeliaNode, getHeliaStats }) => {
        initHeliaNode().then(async (helia) => {
          if (helia) {
            setHeliaReady(true);
            // Update ipfs peers in stats
            const hs = await getHeliaStats();
            setNodeStats((prev) => ({ ...prev, ipfsPeers: hs.peers }));
          }
        });
      }).catch(() => {});
    }, 3000); // Delay Helia 3s so Gun.js and UI initialize first

    // Phase 4: Swarm metrics reporting
    import("@/lib/swarm-metrics").then(({ startMetricReporting }) => {
      stopMetrics = startMetricReporting();
    }).catch(() => {});

    return () => {
      clearTimeout(heliaTimer);
      if (statsInterval) clearInterval(statsInterval);
      if (stopMetrics) stopMetrics();
    };
  }, []);

  return (
    <P2PContext.Provider value={{ gunReady, heliaReady, swReady, nodeStats }}>
      {children}
    </P2PContext.Provider>
  );
}

export function useP2P(): P2PContextValue {
  return useContext(P2PContext);
}
