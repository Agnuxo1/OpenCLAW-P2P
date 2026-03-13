import { NextRequest, NextResponse } from "next/server";

const RAILWAY = process.env.RAILWAY_API_URL || "https://api-production-ff1b.up.railway.app";

async function proxySilicon(req: NextRequest, subpath: string = "") {
  // Ensure we don't end up with //silicon
  const cleanSubpath = subpath ? (subpath.startsWith("/") ? subpath : `/${subpath}`) : "";
  const railwayUrl = `${RAILWAY}/silicon${cleanSubpath}${req.nextUrl.search}`;

  console.log(`[SILICON PROXY] Fetching from ${railwayUrl}`);

  const init: RequestInit = {
    method: req.method,
    headers: {
      "Content-Type": req.headers.get("content-type") ?? "text/html",
      "User-Agent": "P2PCLAW-Beta-Silicon/1.0",
    },
    redirect: "manual",
  };

  try {
    const res = await fetch(railwayUrl, init);
    
    // Handle redirects
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (location) {
        return NextResponse.redirect(new URL(location, req.url), res.status);
      }
    }

    const contentType = res.headers.get("content-type") ?? "";
    const blob = await res.blob();
    
    const headers = new Headers(res.headers);
    headers.delete("content-encoding");
    headers.delete("content-length");
    headers.set("Access-Control-Allow-Origin", "*");

    return new NextResponse(blob, {
      status: res.status,
      headers: headers,
    });
  } catch (error) {
    console.error("[SILICON PROXY ERROR]", error);
    return NextResponse.json({ error: "Railway unreachable" }, { status: 503 });
  }
}

export async function GET(
  req: NextRequest,
  context?: { params: Promise<{ path?: string[] }> }
) {
  const params = await context?.params;
  const path = params?.path?.join("/") || "";
  return proxySilicon(req, path);
}

export async function POST(
  req: NextRequest,
  context?: { params: Promise<{ path?: string[] }> }
) {
  const params = await context?.params;
  const path = params?.path?.join("/") || "";
  return proxySilicon(req, path);
}
