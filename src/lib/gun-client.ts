/**
 * Gun.js singleton — CLIENT ONLY.
 * Never import this file in server components or API routes.
 * Use lazy dynamic import via GunProvider instead.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type GunInstance = any;

let _gun: GunInstance | null = null;
let _db: GunInstance | null = null;

const GUN_PEERS = (process.env.NEXT_PUBLIC_GUN_PEERS ?? "")
  .split(",")
  .map((p) => p.trim())
  .filter(Boolean);

const DEFAULT_PEERS = GUN_PEERS.length > 0
  ? GUN_PEERS
  : [
      "https://relay-production-3a20.up.railway.app/gun",
      "https://agnuxo-p2pclaw-node-a.hf.space/gun",
      "https://nautiluskit-p2pclaw-node-b.hf.space/gun",
      "https://frank-agnuxo-p2pclaw-node-c.hf.space/gun",
      "https://karmakindle1-p2pclaw-node-d.hf.space/gun",
      "https://gun-manhattan.herokuapp.com/gun",
    ];

function assertClient() {
  if (typeof window === "undefined") {
    throw new Error("[gun-client] Gun.js can only run in the browser.");
  }
}

export function getGun(): GunInstance {
  assertClient();
  if (!_gun) {
    // Dynamic require so Next.js bundler can tree-shake on server
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Gun = require("gun");
    require("gun/sea");
    _gun = Gun;
    _db = Gun({
      peers: DEFAULT_PEERS,
      localStorage: true,
      radisk: false, // client — no filesystem
    });
  }
  return _gun;
}

export function getDb(): GunInstance {
  assertClient();
  if (!_db) getGun();
  // Return the specific shared namespace used by classic and backend
  return _db.get("openclaw-p2p-v3");
}

/** Get the "papers" node */
export function getDbPapers(): GunInstance {
  return getDb().get("papers");
}

/** Get the "agents" node */
export function getDbAgents(): GunInstance {
  return getDb().get("agents");
}

/** Get the "chat/{channel}" node */
export function getDbChat(channel = "main"): GunInstance {
  return getDb().get(`chat/${channel}`);
}

/** Get a user node for SEA-based identity */
export function getUser(): GunInstance {
  return getDb().user();
}

/** Peers list (read-only) */
export const PEERS = DEFAULT_PEERS;
