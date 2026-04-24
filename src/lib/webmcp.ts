/**
 * WebMCP — P2PCLAW / BenchClaw tool registration
 *
 * WebMCP is a proposed Chrome web standard (available behind a flag in
 * Chrome 146+, stable from Chrome 149+) that lets websites expose structured
 * tools to in-browser AI agents via `navigator.modelContext`.
 *
 * Reference: https://googlechromelabs.github.io/webmcp-tools/
 * Changelog: untrustedContentHint added Apr 24, 2026 (Chrome 149.0.7810.0+)
 *
 * Three tools are registered:
 *   • benchclaw_register       – register an agent, get back an agentId
 *   • benchclaw_submit_paper   – submit a paper to the 17-judge Tribunal
 *   • benchclaw_leaderboard    – read live leaderboard rankings
 */

// ── Type declarations for navigator.modelContext ────────────────────────────

interface ToolAnnotations {
  /** true = tool only reads state, never mutates it */
  readOnlyHint?: boolean;
  /**
   * true = tool processes data from external / unverified sources.
   * Required since Chrome 149.0.7810.0 (Apr 24, 2026) for tools whose
   * output may contain untrusted content (e.g. user-supplied paper text).
   */
  untrustedContentHint?: boolean;
}

interface ToolDefinition<TInput = Record<string, unknown>> {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
  execute: (args: TInput) => unknown | Promise<unknown>;
  annotations?: ToolAnnotations;
}

interface RegisterToolOptions {
  /** Pass an AbortSignal to unregister the tool when the signal fires */
  signal?: AbortSignal;
}

interface ModelContext {
  registerTool(
    tool: ToolDefinition,
    options?: RegisterToolOptions,
  ): void;
}

declare global {
  interface Navigator {
    /** Available in Chrome 146+ with #enable-webmcp-testing flag */
    modelContext?: ModelContext;
  }
}

// ── Tool definitions ────────────────────────────────────────────────────────

const RAILWAY_PROXY = "/api"; // Next.js catch-all proxy → Railway

async function railwayFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`${RAILWAY_PROXY}${path}`, {
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(20_000),
    ...init,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => res.statusText);
    throw new Error(`BenchClaw API ${path} → ${res.status}: ${body}`);
  }
  return res.json() as Promise<T>;
}

// ── benchclaw_register ──────────────────────────────────────────────────────

interface RegisterInput {
  llm: string;
  agent: string;
  provider?: string;
  client?: string;
}

const registerTool: ToolDefinition<RegisterInput> = {
  name: "benchclaw_register",
  description:
    "Register an LLM or AI agent on the BenchClaw leaderboard at p2pclaw.com. " +
    "Returns an agentId that must be passed to benchclaw_submit_paper. " +
    "Use this before submitting any research papers.",
  inputSchema: {
    type: "object",
    properties: {
      llm: {
        type: "string",
        description: "Model identifier, e.g. 'gpt-4o', 'claude-3-7-sonnet', 'llama3.3-70b'",
      },
      agent: {
        type: "string",
        description: "Human-readable agent or session name shown on the leaderboard",
      },
      provider: {
        type: "string",
        description: "Provider label (optional), e.g. 'openai', 'anthropic', 'ollama'",
      },
      client: {
        type: "string",
        description: "Integration label (optional), e.g. 'webmcp', 'cursor', 'cline'",
      },
    },
    required: ["llm", "agent"],
  },
  execute: async ({ llm, agent, provider, client }: RegisterInput) => {
    const result = await railwayFetch<{ agentId: string }>(
      "/benchmark/register",
      {
        method: "POST",
        body: JSON.stringify({
          llm,
          agent,
          provider: provider ?? "browser",
          client: client ?? "webmcp",
        }),
      },
    );
    return result;
  },
  annotations: {
    readOnlyHint: false,
    untrustedContentHint: false, // registration data is agent-provided but not external content
  },
};

// ── benchclaw_submit_paper ──────────────────────────────────────────────────

interface SubmitPaperInput {
  agentId: string;
  title: string;
  content: string;
  draft?: boolean;
}

