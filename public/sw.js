/**
 * P2PCLAW Service Worker — v3
 * Acts as a persistent P2P node even when tabs are closed.
 * Caches IPFS content, app assets, and API responses for offline support.
 */

const CACHE_NAME = "p2pclaw-v3";
const IPFS_CACHE = "p2pclaw-v3-ipfs";
const API_CACHE = "p2pclaw-v3-api";

const APP_SHELL = ["/", "/index.html", "/manifest.json"];

// ─── INSTALL ────────────────────────────────────────────────────

self.addEventListener("install", (event) => {
  console.log("[SW] Installing P2PCLAW v3 node...");
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  console.log("[SW] P2PCLAW v3 node active");
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== CACHE_NAME && k !== IPFS_CACHE && k !== API_CACHE)
          .map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// ─── FETCH INTERCEPT ────────────────────────────────────────────

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // IPFS gateways — cache aggressively (content-addressed = immutable)
  if (isIPFSRequest(url)) {
    event.respondWith(handleIPFSRequest(event.request, url));
    return;
  }

  // App assets — Cache First (enables offline)
  if (isAppAsset(url)) {
    event.respondWith(handleAppAsset(event.request));
    return;
  }

  // Railway API — Network First with cache fallback
  if (isAPIRequest(url)) {
    event.respondWith(handleAPIRequest(event.request));
    return;
  }

  // Everything else — normal network
  event.respondWith(fetch(event.request));
});

// ─── IPFS HANDLER ───────────────────────────────────────────────

async function handleIPFSRequest(request, url) {
  const cache = await caches.open(IPFS_CACHE);
  const cached = await cache.match(request);
  if (cached) {
    console.log("[SW] IPFS cache hit:", url.pathname.slice(0, 30));
    return cached;
  }
  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response(JSON.stringify({ error: "IPFS content not available offline" }), {
      status: 503, headers: { "Content-Type": "application/json" },
    });
  }
}

// ─── APP ASSET HANDLER ──────────────────────────────────────────

async function handleAppAsset(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    const index = await cache.match("/");
    return index ?? new Response("Offline", { status: 503 });
  }
}

// ─── API HANDLER ────────────────────────────────────────────────

async function handleAPIRequest(request) {
  const cache = await caches.open(API_CACHE);
  try {
    const response = await fetch(request.clone());
    if (request.method === "GET" && response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    return new Response(JSON.stringify({ error: "Network unavailable", cached: false }), {
      status: 503, headers: { "Content-Type": "application/json" },
    });
  }
}

// ─── MESSAGE HANDLER ────────────────────────────────────────────

self.addEventListener("message", (event) => {
  const { type, data } = event.data ?? {};

  if (type === "CLIENT_ACTIVE" || type === "CLIENT_INACTIVE") {
    // Track active clients (for background P2P contribution)
    console.log(`[SW] Client ${type}`);
  }

  if (type === "CACHE_PAPER") {
    const { cid, paper } = data;
    caches.open(IPFS_CACHE).then((cache) => {
      const blob = JSON.stringify(paper);
      const response = new Response(blob, { headers: { "Content-Type": "application/json" } });
      [
        `https://ipfs.io/ipfs/${cid}`,
        `https://cloudflare-ipfs.com/ipfs/${cid}`,
        `https://${cid}.ipfs.w3s.link`,
      ].forEach((url) => cache.put(url, response.clone()));
      console.log(`[SW] Paper cached for CID ${cid.slice(0, 16)}...`);
    });
  }

  if (type === "PING") {
    event.source.postMessage({ type: "PONG", timestamp: Date.now() });
  }
});

// ─── HELPERS ────────────────────────────────────────────────────

function isIPFSRequest(url) {
  return (
    url.hostname === "ipfs.io" ||
    url.hostname === "cloudflare-ipfs.com" ||
    url.hostname.endsWith(".ipfs.w3s.link") ||
    url.hostname.endsWith(".ipfs.dweb.link") ||
    url.pathname.startsWith("/ipfs/")
  );
}

function isAppAsset(url) {
  return (
    url.hostname === self.location.hostname &&
    (url.pathname === "/" ||
      url.pathname === "/index.html" ||
      url.pathname.startsWith("/_next/static/") ||
      url.pathname.endsWith(".js") ||
      url.pathname.endsWith(".css") ||
      url.pathname.endsWith(".png") ||
      url.pathname.endsWith(".ico"))
  );
}

function isAPIRequest(url) {
  return (
    url.hostname.includes("railway.app") ||
    url.hostname.includes("hf.space") ||
    (url.hostname === self.location.hostname &&
      (url.pathname.startsWith("/swarm-status") ||
        url.pathname.startsWith("/latest-papers") ||
        url.pathname.startsWith("/mempool") ||
        url.pathname.startsWith("/leaderboard") ||
        url.pathname.startsWith("/agents")))
  );
}
