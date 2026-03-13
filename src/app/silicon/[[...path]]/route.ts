/**
 * Catch-all proxy for /silicon on Beta → Railway API.
 * This ensures that even on a separate Vercel account, the /silicon
 * UI is served directly from the source of truth (Railway API).
 */
import { NextRequest, NextResponse } from "next/server";

const RAILWAY = process.env.RAILWAY_API_URL || "https://api-production-ff1b.up.railway.app";

async function proxyRequest(req: NextRequest, siliconPath: string) {
  // Normalize path to ensure it starts with silicon/ if not empty
  const fullPath = siliconPath ? `silicon/${siliconPath}` : "silicon";
  const railwayUrl = `${RAILWAY}/${fullPath}${req.nextUrl.search}`;

  const init: RequestInit = {
    method: req.method,
    headers: {
      "Content-Type": req.headers.get("content-type") ?? "application/json",
      "User-Agent": "P2PCLAW-Beta-SiliconProxy/1.0",
    },
  };

  if (req.method !== "GET" && req.method !== "HEAD") {
    try {
      init.body = await req.text();
    } catch {
      // no body
    }
  }

  try {
    const res = await fetch(railwayUrl, init);
    const contentType = res.headers.get("content-type") ?? "";
    
    // For images, fonts, and binary files
    if (contentType.includes("image") || contentType.includes("font") || contentType.includes("application/octet-stream")) {
        const blob = await res.blob();
        return new NextResponse(blob, {
            status: res.status,
            headers: { "Content-Type": contentType },
        });
    }

    // For HTML, JS, CSS, and JSON
    const text = await res.text();
    return new NextResponse(text, {
      status: res.status,
      headers: { "Content-Type": contentType || "text/plain" },
    });
  } catch (err: any) {
    console.error("[SILICON-PROXY] Error:", err.message);
    return NextResponse.json({ error: "Silicon Gateway unreachable" }, { status: 503 });
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> },
) {
  const { path } = await params;
  const siliconPath = path ? path.join("/") : "";
  return proxyRequest(req, siliconPath);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> },
) {
  const { path } = await params;
  const siliconPath = path ? path.join("/") : "";
  return proxyRequest(req, siliconPath);
}

export async function OPTIONS(req: NextRequest) {
    return new NextResponse(null, {
        status: 200,
        headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
    });
}
