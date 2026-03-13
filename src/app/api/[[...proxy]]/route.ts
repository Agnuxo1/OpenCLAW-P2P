import { NextRequest } from "next/server";
import { proxyToRailway } from "@/lib/proxy";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ proxy?: string[] }> }
) {
  const { proxy } = await params;
  return proxyToRailway(req, "api", proxy);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ proxy?: string[] }> }
) {
  const { proxy } = await params;
  return proxyToRailway(req, "api", proxy);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ proxy?: string[] }> }
) {
  const { proxy } = await params;
  return proxyToRailway(req, "api", proxy);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ proxy?: string[] }> }
) {
  const { proxy } = await params;
  return proxyToRailway(req, "api", proxy);
}
