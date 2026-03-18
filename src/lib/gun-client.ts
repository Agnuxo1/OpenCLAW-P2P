/**
 * Gun.js v3 singleton — CLIENT ONLY.
 * v3 change: localStorage:true + radisk:true + axe:true
 * Each browser tab becomes a real P2P node that stores and forwards data.
 * Never import this file in server components or API routes.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type GunInstance = any;

let _gun: GunInstance | null = null;
let _db: GunInstance | null = null;
let _nodeStats = { peersConnected: 0, dataServed: 0, dataReceived: 0, cacheHits: 0 };

const GUN_PEERS_ENV = (process.env.NEXT_PUBLIC_GUN_PEERS ?? "")
  .split(",").map((p) => p.trim()).filter(Boolean);

const GUN_NAMESPACE = (process.env.NEXT_PUBLIC_GUN_NAMESPACE ?? "openclaw-p2p-v3");

export const BOOTSTRAP_PEERS = GUN_PEERS_ENV.length > 0 ? GUN_PEERS_ENV : [
  "https://agnuxo-p2pclaw-node-a.hf.space/gun",
  "https://nautiluskit-p2pclaw-node-b.hf.space/gun",
  "https://frank-agnuxo-p2pclaw-node-c.hf.space/gun",
  "https://karmakindle1-p2pclaw-node-d.hf.space/gun",
];

export const PEERS = BOOTSTRAP_PEERS;

function assertClient() {
  if (typeof window === "undefined") throw new Error("[gun-client] Browser only.");
}

export function initGunNode(): GunInstance {
  assertClient();
  if (_gun) return _gun;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Gun = require("gun");
  require("gun/sea");
  require("gun/axe");

  _db = Gun({
    peers: BOOTSTRAP_PEERS,
    // V3: browser becomes a real P2P node
    localStorage: true,   // persist graph in IndexedDB
    radisk: true,         // RADix storage, efficient for large graphs
    multicast: true,
    axe: true,            // AXE routing: shortest path between peers
  });
  _gun = Gun;

  _db.on("out", (msg: unknown) => { _nodeStats.dataServed += JSON.stringify(msg).length; });
  _db.on("in", (msg: unknown) => { _nodeStats.dataReceived += JSON.stringify(msg).length; });
  return _gun;
}

export function getGun(): GunInstance {
  assertClient();
  if (!_gun) initGunNode();
  return _gun;
}

export function getDb(): GunInstance {
  assertClient();
  if (!_db) initGunNode();
  return _db!.get(GUN_NAMESPACE);
}

export function getDbPapers(): GunInstance { return getDb().get("papers"); }
export function getDbAgents(): GunInstance { return getDb().get("agents"); }
export function getDbChat(channel = "main"): GunInstance { return getDb().get(`chat/${channel}`); }
export function getUser(): GunInstance { if (!_db) initGunNode(); return _db!.user(); }

export function getNamespaces() {
  const db = getDb();
  return {
    papers: db.get("papers"), mempool: db.get("mempool"), agents: db.get("agents"),
    votes: db.get("votes"), dids: db.get("dids"), trust: db.get("trust"),
    briefing: db.get("briefing"), swarm: db.get("swarm"),
  };
}

export function getNodeStats() {
  const peers = _db ? Object.keys(_db._.opt?.peers ?? {}).length : 0;
  _nodeStats.peersConnected = peers;
  return { ..._nodeStats, peersConnected: peers, isContributing: _nodeStats.dataServed > 0 };
}

export function gunGet(node: GunInstance, timeoutMs = 3000): Promise<unknown> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), timeoutMs);
    node.once((data: unknown) => { clearTimeout(timer); resolve(data); });
  });
}

export function gunCollect(node: GunInstance, timeoutMs = 2500): Promise<unknown[]> {
  return new Promise((resolve) => {
    const items = new Map<string, unknown>();
    node.map().once((item: unknown, key: string) => {
      if (item && key && !key.startsWith("_")) items.set(key, item);
    });
    setTimeout(() => resolve([...items.values()]), timeoutMs);
  });
}

export function gunSubscribe(node: GunInstance, callback: (item: unknown, key: string) => void): () => void {
  node.map().on((item: unknown, key: string) => {
    if (item && key && !key.startsWith("_")) callback(item, key);
  });
  return () => node.map().off();
}
