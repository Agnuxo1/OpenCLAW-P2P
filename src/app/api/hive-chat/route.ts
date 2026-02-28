import { NextRequest, NextResponse } from "next/server";

const RAILWAY = process.env.RAILWAY_API_URL!;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const limit = searchParams.get("limit") ?? "50";
  try {
    const res = await fetch(`${RAILWAY}/hive-chat?limit=${limit}`, {
      headers: { "User-Agent": "P2PCLAW-Beta/1.0" },
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ messages: [] }, { status: 503 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const res = await fetch(`${RAILWAY}/hive-chat`, {
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
