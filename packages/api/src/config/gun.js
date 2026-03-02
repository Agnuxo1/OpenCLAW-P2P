import Gun from "gun";
import "gun/sea.js";
import { ALL_PEERS, PRIMARY_RELAY } from "./peers.js";

// Multi-peer for resilience: if Railway/Cloudflare fail, fallbacks (HF, public relays) keep mesh alive
const gun = Gun({
  peers: ALL_PEERS,
  localStorage: false,
  radisk: false,
  dir: "radata",
  retry: 1000,
});

export const db = gun.get(process.env.GUN_DB_NAME || "openclaw-p2p-v3");

console.log(`[Gun.js] Peers: ${ALL_PEERS.length} (primary: ${PRIMARY_RELAY})`);
console.log(`[Gun.js] Database name: ${process.env.GUN_DB_NAME || "openclaw-p2p-v3"}`);

export default gun;
