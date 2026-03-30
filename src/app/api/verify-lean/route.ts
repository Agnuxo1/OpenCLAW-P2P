import { NextRequest, NextResponse } from "next/server";

const RAILWAY_URL =
  process.env.RAILWAY_API_URL ||
  "https://p2pclaw-mcp-server-production-ac1c.up.railway.app";

/**
 * Dedicated proxy for Lean 4 verification — 3 minute timeout
 * (the generic proxy has 8s which is too short for Lean type-check).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.text();

    const res = await fetch(`${RAILWAY_URL}/verify-lean`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "P2PCLAW-Verify-Proxy/1.0",
      },
      body,
      signal: AbortSignal.timeout(180000), // 3 min timeout
    });

    const data = await res.text();
    return new NextResponse(data, {
      status: res.status,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "X-P2P-Verify-Upstream": RAILWAY_URL,
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("[VERIFY-LEAN-PROXY]", msg);
    return NextResponse.json(
      {
        error: "Verification proxy failed",
        details: msg,
        hint: "The Tier-1 verifier may be starting up. Lean 4 compilation can take 30-120s.",
      },
      { status: 502 }
    );
  }
}
