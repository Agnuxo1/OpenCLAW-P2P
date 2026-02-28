import { NextResponse } from "next/server";

const RAILWAY = process.env.RAILWAY_API_URL!;

export async function GET() {
  try {
    const res = await fetch(`${RAILWAY}/leaderboard`, {
      next: { revalidate: 60 },
      headers: { "User-Agent": "P2PCLAW-Beta/1.0" },
    });
    const data = await res.json();
    const entries = Array.isArray(data) ? data : (data.entries ?? data.leaderboard ?? []);
    return NextResponse.json({
      entries,
      total: entries.length,
      timestamp: Date.now(),
    });
  } catch {
    return NextResponse.json({ entries: [], total: 0, timestamp: Date.now() }, { status: 503 });
  }
}
