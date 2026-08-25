import { NextRequest, NextResponse } from "next/server";

// ── Onion-layered API gateways — tried in order, never single point of failure ──
// Layer 1: active Render API (full publication + workflow engine)
// Layer 2: optional operator-configured secondary API
// Layer 3: legacy relay and HF Space fallbacks
const API_ENDPOINTS = [
  "https://p2pclaw-api.onrender.com",
  process.env.P2PCLAW_SECONDARY_API || process.env.RAILWAY_API_URL,
  "https://api-production-87b2.up.railway.app",
  "https://agnuxo-p2pclaw-api.hf.space",
].filter((v, i, a): v is string => Boolean(v) && a.indexOf(v) === i); // deduplicate + remove empty

async function fetchWithBody(req: NextRequest, apiUrl: string, requestBody?: string): Promise<Response> {
  const isPublication = req.nextUrl.pathname.endsWith("/publish-paper");
  const init: RequestInit = {
    method: req.method,
    headers: {
      "Content-Type": req.headers.get("content-type") ?? "application/json",
      "Accept": req.headers.get("accept") ?? "application/json",
      "User-Agent": "P2PCLAW-Proxy/3.0",
    },
    redirect: "manual",
    signal: AbortSignal.timeout(isPublication ? 120000 : 8000),
  };
  if (req.method !== "GET" && req.method !== "HEAD") {
    init.body = requestBody;
  }
  return fetch(apiUrl, init);
}

export async function proxyToRailway(req: NextRequest, prefix: string, segments: string[] = []) {
  const pathStr = segments.join("/");
  const parts = [prefix, pathStr].filter(Boolean).join("/");
  const urlSuffix = `/${parts}${req.nextUrl.search}`;

  let lastError: unknown;
  // A Request body is a one-shot stream. Read it once so failover attempts
  // receive the same JSON instead of an empty payload.
  let requestBody: string | undefined;
  if (req.method !== "GET" && req.method !== "HEAD") {
    try { requestBody = await req.text(); } catch { /* no body */ }
  }

  for (const base of API_ENDPOINTS) {
    const targetUrl = `${base}${urlSuffix}`;
    console.log(`[PROXY] ${req.method} ${req.nextUrl.pathname} -> ${targetUrl}`);

    try {
      const res = await fetchWithBody(req, targetUrl, requestBody);

      // Railway returns a branded 404 with x-railway-fallback=true when the
      // application/domain was removed. That is an infrastructure failure,
      // not a legitimate route-level 404, so continue to the next gateway.
      const retiredRailwayApp =
        res.status === 404 && res.headers.get("x-railway-fallback") === "true";

      if ((res.status >= 500 || retiredRailwayApp) &&
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
