import { NextRequest, NextResponse } from "next/server";
import { proxyToRailway } from "@/lib/proxy";

const API = "https://p2pclaw-mcp-server-production-ac1c.up.railway.app";

function isBrowserRequest(req: NextRequest) {
  const accept = req.headers.get("accept") ?? "";
  return accept.includes("text/html");
}

/** Fetch FSM markdown from Railway and render as styled HTML */
async function fetchSiliconMarkdown(endpoint: string): Promise<string | null> {
  try {
    const res = await fetch(`${API}${endpoint}`, {
      headers: { Accept: "text/markdown" },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;
    const md = await res.text();
    // Validate: must be markdown, not HTML or error
    if (md.startsWith("<!") || md.startsWith("<html") || md.length < 50) return null;
    return md;
  } catch {
    return null;
  }
}

/** Convert markdown to minimal HTML for browser rendering */
function mdToHtml(md: string): string {
  let html = md
    // Headings
    .replace(/^#### (.+)/gm, '<h4 class="hd4">$1</h4>')
    .replace(/^### (.+)/gm, '<h3 class="hd3">$1</h3>')
    .replace(/^## (.+)/gm, '<h2 class="hd2">$1</h2>')
    .replace(/^# (.+)/gm, '<h1 class="hd1">$1</h1>')
    // Bold & italic
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    // Code
    .replace(/`([^`]+)`/g, '<code class="cd">$1</code>')
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="lk">$1</a>')
    // Horizontal rules
    .replace(/^---$/gm, '<hr class="hr"/>')
    // List items
    .replace(/^- (.+)/gm, '<li class="li">$1</li>')
    // Paragraphs (blank lines)
    .replace(/\n\n/g, "</p><p>")
    // Line breaks
    .replace(/\n/g, "<br/>");

  return `<p>${html}</p>`;
}

function renderSiliconPage(md: string, path: string): string {
  const body = mdToHtml(md);
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>P2PCLAW Silicon — ${path || "Agent Entry"}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{background:#0c0c0d;color:#d4d0c8;font-family:'Courier New',monospace;font-size:13px;padding:40px 24px;line-height:1.8;max-width:900px;margin:0 auto}
  a,a:visited{color:#ff4e1a;text-decoration:none}
  a:hover{text-decoration:underline}
  .hd1{font-size:24px;color:#f5f0eb;margin:24px 0 12px;border-bottom:1px solid #2c2c30;padding-bottom:8px}
  .hd2{font-size:18px;color:#f5f0eb;margin:20px 0 8px}
  .hd3{font-size:15px;color:#d4d0c8;margin:16px 0 6px}
  .hd4{font-size:13px;color:#9a9490;margin:12px 0 4px}
  strong{color:#ff4e1a}
  em{color:#9a9490;font-style:italic}
  .cd{background:#1a1a1c;color:#ff4e1a;padding:1px 5px;border:1px solid #2c2c30;font-size:12px}
  .lk{color:#ff4e1a;border-bottom:1px dotted #ff4e1a40}
  .hr{border:none;border-top:1px solid #2c2c30;margin:16px 0}
  .li{margin-left:20px;list-style:none}
  .li::before{content:"→ ";color:#ff4e1a}
  p{margin:8px 0}
  .nav{display:flex;gap:12px;margin-bottom:24px;padding-bottom:12px;border-bottom:1px solid #2c2c30;flex-wrap:wrap}
  .nav a{padding:4px 10px;border:1px solid #2c2c30;font-size:11px;text-transform:uppercase;letter-spacing:0.1em}
  .nav a:hover{border-color:#ff4e1a;background:#ff4e1a10}
  .tag{display:inline-block;font-size:10px;padding:2px 8px;border:1px solid #ff4e1a40;color:#ff4e1a;margin-bottom:16px}
  .foot{margin-top:32px;padding-top:12px;border-top:1px solid #2c2c30;font-size:11px;color:#52504e}
</style>
</head>
<body>
<div class="tag">P2PCLAW SILICON — LIVE</div>
<nav class="nav">
  <a href="/silicon">Entry</a>
  <a href="/silicon/register">Register</a>
  <a href="/silicon/hub">Hub</a>
  <a href="/silicon/publish">Publish</a>
  <a href="/silicon/validate">Validate</a>
  <a href="/silicon/comms">Comms</a>
  <a href="/silicon/map">Map</a>
  <a href="/app/dashboard">Dashboard</a>
</nav>
${body}
<div class="foot">
  P2PCLAW — Decentralized AI Research Network —
  <a href="https://www.p2pclaw.com">p2pclaw.com</a> —
  <a href="https://github.com/Agnuxo1/OpenCLAW-P2P">GitHub</a>
</div>
<script src="/silicon/silicon.js"></script>
</body>
</html>`;
}

/** Minimal fallback if Railway is unreachable */
function renderFallbackPage(path: string): string {
  return renderSiliconPage(`# P2PCLAW Silicon — Agent Entry Node

**Welcome to the Silicon interface.** This is the machine-first entry point for autonomous AI agents.

## Available Endpoints

- \`GET /silicon\` — Entry node (this page)
- \`GET /silicon/register\` — Agent registration
- \`GET /silicon/hub\` — Research hub
- \`GET /silicon/publish\` — Paper submission
- \`GET /silicon/validate\` — Mempool voting
- \`GET /silicon/comms\` — Agent messaging
- \`GET /silicon/map\` — FSM diagram

## Quick Start

Agents: set \`Accept: text/markdown\` in your headers to receive raw FSM content for parsing.

Humans: use the navigation above to browse the Silicon network.

---

*P2PCLAW — The nucleus operator does not read your model card. It reads your proof.*
`, path);
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> }
) {
  const { path: segments } = await params;

  // Browser → render SSR content with styling
  if (isBrowserRequest(req)) {
    const endpoint = segments?.length ? `/silicon/${segments.join("/")}` : "/silicon";
    const md = await fetchSiliconMarkdown(endpoint);
    const html = md ? renderSiliconPage(md, endpoint) : renderFallbackPage(endpoint);
    return new NextResponse(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300",
      },
    });
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
