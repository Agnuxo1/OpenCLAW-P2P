import { NextRequest, NextResponse } from "next/server";
import { hasProxyCredentials, proxyEndpoints, proxyLogUrl, proxyRequestHeaders } from "@/lib/proxy-policy";

// Read replicas are tried in order for anonymous GET/HEAD requests only.
// Layer 1: active Render API (full publication + workflow engine)
// Layer 2: optional operator-configured secondary API
// Layer 3: legacy relay and HF Space fallbacks
const API_ENDPOINTS = [
  "https://p2pclaw-api.onrender.com",
  process.env.P2PCLAW_SECONDARY_API || process.env.RAILWAY_API_URL,
  "https://api-production-87b2.up.railway.app",
  "https://agnuxo-p2pclaw-api.hf.space",
].filter((v, i, a): v is string => Boolean(v) && a.indexOf(v) === i); // deduplicate + remove empty

function protectAuthenticatedResponse(response: NextResponse, req: NextRequest): NextResponse {
  if (hasProxyCredentials(req.headers)) {
    response.headers.set("Cache-Control", "private, no-store");
    response.headers.delete("CDN-Cache-Control");
    response.headers.delete("Vercel-CDN-Cache-Control");
  }
  return response;
}

async function fetchWithBody(req: NextRequest, apiUrl: string, requestBody?: string): Promise<Response> {
  const isPublication = req.nextUrl.pathname.endsWith("/publish-paper");
  const init: RequestInit = {
    method: req.method,
    headers: proxyRequestHeaders(req.headers),
    cache: "no-store",
    redirect: "manual",
    signal: AbortSignal.any([req.signal, AbortSignal.timeout(isPublication ? 110000 : 8000)]),
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

  // A Request body is a one-shot stream. Read it once so failover attempts
  // receive the same JSON instead of an empty payload.
  let requestBody: string | undefined;
  if (req.method !== "GET" && req.method !== "HEAD") {
    try { requestBody = await req.text(); } catch { /* no body */ }
  }

  const endpoints = proxyEndpoints(req.method, req.headers, API_ENDPOINTS);
  for (const base of endpoints) {
    const targetUrl = `${base}${urlSuffix}`;
    console.log(`[PROXY] ${req.method} ${req.nextUrl.pathname} -> ${proxyLogUrl(targetUrl)}`);

    try {
      const res = await fetchWithBody(req, targetUrl, requestBody);

      // Railway returns a branded 404 with x-railway-fallback=true when the
      // application/domain was removed. That is an infrastructure failure,
      // not a legitimate route-level 404, so continue to the next gateway.
      const retiredRailwayApp =
        res.status === 404 && res.headers.get("x-railway-fallback") === "true";

      if ((res.status >= 500 || retiredRailwayApp) &&
          endpoints.indexOf(base) < endpoints.length - 1) {
        console.warn(`[PROXY] ${proxyLogUrl(base)} returned ${res.status}, trying next endpoint`);
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
            return protectAuthenticatedResponse(NextResponse.redirect(new URL(relativeLocation, req.url), res.status), req);
          }
          return protectAuthenticatedResponse(NextResponse.redirect(location, res.status), req);
        }
      }

      const blob = await res.blob();
      const headers = new Headers(res.headers);
      headers.delete("content-encoding");
      headers.delete("content-length");
      headers.set("Access-Control-Allow-Origin", "*");
      headers.set("X-P2P-Proxy-Status", "active");
      headers.set("X-P2P-Upstream", base);
      return protectAuthenticatedResponse(new NextResponse(blob, { status: res.status, headers }), req);

    } catch {
      // Fetch errors can contain the full URL, including credentials in its query.
      console.warn(`[PROXY] ${proxyLogUrl(base)} unreachable`);
      if (req.signal.aborted) break;
    }
  }

  console.error("[PROXY] All eligible API endpoints failed");
  return protectAuthenticatedResponse(NextResponse.json({
    error: ["GET", "HEAD"].includes(req.method)
      ? "The requested data service is unavailable."
      : "The request outcome could not be confirmed. Check the resource status before retrying.",
    retryable: ["GET", "HEAD"].includes(req.method),
  }, { status: 503 }), req);
}
