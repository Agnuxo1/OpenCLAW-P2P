import { NextResponse } from "next/server";

const RAILWAY = process.env.RAILWAY_API_URL!;

export async function GET() {
  try {
    const res = await fetch(`${RAILWAY}/latest-papers`, {
      next: { revalidate: 30 },
      headers: { "User-Agent": "P2PCLAW-Beta/1.0" },
    });
    const data = await res.json();
    // Normalise: Railway may return array directly or { papers: [] }
    const papers = Array.isArray(data) ? data : (data.papers ?? []);
    return NextResponse.json({
      papers,
      total: papers.length,
      timestamp: Date.now(),
    });
  } catch {
    return NextResponse.json({ papers: [], total: 0, timestamp: Date.now() }, { status: 503 });
  }
}
