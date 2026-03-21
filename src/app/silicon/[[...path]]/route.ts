import { NextRequest, NextResponse } from "next/server";
import { proxyToRailway } from "@/lib/proxy";
import fs from "fs";
import path from "path";

// Browser requests → serve the static silicon HTML shell from /public/silicon/
// The shell loads silicon.js which tries all gateways + falls back to embedded static content.
// Agent requests (Accept: text/markdown) → proxy to Railway as usual.
function isBrowserRequest(req: NextRequest) {
  const accept = req.headers.get("accept") ?? "";
  return accept.includes("text/html");
}

function serveStaticSiliconHtml(segments: string[] = []): NextResponse | null {
  const sub = segments.length > 0 ? segments[0] : "";
  const htmlPath = sub
    ? path.join(process.cwd(), "public", "silicon", sub, "index.html")
    : path.join(process.cwd(), "public", "silicon", "index.html");

  if (fs.existsSync(htmlPath)) {
    const html = fs.readFileSync(htmlPath, "utf-8");
    return new NextResponse(html, {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }
  return null;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> }
) {
  const { path: segments } = await params;

  // Browser → serve static HTML shell (resilient to Railway being down)
  if (isBrowserRequest(req)) {
    const staticResponse = serveStaticSiliconHtml(segments);
    if (staticResponse) return staticResponse;
  }

  // Agent / fallback → proxy to Railway
  return proxyToRailway(req, "silicon", segments);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> }
) {
  const { path: segments } = await params;
  return proxyToRailway(req, "silicon", segments);
}
