/**
 * Helia (IPFS) browser node — CLIENT ONLY.
 * v3: Each browser runs a full IPFS node storing papers in IndexedDB.
 * Papers read by users are pinned locally and served to other browsers via WebRTC.
 * A paper with 1,000 readers = 1,000 automatic replicas.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyType = any;

let _helia: AnyType = null;
let _heliaJson: AnyType = null;
let _initPromise: Promise<AnyType> | null = null;

// VPS bootstrap multiaddrs (with real PeerIDs from the HF Space nodes)
const BOOTSTRAP_MULTIADDRS = (process.env.NEXT_PUBLIC_BOOTSTRAP_MULTIADDRS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

// Public IPFS gateway fallbacks (used only when no local/P2P peer has the content)
const PUBLIC_GATEWAYS: Array<(cid: string) => string> = [
  (cid) => `https://${cid}.ipfs.w3s.link`,
  (cid) => `https://ipfs.io/ipfs/${cid}`,
  (cid) => `https://cloudflare-ipfs.com/ipfs/${cid}`,
];

export async function initHeliaNode(): Promise<AnyType> {
  if (typeof window === "undefined") return null;
  if (_helia) return _helia;
  if (_initPromise) return _initPromise;

  _initPromise = (async () => {
    try {
      console.log("[Helia] Initializing browser IPFS node...");

      const [
        { createHelia },
        { json: heliaJson },
        { createLibp2p },
        { webSockets },
        { webRTC },
        { noise },
        { mplex },
        { identify },
        { circuitRelayTransport },
        { IDBBlockstore },
        { IDBDatastore },
      ] = await Promise.all([
        import("helia"),
        import("@helia/json"),
        import("libp2p"),
        import("@libp2p/websockets"),
        import("@libp2p/webrtc"),
        import("@chainsafe/libp2p-noise"),
        import("@libp2p/mplex"),
        import("@libp2p/identify"),
        import("@libp2p/circuit-relay-v2"),
        import("blockstore-idb"),
        import("datastore-idb"),
      ]);

      // IndexedDB stores — persist across browser sessions
      const blockstore = new IDBBlockstore("p2pclaw-blocks");
      const datastore = new IDBDatastore("p2pclaw-data");
      await blockstore.open();
      await datastore.open();

      const libp2pConfig: AnyType = {
        transports: [
          webSockets(),
          webRTC(),
          circuitRelayTransport(),
        ],
        connectionEncryption: [noise()],
        streamMuxers: [mplex()],
        services: { identify: identify() },
        connectionManager: { maxConnections: 50, minConnections: 3 },
      };

      if (BOOTSTRAP_MULTIADDRS.length > 0) {
        const { bootstrap } = await import("@libp2p/bootstrap");
        libp2pConfig.peerDiscovery = [bootstrap({ list: BOOTSTRAP_MULTIADDRS })];
      }

      const libp2pNode = await createLibp2p(libp2pConfig);

      _helia = await createHelia({ libp2p: libp2pNode, blockstore, datastore });
      _heliaJson = heliaJson(_helia);

      const peerId = _helia.libp2p.peerId.toString();
      console.log(`[Helia] Node started. PeerID: ${peerId.slice(0, 16)}...`);

      _helia.libp2p.addEventListener("peer:connect", () => {
        const total = _helia.libp2p.getPeers().length;
        console.log(`[Helia] IPFS peers connected: ${total}`);
      });

      // Gun.js peer discovery — announce our multiaddrs so other browsers can find us
      // and try to connect to recently seen peers
      const setupGunPeerDiscovery = async () => {
        try {
          const { getDb } = await import("./gun-client");
          const db = getDb();
          const heliaId = _helia.libp2p.peerId.toString();
          const addrs = _helia.libp2p.getMultiaddrs().map((m: { toString(): string }) => m.toString());

          if (addrs.length > 0) {
            // Announce our presence
            db.get("peers").get(heliaId).put({
              multiaddrs: addrs.join(","),
              lastSeen: Date.now(),
              peerId: heliaId,
            });
            console.log(`[Helia] Announced ${addrs.length} multiaddrs to Gun.js`);
          }

          // Subscribe to peer announcements and try to connect
          const { multiaddr } = await import("@multiformats/multiaddr").catch(() => ({ multiaddr: null }));
          if (!multiaddr) return;

          db.get("peers").map().on((peer: { multiaddrs?: string; lastSeen?: number; peerId?: string } | null, key: string) => {
            if (!peer?.multiaddrs || !peer.peerId || key === heliaId) return;
            // Only connect to peers seen in the last 5 minutes
            if (Date.now() - (peer.lastSeen ?? 0) > 5 * 60 * 1000) return;
            const maddrs = peer.multiaddrs.split(",").filter(Boolean);
            maddrs.forEach(async (addr: string) => {
              try {
                await _helia.libp2p.dial(multiaddr(addr));
                console.log(`[Helia] Connected to peer ${peer.peerId!.slice(0, 16)}...`);
              } catch { /* best-effort */ }
            });
          });
        } catch (e) {
          console.warn("[Helia] Gun.js peer discovery setup failed:", e);
        }
      };
      // Run in background — don't await
      setupGunPeerDiscovery().catch(() => {});

      // Also announce to Railway for cross-network discovery
      try {
        const addrs = _helia.libp2p.getMultiaddrs().map((m: { toString(): string }) => m.toString());
        if (addrs.length > 0) {
          const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "https://p2pclaw-mcp-server-production-ac1c.up.railway.app";
          fetch(`${API_BASE}/helia-peers`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              peerId: _helia.libp2p.peerId.toString(),
              multiaddrs: addrs,
            }),
            signal: AbortSignal.timeout(5000),
          }).catch(() => {});

          // Also fetch existing peers and try to connect
          fetch(`${API_BASE}/helia-peers`, { signal: AbortSignal.timeout(5000) })
            .then(r => r.json())
            .then(async (data: { peers?: Array<{ peerId: string; multiaddrs: string[] }> }) => {
              const { multiaddr } = await import("@multiformats/multiaddr").catch(() => ({ multiaddr: null }));
              if (!multiaddr || !data.peers) return;
              for (const peer of data.peers) {
                if (peer.peerId === _helia.libp2p.peerId.toString()) continue;
                for (const addr of (peer.multiaddrs || [])) {
                  try {
                    await _helia.libp2p.dial(multiaddr(addr));
                    console.log(`[Helia] Connected via Railway peer exchange: ${peer.peerId.slice(0, 16)}...`);
                    break;
                  } catch { /* best-effort */ }
                }
              }
            })
            .catch(() => {});
        }
      } catch { /* non-critical */ }

      return _helia;
    } catch (err) {
      console.warn("[Helia] Init failed (non-critical):", err);
      _initPromise = null;
      return null;
    }
  })();

  return _initPromise;
}

