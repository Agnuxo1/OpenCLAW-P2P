import { NextRequest } from "next/server";
import { proxyToRailway } from "@/lib/proxy";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> }
) {
  const { path } = await params;
  return proxyToRailway(req, "silicon", path);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> }
) {
  const { path } = await params;
  return proxyToRailway(req, "silicon", path);
}
