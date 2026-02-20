import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import crypto from "node:crypto"; // crypto is still needed here for sessionIdGenerator
import { gunSafe } from "../utils/gunUtils.js";

import { db } from "../config/gun.js";
import { updateAgentPresence } from "./agentService.js";
import { fetchHiveState, updateInvestigationProgress, sendToHiveChat } from "./hiveMindService.js";
import { publisher } from "./storageService.js";

// ── MCP Server Setup ──────────────────────────────────────────
const server = new Server(
  {
    name: "p2pclaw-mcp-server",
    version: "1.3.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Store active SSE transports by session ID
const transports = new Map();
const mcpSessions = new Map(); // sessionId → { transport, server }

const tools = [
  {
    name: "get_swarm_status",
    description: "Get real-time status of the P2PCLAW Hive Mind.",
  },
  {
    name: "hive_chat",
    description: "Send a message to the global P2PCLAW chat.",
    inputSchema: {
      type: "object",
      properties: { message: { type: "string" } },
      required: ["message"],
    },
  },
  {
    name: "publish_contribution",
    description: "Publish a research paper to P2P and permanent decentralized storage (IPFS).",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string" },
        content: { type: "string", description: "Markdown content" }
      },
      required: ["title", "content"],
    },
  },
];

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  
  if (name === "get_swarm_status") {
      const status = await fetchHiveState();
      return { content: [{ type: "text", text: JSON.stringify(status, null, 2) }] };
  }
  
  if (name === "hive_chat") {
      updateAgentPresence("MCP-Agent", "ai-agent");
      await sendToHiveChat("MCP-Agent", args.message);
      return { content: [{ type: "text", text: "Sent to Hive." }] };
  }

  if (name === "publish_contribution") {
      updateAgentPresence("MCP-Agent", "ai-agent");
      let ipfs_url = null;
      let cid = null;

      // Try IPFS — but never block publishing if it fails
      try {
          const storage = await publisher.publish(args.title, args.content, "MCP-Agent");
          ipfs_url = storage.html;
          cid = storage.cid;
      } catch (ipfsErr) {
          console.warn(`[MCP] IPFS Storage Failed: ${ipfsErr.message}. Storing in P2P mesh only.`);
      }

      // ALWAYS store to Gun.js P2P mesh (guaranteed delivery)
      const paperId = `paper-ipfs-${Date.now()}`;
      db.get("papers").get(paperId).put(gunSafe({
          title: args.title,
          content: args.content,
          ipfs_cid: cid,
          url_html: ipfs_url,
          author: "MCP-Agent",
          timestamp: Date.now()
      }));

      // Update investigation progress
      updateInvestigationProgress(args.title, args.content);

      const note = cid
          ? `Published successfully! CID: ${cid}
URL: ${ipfs_url}`
          : `Published to P2P mesh successfully! (IPFS archive pending — paper is live on p2pclaw.com/#papers)`;
      return { content: [{ type: "text", text: note }] };
  }

  return { content: [{ type: "text", text: "Tool not found" }], isError: true };
});

async function createMcpServerInstance() {
    const { Server: McpServer } = await import("@modelcontextprotocol/sdk/server/index.js");
    const s = new McpServer(
        { name: "p2pclaw-mcp-server", version: "1.3.0" },
        { capabilities: { tools: {} } }
    );
    s.setRequestHandler(ListToolsRequestSchema, async () => ({
        tools: [
            {
                name: "get_swarm_status",
                description: "Get real-time hive status: active agents, papers in La Rueda, mempool queue, active validators.",
                inputSchema: { type: "object", properties: {}, required: [] }
            },
            {
                name: "hive_chat",
                description: "Send a message to the global Hive chat.",
                inputSchema: {
                    type: "object",
                    properties: {
                        message: { type: "string", description: "Message text" },
                        sender: { type: "string", description: "Your agent ID" }
                    },
                    required: ["message"]
                }
            },
            {
                name: "publish_contribution",
                description: "Publish a scientific research paper (min 1500 words, 7 sections) to P2P + IPFS.",
                inputSchema: {
                    type: "object",
                    properties: {
                        title: { type: "string" },
                        content: { type: "string", description: "Markdown with 7 required sections" },
                        author: { type: "string" },
                        agentId: { type: "string" }
                    },
                    required: ["title", "content"]
                }
            }
        ]
    }));
    s.setRequestHandler(CallToolRequestSchema, async (req) => {
        const { name, arguments: args } = req.params;
        if (name === "get_swarm_status") {
            const state = await fetchHiveState().catch(() => ({ agents: [], papers: [] }));
            return { content: [{ type: "text", text: JSON.stringify({ active_agents: state.agents.length, papers_in_la_rueda: state.papers.length }) }] };
        }
        if (name === "hive_chat") {
            await sendToHiveChat(args.sender || "mcp-agent", args.message);
            return { content: [{ type: "text", text: JSON.stringify({ success: true }) }] };
        }
        if (name === "publish_contribution") {
            const paperId = `paper-${Date.now()}`;
            db.get("mempool").get(paperId).put(gunSafe({ ...args, status: "MEMPOOL", timestamp: Date.now() }));
            return { content: [{ type: "text", text: JSON.stringify({ success: true, paperId }) }] };
        }
        throw new Error(`Unknown tool: ${name}`);
    });
    return s;
}

export { server, transports, mcpSessions, createMcpServerInstance, SSEServerTransport, StreamableHTTPServerTransport, CallToolRequestSchema };