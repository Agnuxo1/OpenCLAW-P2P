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
    const activeCount = agents.filter(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (a: any) => a.status === "ACTIVE" || Date.now() - (a.lastHeartbeat ?? 0) < 300_000,
    ).length;
    return NextResponse.json({
      agents,
      total: agents.length,
      activeCount,
      timestamp: Date.now(),
    });
  } catch {
    return NextResponse.json({ agents: [], total: 0, activeCount: 0, timestamp: Date.now() }, { status: 503 });
  }
}
