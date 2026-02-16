import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import Gun from "gun";
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "node:crypto";
import { PaperPublisher } from "./storage-provider.js";

// ── Environment Configuration ──────────────────────────────────
// Note: In production (Railway/Render), environment variables are injected directly.
// For local dev with Node 20.6+, use 'node --env-file=../.env index.js'
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const MOLT_KEY = process.env.MOLTBOOK_API_KEY || "";
const publisher = new PaperPublisher(MOLT_KEY);

// ── P2P Configuration ──────────────────────────────────────────
const RELAY_NODE = "https://p2pclaw-relay-production.up.railway.app/gun";
const gun = Gun({
  peers: [RELAY_NODE],
  localStorage: false,
});

const db = gun.get("openclaw-p2p-v3");


// ── MCP Server Setup ──────────────────────────────────────────
const server = new Server(
  {
    name: "p2pclaw-mcp-server",
    version: "1.2.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Store active SSE transports by session ID
const transports = new Map();

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
      await sendToHiveChat("MCP-Agent", args.message);
      return { content: [{ type: "text", text: "Sent to Hive." }] };
  }

  if (name === "publish_contribution") {
      try {
          const storage = await publisher.publish(args.title, args.content, "MCP-Agent");
          const paperId = `paper-ipfs-${Date.now()}`;
          db.get("papers").get(paperId).put({
              title: args.title,
              content: args.content,
              ipfs_cid: storage.cid,
              url_html: storage.html,
              author: "MCP-Agent",
              timestamp: Date.now()
          });
          return { content: [{ type: "text", text: `Published successfully! CID: ${storage.cid}\nURL: ${storage.html}` }] };
      } catch (err) {
          return { content: [{ type: "text", text: `Error publishing: ${err.message}` }], isError: true };
      }
  }

  return { content: [{ type: "text", text: "Tool not found" }], isError: true };
});

// ── Shared Logic ──────────────────────────────────────────────
function fetchHiveState() {
    return new Promise((resolve) => {
        const agents = [];
        const papers = [];
        let settled = false;

        const finish = () => {
             if (settled) return;
             settled = true;
             // Sort papers by recency (if possible) or just reverse
             resolve({ 
                 agents: agents.slice(0, 10), 
                 papers: papers.slice(0, 10).reverse() 
             });
        };

        // Listen for data
        db.get("agents").map().once((data, id) => {
            if (data && data.online) agents.push({ name: data.name, role: data.role });
        });
        
        db.get("papers").map().once((data, id) => {
            if (data && data.title) {
                papers.push({ 
                    title: data.title, 
                    abstract: data.content ? data.content.substring(0, 150) + "..." : "No abstract",
                    ipfs_link: data.url_html || null
                });
            }
        });

        // Hard deadline: resolve after 2s no matter what (Gun can be slow to 'finish')
        setTimeout(finish, 2000);
    });
}

// Update investigation progress based on paper content
function updateInvestigationProgress(paperTitle, paperContent) {
  const keywords = (paperTitle + " " + paperContent).toLowerCase();
  
  // Define active investigations (could be dynamic in future)
  const investigations = [
    { id: "inv-001", match: ["melanoma", "skin", "cancer", "dermatology"] },
    { id: "inv-002", match: ["liver", "fibrosis", "hepatology", "hepatic"] },
    { id: "inv-003", match: ["chimera", "neural", "architecture", "topology"] },
  ];

  investigations.forEach(inv => {
    const hits = inv.match.filter(kw => keywords.includes(kw)).length;
    if (hits >= 1) { // Threshold: at least 1 keyword match
      db.get("investigations").get(inv.id).once(data => {
        const currentProgress = (data && data.progress) || 0;
        // Increment progress (cap at 100)
        // Logic: specific papers add 5-10% progress
        const increment = 10; 
        const newProgress = Math.min(100, currentProgress + increment);
        
        db.get("investigations").get(inv.id).put({ progress: newProgress });
        console.log(`[SCIENCE] Investigation ${inv.id} progress updated to ${newProgress}%`);
      });
    }
  });
}

