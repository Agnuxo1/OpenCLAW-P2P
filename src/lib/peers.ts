/**
 * P2PCLAW — P2P Web Mesh
 * Bootstrap relay nodes for Gun.js peer-to-peer network.
 *
 * TWO LAYERS work simultaneously and independently:
 *  1. SERVER LAYER  — Railway + HuggingFace dedicated relay nodes (always-on)
 *  2. BROWSER LAYER — Every visitor becomes a P2P relay node via WebRTC
 *
 * Gun.js uses WSS URLs. The relay health monitor uses HTTPS for pinging.
 * Both layers coexist: if all servers die, browsers relay for each other.
 * If all browsers disconnect, servers take over again automatically.
 */

/** WSS URLs for Gun.js peer connections (WebSocket protocol) */
export const BOOTSTRAP_PEERS: string[] = [
  // ── LAYER 1: Cloudflare Edge (Global proxy, 100% uptime SLA) ────
  // Un-comment and update after deploying wrangler to CF Workers
  // 'wss://p2pclaw-gun-relay.YOUR-SUBDOMAIN.workers.dev/gun',

  // ── LAYER 2: Dedicated Auto-Scaling (Railway) ───────────────────
  'wss://openclaw-agent-01-production.up.railway.app/gun',
  'wss://p2pclaw-relay-production.up.railway.app/gun',

  // ── LAYER 3: Dedicated Static IPs (Docker/Oracle/GCP) ───────────
  // Un-comment and point to your persistent VM or home server
  // 'ws://YOUR_ORACLE_IP:8765/gun',
  // 'ws://p2pclaw-home.duckdns.org:8765/gun',

  // ── LAYER 4: Free-Tier PaaS (HuggingFace + Render) ──────────────
  // These may sleep, but the standalone pinger keeps them awake
  'wss://agnuxo-p2pclaw-node-a.hf.space/gun',
  'wss://nautiluskit-p2pclaw-node-b.hf.space/gun',
  'wss://frank-agnuxo-p2pclaw-node-c.hf.space/gun',
  'wss://karmakindle1-p2pclaw-node-d.hf.space/gun',
  'wss://p2pclaw-relay.onrender.com/gun',
];

/**
 * HTTPS URLs for relay health monitoring pings.
 * These correspond 1:1 with BOOTSTRAP_PEERS (same hosts, http scheme, no /gun).
 * The relay monitor uses HEAD requests to check if nodes are responsive.
 */
export const RELAY_HTTP_URLS: string[] = [
  // 'https://p2pclaw-gun-relay.YOUR-SUBDOMAIN.workers.dev',
  'https://openclaw-agent-01-production.up.railway.app',
  'https://p2pclaw-relay-production.up.railway.app',
  // 'http://YOUR_ORACLE_IP:8765',
  // 'http://p2pclaw-home.duckdns.org:8765',
  'https://agnuxo-p2pclaw-node-a.hf.space',
  'https://nautiluskit-p2pclaw-node-b.hf.space',
  'https://frank-agnuxo-p2pclaw-node-c.hf.space',
  'https://karmakindle1-p2pclaw-node-d.hf.space',
  'https://p2pclaw-relay.onrender.com',
];

/** WebRTC STUN config for direct browser-to-browser channels (Layer 2) */
export const WEBRTC_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' },
  ],
};

/** How long a browser node is considered "active" in the mesh (ms) */
export const NODE_ACTIVE_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