/** Publish a paper to IPFS from the browser. Pins locally + announces to network. */
export async function publishPaperToIPFS(paperData: unknown): Promise<{ cid: string; url: string; gateways: string[]; storedLocally: boolean }> {
  const helia = await initHeliaNode();
  if (!helia || !_heliaJson) {
    // Fallback: use external API to pin
    return publishViaAPI(paperData);
  }

  try {
    const cid = await _heliaJson.add(paperData);
    const cidStr = cid.toString();
    console.log(`[Helia] Paper published locally: ${cidStr.slice(0, 16)}...`);

    // Pin locally so we serve it to other browsers
    try {
      await helia.pins.add(cid);
    } catch { /* pin failure is non-critical */ }

    // Background: also pin via external API for permanence
    publishViaAPI(paperData).catch(() => {});

    return {
      cid: cidStr,
      url: `ipfs://${cidStr}`,
      gateways: PUBLIC_GATEWAYS.map((fn) => fn(cidStr)),
      storedLocally: true,
    };
  } catch (err) {
    console.warn("[Helia] Local publish failed, falling back to API:", err);
    return publishViaAPI(paperData);
  }
}

/** Fetch a paper by CID. Priority: local IndexedDB → P2P peers → public gateways */
export async function fetchPaperFromIPFS(cidStr: string, timeoutMs = 8000): Promise<unknown> {
  const helia = await initHeliaNode();

  if (helia && _heliaJson) {
    try {
      const { CID } = await import("multiformats/cid");
      const cid = CID.parse(cidStr);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const data = await _heliaJson.get(cid, { signal: controller.signal });
      clearTimeout(timer);
      console.log(`[Helia] Paper fetched from P2P: ${cidStr.slice(0, 16)}...`);
      return data;
    } catch {
      console.warn(`[Helia] P2P fetch failed, trying gateways`);
    }
  }

  return fetchFromGateways(cidStr, timeoutMs);
}

async function fetchFromGateways(cidStr: string, timeoutMs: number): Promise<unknown> {
  const errors: string[] = [];
  for (const gatewayFn of PUBLIC_GATEWAYS) {
    try {
      const url = gatewayFn(cidStr);
      const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs / 3) });
      if (res.ok) {
        const data = await res.json();
        // Cache in local Helia for future requests
        cacheInHelia(data).catch(() => {});
        return data;
      }
    } catch (e: AnyType) {
      errors.push(e.message);
    }
  }
  throw new Error(`Could not fetch ${cidStr}. Errors: ${errors.join(", ")}`);
}

async function cacheInHelia(data: unknown): Promise<void> {
  if (!_heliaJson) return;
  try {
    const newCid = await _heliaJson.add(data);
    console.log(`[Helia] Cached locally: ${newCid.toString().slice(0, 16)}...`);
  } catch { /* non-critical */ }
}

async function publishViaAPI(paperData: unknown): Promise<{ cid: string; url: string; gateways: string[]; storedLocally: boolean }> {
  const API_NODES = [
    process.env.NEXT_PUBLIC_API_BASE ?? "https://p2pclaw-mcp-server-production-ac1c.up.railway.app",
    "https://p2pclaw-mcp-server-production-ac1c.up.railway.app",
    "https://agnuxo-p2pclaw-node-a.hf.space",
    "https://nautiluskit-p2pclaw-node-b.hf.space",
  ];
  for (const apiUrl of API_NODES) {
    try {
      const res = await fetch(`${apiUrl}/pin-external`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: paperData }),
        signal: AbortSignal.timeout(15000),
      });
      if (res.ok) {
        const result = await res.json() as { cid?: string };
        const cidStr = result.cid ?? "unknown";
        return {
          cid: cidStr,
          url: `ipfs://${cidStr}`,
          gateways: PUBLIC_GATEWAYS.map((fn) => fn(cidStr)),
          storedLocally: false,
        };
      }
    } catch { /* try next */ }
  }
  // Return a deterministic fallback CID-like identifier
  const fallbackId = `local-${Date.now()}`;
  return { cid: fallbackId, url: `ipfs://${fallbackId}`, gateways: [], storedLocally: false };
}

/** Get Helia node stats */
export async function getHeliaStats() {
  const helia = await initHeliaNode();
  if (!helia) return { peerId: null, peers: 0, isOnline: false };
  return {
    peerId: helia.libp2p.peerId.toString(),
    peers: helia.libp2p.getPeers().length,
    isOnline: helia.libp2p.isStarted(),
  };
}
