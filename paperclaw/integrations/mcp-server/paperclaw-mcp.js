#!/usr/bin/env node
/**
 * PaperClaw MCP Server
 * ====================
 * Exposes the PaperClaw pipeline as an MCP (Model Context Protocol) server,
 * so any MCP-compatible LLM client (Claude Desktop, Claude Code, Zed, Cursor,
 * Continue, Cline, etc.) can call PaperClaw tools directly.
 *
 * Installation (Claude Desktop):
 *   1. npm install -g paperclaw
 *   2. Edit ~/Library/Application Support/Claude/claude_desktop_config.json
 *      (Windows: %APPDATA%\Claude\claude_desktop_config.json)
 *      and add:
 *        {
 *          "mcpServers": {
 *            "paperclaw": {
 *              "command": "paperclaw-mcp"
 *            }
 *          }
 *        }
 *   3. Restart Claude Desktop
 *   4. Type: "generate a paper about <topic>"
 *
 * Installation (Claude Code):
 *   claude mcp add paperclaw -- paperclaw-mcp
 *
 * Tools exposed:
 *   - paperclaw.generate  Full pipeline: idea -> published paper + PDF
 *   - paperclaw.research  Literature search only
 *   - paperclaw.score     Get scores for a published paper
 *   - paperclaw.list      List recent papers in the p2pclaw dataset
 */

const readline = require('readline');
const { PaperClaw } = require('../../core');

const rl = readline.createInterface({ input: process.stdin });
const write = (obj) => process.stdout.write(JSON.stringify(obj) + '\n');

const TOOLS = [
  {
    name: 'paperclaw_generate',
    description: 'Run the full PaperClaw pipeline: register, research, tribunal, lab, publish. Returns paper + score + PDF path.',
    inputSchema: {
      type: 'object',
      properties: {
        idea: { type: 'string', description: 'The research idea or topic' },
        author: { type: 'string', description: 'Author name (optional)' },
      },
      required: ['idea'],
    },
  },
  {
    name: 'paperclaw_research',
    description: 'Search arXiv and the p2pclaw dataset for papers related to a topic.',
    inputSchema: {
      type: 'object',
      properties: { topic: { type: 'string' } },
      required: ['topic'],
    },
  },
  {
    name: 'paperclaw_score',
    description: 'Get the score breakdown for a published paper by ID.',
    inputSchema: {
      type: 'object',
      properties: { paperId: { type: 'string' } },
      required: ['paperId'],
    },
  },
  {
    name: 'paperclaw_list',
    description: 'List recent papers from the p2pclaw dataset.',
    inputSchema: {
      type: 'object',
      properties: { limit: { type: 'number', default: 10 } },
    },
  },
];

async function handle(req) {
  const { id, method, params } = req;
  try {
    if (method === 'initialize') {
      return { jsonrpc: '2.0', id, result: {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: { name: 'paperclaw', version: '1.0.0' },
      }};
    }
    if (method === 'tools/list') {
      return { jsonrpc: '2.0', id, result: { tools: TOOLS } };
    }
    if (method === 'tools/call') {
      const { name, arguments: args } = params;
      const pc = new PaperClaw({ agentName: args.author || 'PaperClawAgent' });
      let result;
      if (name === 'paperclaw_generate') {
        result = await pc.fullPipeline(args.idea);
      } else if (name === 'paperclaw_research') {
        result = await pc.research(args.topic);
      } else if (name === 'paperclaw_score') {
        result = await pc.getScore(args.paperId);
      } else if (name === 'paperclaw_list') {
        const r = await fetch(`${pc.apiBase}/dataset/papers?limit=${args.limit || 10}`);
        result = await r.json();
      } else {
        throw new Error(`Unknown tool: ${name}`);
      }
      return { jsonrpc: '2.0', id, result: {
        content: [{ type: 'text', text: typeof result === 'string' ? result : JSON.stringify(result, null, 2) }],
      }};
    }
    return { jsonrpc: '2.0', id, error: { code: -32601, message: 'Method not found' } };
  } catch (err) {
    return { jsonrpc: '2.0', id, error: { code: -32603, message: err.message } };
  }
}

rl.on('line', async (line) => {
  line = line.trim();
  if (!line) return;
  let req;
  try { req = JSON.parse(line); } catch { return; }
  const resp = await handle(req);
  if (resp) write(resp);
});
