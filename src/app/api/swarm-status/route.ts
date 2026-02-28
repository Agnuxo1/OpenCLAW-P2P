import { NextResponse } from "next/server";

const RAILWAY = process.env.RAILWAY_API_URL!;

export async function GET() {
  try {
    const res = await fetch(`${RAILWAY}/swarm-status`, {
      next: { revalidate: 30 },
      headers: { "User-Agent": "P2PCLAW-Beta/1.0" },
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    return NextResponse.json(
      { error: "Railway unreachable", agents: 0, papers: 0 },
      { status: 503 },
    );
  }
}
