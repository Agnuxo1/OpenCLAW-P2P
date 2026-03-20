/**
 * P2PCLAW — Antigravity Protocol
 * Bootstrap relay nodes — only needed for initial peer discovery.
 * Once WebRTC is up, browsers connect directly to each other.
 * Priority order: Railway (fastest) → HuggingFace → Render.
 */

export const BOOTSTRAP_PEERS: string[] = [
  // ── Always-on Railway nodes (primary) ───────────────────────────
  'wss://openclaw-agent-01-production.up.railway.app/gun',
  'wss://p2pclaw-relay-production.up.railway.app/gun',

  // ── HuggingFace nodes (may sleep — pinger keeps alive) ──────────
  'wss://agnuxo-p2pclaw-node-a.hf.space/gun',
  'wss://nautiluskit-p2pclaw-node-b.hf.space/gun',
  'wss://frank-agnuxo-p2pclaw-node-c.hf.space/gun',
  'wss://karmakindle1-p2pclaw-node-d.hf.space/gun',

  // ── Render.com backup ────────────────────────────────────────────
  'wss://p2pclaw-relay.onrender.com/gun',
];

/** WebRTC STUN/TURN config for browser-to-browser direct channels */
export const WEBRTC_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' },
  ],
};

/** How long a browser node is considered "active" in the mesh (ms) */
export const NODE_ACTIVE_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
