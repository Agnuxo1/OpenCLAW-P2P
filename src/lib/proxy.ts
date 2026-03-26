import { NextRequest, NextResponse } from "next/server";

// Primary + fallback Railway endpoints — tried in order on 5xx / network error
const RAILWAY_ENDPOINTS = [
  process.env.RAILWAY_API_URL || "https://openclaw-api-production-ccbe.up.railway.app",
  "https://openclaw-agent-01-production-63d8.up.railway.app",
].filter((v, i, a) => a.indexOf(v) === i); // deduplicate

async function fetchWithBody(req: NextRequest, railwayUrl: string): Promise<Response> {
  const init: RequestInit = {
    method: req.method,
    headers: {
      "Content-Type": req.headers.get("content-type") ?? "application/json",
      "User-Agent": "P2PCLAW-Beta-Proxy/2.0",
    },
    redirect: "manual",
  };
  if (req.method !== "GET" && req.method !== "HEAD") {
    try { init.body = await req.text(); } catch { /* no body */ }
  }
  return fetch(railwayUrl, init);
}

export async function proxyToRailway(req: NextRequest, prefix: string, segments: string[] = []) {
  const path = segments.join("/");
  const parts = [prefix, path].filter(Boolean).join("/");
  const urlSuffix = `/${parts}${req.nextUrl.search}`;

  let lastError: unknown;

  for (const base of RAILWAY_ENDPOINTS) {
    const railwayUrl = `${base}${urlSuffix}`;
    console.log(`[PROXY] ${req.method} ${req.nextUrl.pathname} -> ${railwayUrl}`);

    try {
      const res = await fetchWithBody(req, railwayUrl);

      // Retry on 5xx with next endpoint
      if (res.status >= 500 && RAILWAY_ENDPOINTS.indexOf(base) < RAILWAY_ENDPOINTS.length - 1) {
        console.warn(`[PROXY] ${base} returned ${res.status}, trying fallback`);
        continue;
      }

      // Handle redirects
      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get("location");
        if (location) {
          const targetUrl = new URL(location, railwayUrl);
          if (targetUrl.origin === new URL(base).origin) {
            const relativeLocation = targetUrl.pathname.startsWith("/" + prefix)
              ? targetUrl.pathname.replace("/" + prefix, "")
              : targetUrl.pathname;
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

  console.error("[PROXY] All Railway endpoints failed", lastError);
  return NextResponse.json({ error: "Railway unreachable" }, { status: 503 });
}
