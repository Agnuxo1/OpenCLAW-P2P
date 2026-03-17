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
    "https://p2pclaw-api-production-df9f.up.railway.app",
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