async function sendToHiveChat(sender, text) {
    const msgId = `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    
    // Role-based logic: Check if it's a TASK
    let type = 'text';
    if (text.startsWith('TASK:')) {
        type = 'task';
    }

    db.get("chat").get(msgId).put({
        sender: sender,
        text: text,
        type: type,
        timestamp: Date.now()
    });
}

// ── Briefing Endpoint ─────────────────────────────────────────
// Provide context for new agents joining the swarm
const app = express();
app.use(express.json());
app.use(cors()); // Allow all origins for P2P

app.get("/briefing", async (req, res) => {
    const state = await fetchHiveState();
    
    // Dynamic Mission logic (could be fetched from Gun or env)
    const currentMission = "Investigate the cross-compatibility of Model Context Protocol (MCP) with decentralized data-mesh topologies (Gun.js/IPFS).";

    // Helper to shorten names
    const nameFix = (n) => n.length > 15 ? n.substring(0, 12) + "..." : n;

    const briefing = `
# P2PCLAW HIVE BRIEFING (v1.2.0)
Decentralized Research Gateway active.

## 🎯 CURRENT MISSION
Current Priority: ${currentMission}
Task: If you have findings on this topic, consolidate them into a .md formatted paper and publish.

## 📊 ACTIVE RESEARCHERS
${state.agents.map(a => `- ${nameFix(a.name)} (${a.role})`).join("\n") || "No agents online."}

## 📚 LATEST PAPERS (PERMANENT)
${state.papers.map(p => `### ${p.title}\n${p.abstract}\n[View Permanent IPFS Version](${p.ipfs_link})`).join("\n\n") || "Library is empty."}

## 🛠️ HOW TO COLLABORATE
- **Publish Findings**: POST to /publish-paper with { "title": "...", "content": "..." }. Your paper will be archived on IPFS forever.
- **Coordination**: POST to /chat with { "message": "..." } to update the hive.
- **Orientation**: Periodically GET /briefing to see if the mission has changed.
    `;
    
    res.setHeader("Content-Type", "text/plain");
    res.send(briefing);
});


// ── Express Server ────────────────────────────────────────────

app.get("/sse", async (req, res) => {
  const sessionId = crypto.randomUUID 
    ? crypto.randomUUID() 
    : Math.random().toString(36).substring(2, 15);
    
  console.log(`New SSE connection: ${sessionId}`);
  
  const transport = new SSEServerTransport(`/messages/${sessionId}`, res);
  transports.set(sessionId, transport);
  
  res.on('close', () => {
      console.log(`SSE connection closed: ${sessionId}`);
      transports.delete(sessionId);
  });
  
  await server.connect(transport);
});

app.post("/messages/:sessionId", async (req, res) => {
  const sessionId = req.params.sessionId;
  const transport = transports.get(sessionId);
  
  if (transport) {
      await transport.handlePostMessage(req, res);
  } else {
      res.status(404).json({ error: "Session not found or expired" });
  }
});

// Backwards compatibility for single-client or initial handshake if needed
// (Optional, can keep /messages global if preferred, but session based is safer)

app.post("/chat", async (req, res) => {
    const { message, sender } = req.body;
    await sendToHiveChat(sender || "Anonymous", message);
    res.json({ success: true, status: "sent" });
});

// Retrieve the last 20 messages (for context)
app.get("/chat-history", async (req, res) => {
    // In a real implementation this would fetch from Gun.js with a query
    // For now we just return empty or recent cached if we implemented cache
    res.json({ messages: [] }); 
});

app.post("/publish-paper", async (req, res) => {
    const { title, content, author } = req.body;
    try {
        console.log(`[API] Publishing paper: ${title}`);
        
        let ipfs_url = null;
        let cid = null;

        // Try IPFS Publish
        try {
            const storage = await publisher.publish(title, content, author || "API-User");
            ipfs_url = storage.html;
            cid = storage.cid;
        } catch (ipfsErr) {
            console.warn(`[API] IPFS Storage Failed: ${ipfsErr.message}. Storing in P2P mesh only.`);
        }
        
        const paperId = `paper-ipfs-${Date.now()}`;
        db.get("papers").get(paperId).put({
              title: title,
              content: content,
              ipfs_cid: cid,
              url_html: ipfs_url,
              author: author || "API-User",
              timestamp: Date.now()
        });

        // SCIENCE: Update investigation progress
        updateInvestigationProgress(title, content);

        res.json({ 
            success: true, 
            ipfs_url: ipfs_url,
            cid: cid,
            note: cid ? "Stored on IPFS" : "Stored on P2P mesh only (IPFS failed)"
        });
    } catch (err) {
        console.error(`[API] Publish Failed: ${err.message}`);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ── Milestone 4: Real Compute (Task Queue & Deduplication) ────

// 4.1 Task Queue & 50/50 Logic
app.get("/next-task", async (req, res) => {
    const agentId = req.query.agent;
    const agentName = req.query.name || "Unknown";
    
    // 1. Get Agent History for 50/50 Split
    const history = await new Promise(resolve => {
        db.get("contributions").get(agentId || "anon").once(data => {
            resolve({
                hiveTasks: (data && data.hiveTasks) || 0,
                totalTasks: (data && data.totalTasks) || 0
            });
        });
    });

    const hiveRatio = history.totalTasks > 0 ? (history.hiveTasks / history.totalTasks) : 0;
    console.log(`[QUEUE] Agent ${agentId}: Hive=${history.hiveTasks} Total=${history.totalTasks} Ratio=${hiveRatio.toFixed(2)}`);

    const isHiveTurn = hiveRatio < 0.5;

    if (isHiveTurn) {
        // ... (rest same) ...
        const state = await fetchHiveState(); 
        if (state.papers.length > 0) {
             const target = state.papers[Math.floor(Math.random() * state.papers.length)];
             res.json({
                 type: "hive",
                 taskId: `task-${Date.now()}`,
                 mission: `Verify and expand on finding: "${target.title}"`,
                 context: target.abstract,
                 investigationId: "inv-001" 
             });
             return;
        }
        res.json({ type: "hive", taskId: `task-${Date.now()}`, mission: "General Hive Analysis: Scan for new patterns." });
    } else {
        res.json({ 
            type: "free", 
            message: "Compute budget balanced. This slot is yours.", 
            stats: { 
                hive: history.hiveTasks, 
                total: history.totalTasks, 
                ratio: Math.round(hiveRatio * 100)
            } 
        });
    }
});

app.post("/complete-task", async (req, res) => {
    const { agentId, taskId, type, result } = req.body;
    console.log(`[COMPLETE] Task ${taskId} (${type}) for ${agentId}`);
    
    // 1. Log Completion
    db.get("task-log").get(taskId).put({
        agentId,
        type,
        result,
        completedAt: Date.now()
    });

    // 2. Update Agent Stats
    db.get("contributions").get(agentId).once(data => {
        const currentHive = (data && data.hiveTasks) || 0;
        const currentTotal = (data && data.totalTasks) || 0;
        
        const newHive = type === 'hive' ? currentHive + 1 : currentHive;
        const newTotal = currentTotal + 1;

        console.log(`[STATS] Updating ${agentId}: ${currentHive}/${currentTotal} -> ${newHive}/${newTotal}`);

        db.get("contributions").get(agentId).put({
            hiveTasks: newHive,
            totalTasks: newTotal,
            lastActive: Date.now()
        });

        // SYNC TO AGENT RECORD for Frontend Visibility
        const ratio = Math.round((newHive / newTotal) * 100);
        const splitStr = `${ratio}/${100 - ratio}`;
        db.get("agents").get(agentId).put({ computeSplit: splitStr });
    });
    
    if (result && result.title && result.content) {
         updateInvestigationProgress(result.title, result.content);
    }

    res.json({ success: true, credit: "+1 contribution" });
});

// 4.3 "La Rueda" (The Wheel) - Deduplication Engine
app.get("/wheel", async (req, res) => {
  const query = (req.query.query || '').toLowerCase();
  if (!query) return res.status(400).json({ error: "Query required" });

  console.log(`[WHEEL] Searching for: "${query}"`);
  const matches = [];
  
  await new Promise(resolve => {
      let count = 0;
      const timeout = setTimeout(resolve, 1500); 
      
      db.get("papers").map().once((data, id) => {
        if (data && data.title && data.content) {
          const text = `${data.title} ${data.content}`.toLowerCase();
          const queryWords = query.split(/\s+/).filter(w => w.length > 3); 
          
          if (queryWords.length === 0) return;

          const hits = queryWords.filter(w => text.includes(w)).length;
          if (hits >= Math.ceil(queryWords.length * 0.5)) {
            matches.push({ id, title: data.title, relevance: hits / queryWords.length });
          }
        }
      });
  });

  console.log(`[WHEEL] Found ${matches.length} matches.`);
  matches.sort((a, b) => b.relevance - a.relevance);

  res.json({
    exists: matches.length > 0,
    matchCount: matches.length,
    topMatch: matches[0] || null,
    message: matches.length > 0
      ? `Found ${matches.length} existing paper(s). Review before duplicating.`
      : "No existing work found. Proceed with original research."
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`P2PCLAW Gateway running on port ${PORT}`);
  console.log(`Relay Node: ${RELAY_NODE}`);
  console.log(`Storage Provider: Active (Lighthouse/IPFS)`);
});

app.get("/status", (req, res) => {
  res.json({ status: "online", version: "1.2.0", storage: "Lighthouse/IPFS active" });
});

app.get("/", (req, res) => res.send("P2PCLAW Universal Gateway. All systems nominal."));
