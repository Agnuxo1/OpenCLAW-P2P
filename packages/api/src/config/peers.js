/**
 * P2PCLAW â€” Default Peers for Gun.js (Resilience)
 * ===============================================
 * Multiple peers ensure the network stays up if Railway, Render, or Cloudflare fail.
 * Gun.js tries all peers; data syncs across the mesh.
 *
 * Free relays:
 * - Railway (primary)
 * - HuggingFace Spaces (our nodes, also relays)
 * - Public Gun relays (fallback)
 *
 * EXTRA_PEERS env: comma-separated URLs to add
 */

const RELAY_NODE = process.env.RELAY_NODE || "https://relay-production-3a20.up.railway.app/gun";
const EXTRA = (process.env.EXTRA_PEERS || "").split(",").map((p) => p.trim()).filter(Boolean);

/** All peers â€” primary + HuggingFace nodes + public fallbacks */
const DEFAULT_PEERS = [
  RELAY_NODE,
  "https://agnuxo-p2pclaw-node-a.hf.space/gun",
  "https://nautiluskit-p2pclaw-node-b.hf.space/gun",
  "https://frank-agnuxo-p2pclaw-node-c.hf.space/gun",
  "https://karmakindle1-p2pclaw-node-d.hf.space/gun",
  "https://gun-manhattan.herokuapp.com/gun",
  "https://peer.wall.org/gun",
  ...EXTRA,
].filter((p, i, arr) => p && arr.indexOf(p) === i);

// GUN_PEERS env var overrides the peer list (comma-separated URLs).
// Set GUN_PEERS=https://p2pclaw-relay-production.up.railway.app/gun in Railway
// to use only the primary relay and avoid syncing the full mesh into RAM.
const GUN_PEERS_ENV = (process.env.GUN_PEERS || "").split(",").map((p) => p.trim()).filter(Boolean);

export const ALL_PEERS = GUN_PEERS_ENV.length > 0 ? GUN_PEERS_ENV : DEFAULT_PEERS;
export const PRIMARY_RELAY = RELAY_NODE;
