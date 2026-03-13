import { NextRequest, NextResponse } from "next/server";

const RAILWAY = process.env.RAILWAY_API_URL || "https://api-production-ff1b.up.railway.app";

export async function proxyToRailway(req: NextRequest, prefix: string, segments: string[] = []) {
  const path = segments.join("/");
  const railwayUrl = `${RAILWAY}/${prefix}${path ? "/" + path : ""}${req.nextUrl.search}`;

  console.log(`[PROXY] ${req.method} ${req.nextUrl.pathname} -> ${railwayUrl}`);

  const init: RequestInit = {
    method: req.method,
    headers: {
      "Content-Type": req.headers.get("content-type") ?? "application/json",
      "User-Agent": "P2PCLAW-Beta-Proxy/2.0",
    },
    redirect: "manual",
  };

  // Forward body if present
  if (req.method !== "GET" && req.method !== "HEAD") {
    try {
      init.body = await req.text();
    } catch {
      // no body
    }
  }

  try {
    const res = await fetch(railwayUrl, init);
    
    // Handle redirects
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (location) {
        // If redirecting to an absolute URL on same host, keep it relative
        const targetUrl = new URL(location, railwayUrl);
        if (targetUrl.origin === new URL(RAILWAY).origin) {
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

    return new NextResponse(blob, {
      status: res.status,
      headers: headers,
    });
  } catch (error) {
    console.error("[PROXY ERROR]", error);
    return NextResponse.json({ error: "Railway unreachable" }, { status: 503 });
  }
}
