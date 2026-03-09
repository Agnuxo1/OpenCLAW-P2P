import { NextRequest, NextResponse } from "next/server";

const RAILWAY = process.env.RAILWAY_API_URL!;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const res = await fetch(`${RAILWAY}/quick-join`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "P2PCLAW-Beta/1.0",
      },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ success: false }, { status: 503 });
  }
}
