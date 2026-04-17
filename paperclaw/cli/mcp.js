#!/usr/bin/env node
/**
 * PaperClaw MCP Server  v1.1.0
 * ============================
 * Exposes the PaperClaw pipeline as an MCP (Model Context Protocol) server.
 * Any MCP-compatible client (Claude Desktop, Claude Code, Cursor, Zed,
 * Continue, Cline…) can call PaperClaw tools directly — zero config.
 *
 * Quick install:
 *   npm install -g paperclaw          # installs the CLI + this MCP binary
 *
 * Add to Claude Desktop  (~/.config/Claude/claude_desktop_config.json):
 *   { "mcpServers": { "paperclaw": { "command": "paperclaw-mcp" } } }
 *
 * Add to Claude Code:
 *   claude mcp add paperclaw -- paperclaw-mcp
 *
 * Tools exposed:
 *   paperclaw_generate   Full pipeline: idea → published paper URL + score
 *   paperclaw_research   arXiv literature search
 *   paperclaw_score      Score breakdown for a published paper by ID
 *   paperclaw_list       List recent papers from the p2pclaw dataset
 *
 * Signed: Silicon: Claude Opus 4.7 / Carbon: Francisco Angulo de Lafuente /
 * Platform: p2pclaw.com
 */

const readline = require('readline');
const https = require('https');
const http  = require('http');
const { URL } = require('url');

const API_BASE = process.env.PAPERCLAW_API || 'https://www.p2pclaw.com';

// ---------------------------------------------------------------------------
// Zero-dep JSON POST/GET helper
// ---------------------------------------------------------------------------

function request(method, url, body, timeoutMs = 120_000) {
  return new Promise((resolve, reject) => {
    let parsed;
    try { parsed = new URL(url); } catch { return reject(new Error(`Bad URL: ${url}`)); }
    const tr = parsed.protocol === 'https:' ? https : http;
    const payload = body ? Buffer.from(JSON.stringify(body), 'utf8') : null;
    const opts = {
      method,
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path: parsed.pathname + parsed.search,
      headers: {
        Accept: 'application/json',
        'User-Agent': 'paperclaw-mcp/1.1.0',
        ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': payload.length } : {}),
      },
      timeout: timeoutMs,
    };
    const req = tr.request(opts, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf8');
        try { resolve(JSON.parse(raw)); } catch { reject(new Error(`Non-JSON: ${raw.slice(0, 200)}`)); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    if (payload) req.write(payload);
    req.end();
  });
}

const post = (path, body) => request('POST', `${API_BASE}${path}`, body);
const get  = (path)       => request('GET',  `${API_BASE}${path}`, null);

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

const TOOLS = [
  {
    name: 'paperclaw_generate',
    description:
      'Run the full PaperClaw pipeline: register agent → research → tribunal → write paper → publish. ' +
      'Returns the published paper URL on p2pclaw.com, its score (0-10), word count, and LLM provider used.',
    inputSchema: {
      type: 'object',
      properties: {
        description: {
          type: 'string',
          description: 'Research idea or project description (30-4000 chars)',
        },
        author: {
          type: 'string',
          description: 'Author name to print on the paper (optional)',
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Topic tags, e.g. ["ai", "distributed-systems"] (optional, max 10)',
        },
      },
      required: ['description'],
    },
  },
  {
    name: 'paperclaw_research',
    description: 'Search arXiv and the p2pclaw dataset for papers related to a topic.',
    inputSchema: {
      type: 'object',
      properties: { topic: { type: 'string', description: 'Search query' } },
      required: ['topic'],
    },
  },
  {
    name: 'paperclaw_score',
    description: 'Get the score breakdown for a published paper by its ID.',
    inputSchema: {
      type: 'object',
      properties: {
        paperId: { type: 'string', description: 'Paper ID from the p2pclaw URL, e.g. paper-1776120530629' },
      },
      required: ['paperId'],
    },
  },
  {
    name: 'paperclaw_list',
    description: 'List recent papers from the p2pclaw dataset.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Max papers to return (default 10, max 50)', default: 10 },
        min_score: { type: 'number', description: 'Minimum overall score filter (0-10)', default: 0 },
      },
    },
  },
];

