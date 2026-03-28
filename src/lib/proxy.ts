import { NextRequest, NextResponse } from "next/server";

// ── Onion-layered API gateways — tried in order, never single point of failure ──
// Layer 1: nautiluskit Railway (always-on, full API + workflow engine)
// Layer 2: Render (free 750h/mo, auto-deploy from GitHub)
// Layer 3: HF Space (free CPU tier, Docker, persistent)
// Layer 4: Queen agents (always on HF, partial API)
const API_ENDPOINTS = [
  process.env.RAILWAY_API_URL || "https://api-production-87b2.up.railway.app",
  "https://api-production-87b2.up.railway.app",
  "https://p2pclaw-api.onrender.com",
  "https://agnuxo-p2pclaw-api.hf.space",
  "https://queen-agent-production.up.railway.app",
  "https://beta-queen-production-1e87.up.railway.app",
].filter((v, i, a) => v && a.indexOf(v) === i); // deduplicate + remove empty

async function fetchWithBody(req: NextRequest, apiUrl: string): Promise<Response> {
  const init: RequestInit = {
    method: req.method,
    headers: {
      "Content-Type": req.headers.get("content-type") ?? "application/json",
      "Accept": req.headers.get("accept") ?? "application/json",
      "User-Agent": "P2PCLAW-Proxy/3.0",
    },
    redirect: "manual",
    signal: AbortSignal.timeout(8000), // 8s timeout per endpoint
  };
  if (req.method !== "GET" && req.method !== "HEAD") {
    try { init.body = await req.text(); } catch { /* no body */ }
  }
  return fetch(apiUrl, init);
}

export async function proxyToRailway(req: NextRequest, prefix: string, segments: string[] = []) {
  const pathStr = segments.join("/");
  const parts = [prefix, pathStr].filter(Boolean).join("/");
  const urlSuffix = `/${parts}${req.nextUrl.search}`;

  let lastError: unknown;

  for (const base of API_ENDPOINTS) {
    const targetUrl = `${base}${urlSuffix}`;
    console.log(`[PROXY] ${req.method} ${req.nextUrl.pathname} -> ${targetUrl}`);

    try {
      const res = await fetchWithBody(req, targetUrl);

      // Retry on 5xx or 502/503 with next endpoint
      if ((res.status >= 500 || res.status === 502 || res.status === 503) &&
          API_ENDPOINTS.indexOf(base) < API_ENDPOINTS.length - 1) {
        console.warn(`[PROXY] ${base} returned ${res.status}, trying next endpoint`);
        continue;
      }

      // Handle redirects
      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get("location");
        if (location) {
          const targetUrlObj = new URL(location, targetUrl);
          if (targetUrlObj.origin === new URL(base).origin) {
            const relativeLocation = targetUrlObj.pathname.startsWith("/" + prefix)
              ? targetUrlObj.pathname.replace("/" + prefix, "")
              : targetUrlObj.pathname;
            return NextResponse.redirect(new URL(relativeLocation, req.url), res.status);
          }
          return NextResponse.redirect(location, res.status);
        }
      }

      const blob = await res.blob();
      const headers = new Headers(res.headers);
      headers.delete("content-encoding");
      headers.delete("content-length");
      headers.set("Access-Control-Allow-Origin", "*");
      headers.set("X-P2P-Proxy-Status", "active");
      headers.set("X-P2P-Upstream", base);

      return new NextResponse(blob, { status: res.status, headers });

    } catch (error) {
      console.warn(`[PROXY] ${base} unreachable:`, error);
      lastError = error;
    }
  }

  console.error("[PROXY] All API endpoints failed", lastError);
  return NextResponse.json({
    error: "All API gateways unreachable",
    gateways: API_ENDPOINTS,
    hint: "Try direct: https://p2pclaw-api.onrender.com/silicon"
  }, { status: 503 });
}
