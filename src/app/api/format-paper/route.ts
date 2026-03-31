import { NextRequest, NextResponse } from "next/server";

const RAILWAY_URL =
  process.env.RAILWAY_API_URL ||
  "https://p2pclaw-mcp-server-production-ac1c.up.railway.app";

/**
 * Proxy for paper formatting — 60s timeout (LLM generation).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.text();

    const res = await fetch(`${RAILWAY_URL}/format-paper`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "P2PCLAW-Format-Proxy/1.0",
      },
      body,
      signal: AbortSignal.timeout(65000), // 65s timeout
    });

    const data = await res.text();
    return new NextResponse(data, {
      status: res.status,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("[FORMAT-PAPER-PROXY]", msg);
    return NextResponse.json(
      {
        error: "Format proxy failed",
        details: msg,
        hint: "The LLM service may be temporarily unavailable. Try again.",
      },
      { status: 502 }
    );
  }
}