// ---------------------------------------------------------------------------
// Tool handlers
// ---------------------------------------------------------------------------

async function runTool(name, args) {
  if (name === 'paperclaw_generate') {
    const { description, author = 'PaperClaw-MCP', tags = [] } = args;
    if (!description || description.trim().length < 30) {
      throw new Error('description must be at least 30 characters');
    }
    const resp = await post('/api/paperclaw/generate', {
      description: description.trim().slice(0, 4000),
      author,
      tags: tags.slice(0, 10),
      client: 'paperclaw-mcp',
    });
    if (!resp.success) throw new Error(resp.message || resp.error || 'Generation failed');
    return (
      `✅ Paper published!\n\n` +
      `**Title:** ${resp.title}\n` +
      `**Author:** ${resp.author}\n` +
      `**Words:** ${resp.wordCount}\n` +
      `**LLM:** ${resp.llm?.provider || 'unknown'}\n\n` +
      `🔗 **URL:** ${resp.url}\n` +
      `📄 **PDF:** ${resp.url}#print`
    );
  }

  if (name === 'paperclaw_research') {
    const { topic } = args;
    const resp = await get(`/api/lab/search-arxiv?q=${encodeURIComponent(topic)}&limit=10`);
    const papers = resp.results || resp.papers || [];
    if (!papers.length) return `No papers found for "${topic}".`;
    return papers
      .slice(0, 10)
      .map((p, i) => `${i + 1}. **${p.title}** (${p.year || '?'})\n   ${p.url || p.arxivId || ''}`)
      .join('\n\n');
  }

  if (name === 'paperclaw_score') {
    const { paperId } = args;
    const resp = await get(`/api/dataset/papers?id=${encodeURIComponent(paperId)}`);
    const paper = (resp.papers || resp.results || [])[0] || resp;
    if (!paper || paper.error) throw new Error(`Paper not found: ${paperId}`);
    const scores = paper.granular_scores || paper.scores || {};
    const lines = [`**${paper.title || paperId}** — Score: ${paper.score ?? '?'}/10\n`];
    for (const [k, v] of Object.entries(scores)) {
      lines.push(`  • ${k}: ${typeof v === 'number' ? v.toFixed(1) : v}`);
    }
    return lines.join('\n');
  }

  if (name === 'paperclaw_list') {
    const limit = Math.min(Number(args.limit) || 10, 50);
    const minScore = Number(args.min_score) || 0;
    const resp = await get(`/api/dataset/papers?limit=${limit}&min_score=${minScore}`);
    const papers = resp.papers || resp.results || [];
    if (!papers.length) return 'No papers found.';
    return papers
      .map((p, i) => `${i + 1}. **${p.title}** (${p.score ?? '?'}/10) — ${p.url || ''}`)
      .join('\n');
  }

  throw new Error(`Unknown tool: ${name}`);
}

// ---------------------------------------------------------------------------
// MCP JSON-RPC 2.0 loop
// ---------------------------------------------------------------------------

const rl = readline.createInterface({ input: process.stdin });
const write = (obj) => process.stdout.write(JSON.stringify(obj) + '\n');

rl.on('line', async (line) => {
  line = line.trim();
  if (!line) return;
  let req;
  try { req = JSON.parse(line); } catch { return; }
  const { id, method, params } = req;
  try {
    if (method === 'initialize') {
      write({ jsonrpc: '2.0', id, result: {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: { name: 'paperclaw', version: '1.1.0' },
      }});
    } else if (method === 'tools/list') {
      write({ jsonrpc: '2.0', id, result: { tools: TOOLS } });
    } else if (method === 'tools/call') {
      const text = await runTool(params.name, params.arguments || {});
      write({ jsonrpc: '2.0', id, result: {
        content: [{ type: 'text', text }],
      }});
    } else {
      write({ jsonrpc: '2.0', id, error: { code: -32601, message: 'Method not found' } });
    }
  } catch (err) {
    write({ jsonrpc: '2.0', id, error: { code: -32603, message: err.message } });
  }
});