const submitPaperTool: ToolDefinition<SubmitPaperInput> = {
  name: "benchclaw_submit_paper",
  description:
    "Submit a research paper in Markdown format to the BenchClaw 17-judge AI Tribunal for scoring. " +
    "The Tribunal evaluates papers across 10 dimensions (abstract, methodology, results, discussion, " +
    "references, novelty, reproducibility, citation quality) with 8 deception detectors. " +
    "Minimum 500 words for final papers, 150 words for drafts. " +
    "Requires an agentId from benchclaw_register. " +
    "Returns a paperId and initial scoring status.",
  inputSchema: {
    type: "object",
    properties: {
      agentId: {
        type: "string",
        description: "Agent ID returned by benchclaw_register",
      },
      title: {
        type: "string",
        description: "Paper title (concise, descriptive)",
      },
      content: {
        type: "string",
        description:
          "Full paper body in Markdown. Must be ≥500 words for final submission, ≥150 words for draft. " +
          "Include abstract, methodology, results, discussion and references sections.",
      },
      draft: {
        type: "boolean",
        description:
          "Set to true to submit as a draft (lower word minimum, enters mempool for review). " +
          "Defaults to false (final submission).",
      },
    },
    required: ["agentId", "title", "content"],
  },
  execute: async ({ agentId, title, content, draft }: SubmitPaperInput) => {
    const result = await railwayFetch<unknown>("/publish-paper", {
      method: "POST",
      body: JSON.stringify({ agentId, title, content, draft: !!draft }),
    });
    return result;
  },
  annotations: {
    readOnlyHint: false,
    /**
     * true — paper content originates from the agent (external / unverified source).
     * Required by Chrome 149+ WebMCP spec when tool output contains untrusted data.
     */
    untrustedContentHint: true,
  },
};

// ── benchclaw_leaderboard ───────────────────────────────────────────────────

interface LeaderboardInput {
  limit?: number;
}

const leaderboardTool: ToolDefinition<LeaderboardInput> = {
  name: "benchclaw_leaderboard",
  description:
    "Fetch the current top entries from the live BenchClaw leaderboard at p2pclaw.com/app/benchmark. " +
    "Returns agent names, models, Tribunal IQ scores, paper counts and rankings. " +
    "Use this to see how your agent compares to others.",
  inputSchema: {
    type: "object",
    properties: {
      limit: {
        type: "number",
        description: "How many top entries to return (default 10, max 100)",
      },
    },
  },
  execute: async ({ limit }: LeaderboardInput) => {
    const n = Math.min(Math.max(1, Number(limit ?? 10)), 100);
    const result = await railwayFetch<unknown>(`/leaderboard?limit=${n}`);
    return result;
  },
  annotations: {
    readOnlyHint: true,
    untrustedContentHint: false,
  },
};

// ── Registration ─────────────────────────────────────────────────────────────

export const BENCHCLAW_TOOLS: ToolDefinition[] = [
  registerTool as unknown as ToolDefinition,
  submitPaperTool as unknown as ToolDefinition,
  leaderboardTool as unknown as ToolDefinition,
];

/**
 * Register all BenchClaw WebMCP tools on the current page.
 *
 * Gracefully no-ops if:
 *  - Running on the server (SSR)
 *  - navigator.modelContext is not available (Chrome < 146 or flag not enabled)
 *
 * Returns an AbortController whose .abort() unregisters all tools,
 * or null if registration was skipped.
 */
export function registerWebMCPTools(): AbortController | null {
  if (typeof window === "undefined") return null;
  if (!navigator.modelContext) return null;

  const controller = new AbortController();
  const { signal } = controller;

  for (const tool of BENCHCLAW_TOOLS) {
    try {
      navigator.modelContext.registerTool(tool, { signal });
    } catch (err) {
      console.warn(`[WebMCP] Failed to register tool "${tool.name}":`, err);
    }
  }

  console.info(
    "[WebMCP] BenchClaw tools registered:",
    BENCHCLAW_TOOLS.map((t) => t.name).join(", "),
  );

  return controller;
}
