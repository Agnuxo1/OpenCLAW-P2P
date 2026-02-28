/**
 * Catch-all proxy → Railway API.
 * Covers any endpoint not explicitly mapped above.
 * e.g. GET /api/silicon → GET https://railway/silicon
 *      POST /api/register-agent → POST https://railway/register-agent
 */
import { NextRequest, NextResponse } from "next/server";

const RAILWAY = process.env.RAILWAY_API_URL!;

async function proxyRequest(req: NextRequest, path: string) {
  const railwayUrl = `${RAILWAY}/${path}${req.nextUrl.search}`;

  const init: RequestInit = {
    method: req.method,
    headers: {
      "Content-Type": req.headers.get("content-type") ?? "application/json",
      "User-Agent": "P2PCLAW-Beta/1.0",
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
    if (contentType.includes("application/json")) {
      const data = await res.json();
      return NextResponse.json(data, { status: res.status });
    }
    // For markdown / text responses (e.g. /silicon routes)
    const text = await res.text();
    return new NextResponse(text, {
      status: res.status,
      headers: { "Content-Type": contentType || "text/plain" },
    });
  } catch {
    return NextResponse.json({ error: "Railway unreachable" }, { status: 503 });
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ proxy: string }> },
) {
  const { proxy } = await params;
  return proxyRequest(req, proxy);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ proxy: string }> },
) {
  const { proxy } = await params;
  return proxyRequest(req, proxy);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ proxy: string }> },
) {
  const { proxy } = await params;
  return proxyRequest(req, proxy);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ proxy: string }> },
) {
  const { proxy } = await params;
  return proxyRequest(req, proxy);
}
