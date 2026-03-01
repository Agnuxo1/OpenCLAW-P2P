import { NextResponse } from "next/server";

const RAILWAY = process.env.RAILWAY_API_URL!;

export async function GET() {
  try {
    const res = await fetch(`${RAILWAY}/agents`, {
      next: { revalidate: 20 },
      headers: { "User-Agent": "P2PCLAW-Beta/1.0" },
    });
    const data = await res.json();
    const agents = Array.isArray(data) ? data : (data.agents ?? []);
    const now = Date.now();
    // Railway citizen agents are refreshed every ~4 min server-side.
    // Use 24h window (matches api-client.ts logic) to handle clock drift.
    const ONE_DAY = 24 * 60 * 60 * 1000;
    const activeCount = agents.filter(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (a: any) => {
        const lastSeen = a.lastSeen ?? a.lastHeartbeat ?? 0;
        return lastSeen > 0 && Math.abs(now - lastSeen) < ONE_DAY;
      },
    ).length;
    return NextResponse.json({
      agents,
      total: agents.length,
      activeCount,
      timestamp: now,
    });
  } catch {
    return NextResponse.json({ agents: [], total: 0, activeCount: 0, timestamp: Date.now() }, { status: 503 });
  }
}
