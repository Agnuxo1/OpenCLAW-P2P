/**
 * PaperClaw API Handler for Lobe Chat Plugin
 * =============================================
 * Serverless function that proxies requests to the PaperClaw API.
 * Deploy to Vercel, Cloudflare Workers, or any serverless platform.
 *
 * Installation:
 *   1. npm init -y && npm install
 *   2. Deploy to Vercel:  vercel deploy
 *   3. Update paperclaw-plugin.json URLs with your deployment domain
 *
 * Routes:
 *   POST /api/paperclaw/register    -> /quick-join
 *   POST /api/paperclaw/search      -> /lab/search-arxiv
 *   POST /api/paperclaw/tribunal    -> /tribunal/present
 *   POST /api/paperclaw/experiment  -> /lab/run-code
 *   POST /api/paperclaw/publish     -> /publish-paper
 */

const PAPERCLAW_API_BASE =
  "https://www.p2pclaw.com/api";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface RegisterRequest {
  agentId: string;
  name: string;
}

interface SearchRequest {
  query: string;
}

interface TribunalRequest {
  agentId: string;
  topic: string;
  evidence?: Record<string, unknown>;
}

interface ExperimentRequest {
  agentId: string;
  code: string;
  language?: string;
}

interface PublishRequest {
  title: string;
  content: string;
  author?: string;
  agentId: string;
  tribunal_clearance?: string;
}

// ---------------------------------------------------------------------------
// Proxy helper
// ---------------------------------------------------------------------------
async function proxyToApi(
  path: string,
  method: "GET" | "POST",
  body?: Record<string, unknown>,
  params?: Record<string, string>
): Promise<Response> {
  const url = new URL(`${PAPERCLAW_API_BASE}${path}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }

  try {
    const resp = await fetch(url.toString(), {
      method,
      headers: { "Content-Type": "application/json" },
      body: method === "POST" && body ? JSON.stringify(body) : undefined,
    });

    const data = await resp.json();
    return new Response(JSON.stringify(data), {
      status: resp.status,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: String(error) }),
      {
        status: 502,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

// ---------------------------------------------------------------------------
// Route handlers
// ---------------------------------------------------------------------------

/** POST /api/paperclaw/register */
export async function registerAgent(req: Request): Promise<Response> {
  const body = (await req.json()) as RegisterRequest;
  return proxyToApi("/quick-join", "POST", {
    agentId: body.agentId,
    name: body.name,
    type: "research-agent",
  });
}

/** POST /api/paperclaw/search */
export async function searchArxiv(req: Request): Promise<Response> {
  const body = (await req.json()) as SearchRequest;
  return proxyToApi("/lab/search-arxiv", "GET", undefined, {
    q: body.query,
  });
}

/** POST /api/paperclaw/tribunal */
export async function presentToTribunal(req: Request): Promise<Response> {
  const body = (await req.json()) as TribunalRequest;
  return proxyToApi("/tribunal/present", "POST", {
    agentId: body.agentId,
    topic: body.topic,
    evidence: body.evidence || {},
  });
}

/** POST /api/paperclaw/experiment */
export async function runExperiment(req: Request): Promise<Response> {
  const body = (await req.json()) as ExperimentRequest;
  return proxyToApi("/lab/run-code", "POST", {
    agentId: body.agentId,
    code: body.code,
    language: body.language || "python",
  });
}

/** POST /api/paperclaw/publish */
export async function publishPaper(req: Request): Promise<Response> {
  const body = (await req.json()) as PublishRequest;
  return proxyToApi("/publish-paper", "POST", {
    title: body.title,
    content: body.content,
    author: body.author || "PaperClaw-LobeChat",
    agentId: body.agentId,
    tribunal_clearance: body.tribunal_clearance || "",
  });
}

// ---------------------------------------------------------------------------
// Vercel serverless entry point (also works with other platforms)
// ---------------------------------------------------------------------------
export default async function handler(req: Request): Promise<Response> {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  const url = new URL(req.url);
  const path = url.pathname;

  if (path.endsWith("/register")) return registerAgent(req);
  if (path.endsWith("/search")) return searchArxiv(req);
  if (path.endsWith("/tribunal")) return presentToTribunal(req);
  if (path.endsWith("/experiment")) return runExperiment(req);
  if (path.endsWith("/publish")) return publishPaper(req);

  return new Response(
    JSON.stringify({
      error: "Unknown route",
      available: ["/register", "/search", "/tribunal", "/experiment", "/publish"],
    }),
    { status: 404, headers: { "Content-Type": "application/json" } }
  );
}
