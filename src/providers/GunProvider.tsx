"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  type ReactNode,
} from "react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type GunDB = any;

/** Live stats about this browser's role in the Antigravity mesh */
export interface MeshStats {
  peersConnected: number;
  isRelaying: boolean;
  bytesRelayed: number;
  webrtcPeers: number;
  serverPeers: number;
  nodeId: string;
}

interface GunContextValue {
  db: GunDB | null;
  ready: boolean;
  meshStats: MeshStats | null;
}

const DEFAULT_STATS: MeshStats = {
  peersConnected: 0, isRelaying: false, bytesRelayed: 0,
  webrtcPeers: 0, serverPeers: 0, nodeId: "",
};

const GunContext = createContext<GunContextValue>({ db: null, ready: false, meshStats: null });

export function GunProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<GunDB | null>(null);
  const [ready, setReady] = useState(false);
  const [meshStats, setMeshStats] = useState<MeshStats | null>(null);
  const peersRef = useRef<Record<string, { type: "webrtc" | "server" }>>({});

  useEffect(() => {
    let mounted = true;

    // Load gun-client lazily (browser only — never runs on server)
    import("@/lib/gun-client").then((mod) => {
      if (!mounted) return;

      const instance = mod.getDb();
      const gun = mod.initGunNode();
      setDb(instance);
      setReady(true);

      // Generate stable node ID for this browser session
      let nodeId = "";
      try {
        nodeId = localStorage.getItem("p2pclaw_node_id") ?? "";
        if (!nodeId) {
          nodeId = "browser_" + Math.random().toString(36).slice(2, 10);
          localStorage.setItem("p2pclaw_node_id", nodeId);
        }
      } catch { /* private browsing */ }

      const updateStats = () => {
        const peerMap = peersRef.current;
        const webrtcPeers = Object.values(peerMap).filter(p => p.type === "webrtc").length;
        const serverPeers = Object.values(peerMap).filter(p => p.type === "server").length;
        setMeshStats({
          peersConnected: Object.keys(peerMap).length,
          isRelaying:     Object.keys(peerMap).length > 0,
          bytesRelayed:   mod.getNodeStats().dataServed,
          webrtcPeers,
          serverPeers,
          nodeId,
        });
      };

      // Track peer connections via Gun.js hi/bye events
      if (gun && typeof gun.on === "function") {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        gun.on("hi",  (peer: any) => {
          const id = peer?.id || peer?.wire?.url || String(Math.random());
          const isWebRTC = id.startsWith("browser_") || id.includes("rtc");
          peersRef.current[id] = { type: isWebRTC ? "webrtc" : "server" };
          updateStats();
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        gun.on("bye", (peer: any) => {
          const id = peer?.id || peer?.wire?.url || "";
          delete peersRef.current[id];
          updateStats();
        });
      }

      // Initialise stats
      updateStats();

      // Announce this browser as an active node in the mesh
      try {
        const namespace = instance.get("p2pclaw").get("nodes").get(nodeId);
        namespace.put({
          id:        nodeId,
          type:      "browser",
          joinedAt:  Date.now(),
          userAgent: navigator.userAgent.slice(0, 50),
        });
      } catch { /* non-critical */ }

      // Register Service Worker (keeps Gun.js alive when tab is backgrounded)
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker
          .register("/sw.js", { scope: "/" })
          .then(reg => {
            console.log("[Antigravity] Service Worker active:", reg.scope);
            // Ping SW with our node ID so it can track our presence
            reg.active?.postMessage({ type: "CLIENT_ACTIVE", nodeId });
          })
          .catch(err => console.warn("[Antigravity] SW registration failed:", err));
      }
    }).catch((err) => {
      console.error("[GunProvider] Failed to load Gun:", err);
    });

    return () => { mounted = false; };
  }, []);

  return (
    <GunContext.Provider value={{ db, ready, meshStats }}>
      {children}
    </GunContext.Provider>
  );
}

export function useGunContext(): GunContextValue {
  return useContext(GunContext);
}

// Legacy alias for backward compat with code that imports useGunContext
export const useGun = useGunContext;
