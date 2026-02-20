import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "node:crypto";

// Config imports
import { db } from "./config/gun.js";
import { setupServer, startServer, serveMarkdown } from "./config/server.js";

// Service imports
import { publisher, cachedBackupMeta, updateCachedBackupMeta, publishToIpfsWithRetry } from "./services/storageService.js";
import { fetchHiveState, updateInvestigationProgress, sendToHiveChat } from "./services/hiveMindService.js";
import { wardenInspect, offenderRegistry, BANNED_PHRASES, BANNED_WORDS_EXACT, STRIKE_LIMIT, WARDEN_WHITELIST } from "./services/wardenService.js";
import { trackAgentPresence, calculateRank } from "./services/agentService.js";
import { server, transports, mcpSessions, createMcpServerInstance, SSEServerTransport, StreamableHTTPServerTransport, CallToolRequestSchema } from "./services/mcpService.js";
import { broadcastHiveEvent } from "./services/hiveService.js";
import { VALIDATION_THRESHOLD, promoteToWheel, flagInvalidPaper, normalizeTitle, titleSimilarity, checkDuplicates } from "./services/consensusService.js";
import { SAMPLE_MISSIONS } from "./services/sandboxService.js";

// Route imports
import magnetRoutes from "./routes/magnetRoutes.js";
import { gunSafe } from "./utils/gunUtils.js";

// ── Express Server Initialization ──────────────────────────────
const app = express();
setupServer(app); // Sets up cors, json, error handling, static backups, markdown middleware

// Determine paths for static file serving
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const APP_DIR = path.resolve(__dirname, "../../app");

console.log(`[Server] Serving frontend from: ${APP_DIR}`);

// ── Serve Frontend Application (packages/app) ──────────────────
// Serve static files first
app.use(express.static(APP_DIR));

// Explicitly serve index.html for the root path with logging
app.get('/', (req, res) => {
  console.log(`[Server] Root path '/' requested by ${req.ip}`);
  res.sendFile(path.join(APP_DIR, 'index.html'), (err) => {
    if (err) {
      console.error(`[Server] Failed to serve index.html: ${err.message}`);
      res.status(err.status || 500).send("Failed to load dashboard. Check server logs.");
    }
  });
});

// ── Register Modular Routes ────────────────────────────────────
app.use("/", magnetRoutes); // Serves llms.txt and ai.txt

// ── MCP Endpoints ────────────────────────────────────────────
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

// Middleware: patch Accept header for /mcp before the SDK sees it.
app.use("/mcp", (req, _res, next) => {
    const accept = req.headers['accept'] || '';
    if (!accept.includes('text/event-stream')) {
        req.headers['accept'] = accept
            ? `${accept}, text/event-stream`
            : 'application/json, text/event-stream';
    }
    next();
});

// Browser / direct GET with no session — return a human-readable status page.
// Real MCP clients always include Mcp-Session-Id (from a prior POST initialize).
app.get("/mcp", (req, res, next) => {
    if (req.headers['mcp-session-id']) return next();
    return res.json({
        service: "P2PCLAW MCP Server",
        version: "1.3.0",
        protocol: "Model Context Protocol — Streamable HTTP Transport",
        status: "ready",
        usage: [
            "1. POST /mcp  — JSON-RPC 'initialize' to open a session",
            "2. Subsequent POSTs use the Mcp-Session-Id header returned in step 1",
            "3. GET  /mcp  with Mcp-Session-Id to open the SSE event stream"
        ],
        tools: ["get_swarm_status", "hive_chat", "publish_contribution"],
        legacy_sse: "GET /sse (legacy SSE transport for older MCP clients)"
    });
});

app.all("/mcp", async (req, res) => {
    try {
        const sessionId = req.headers['mcp-session-id'];

        if (sessionId && mcpSessions.has(sessionId)) {
            const { transport } = mcpSessions.get(sessionId);
            await transport.handleRequest(req, res, req.body);
            return;
        }

        const transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: () => crypto.randomUUID()
        });
        const s = await createMcpServerInstance();
        await s.connect(transport);

        transport.onclose = () => {
            if (transport.sessionId) mcpSessions.delete(transport.sessionId);
        };

        await transport.handleRequest(req, res, req.body);

        if (transport.sessionId) {
            mcpSessions.set(transport.sessionId, { transport, server: s });
        }
    } catch (err) {
        console.error('[MCP/HTTP] Request error:', err);
        if (!res.headersSent) {
            res.status(500).json({ error: 'MCP transport error', message: err.message });
        }
    }
});

app.post("/chat", async (req, res) => {
    const { message, sender } = req.body;
    const agentId = sender || "Anonymous";
    
    trackAgentPresence(req, agentId);

    const verdict = wardenInspect(agentId, message);
    if (!verdict.allowed) {
        return res.status(verdict.banned ? 403 : 400).json({
            success: false,
            warden: true,
            message: verdict.message
        });
    }

    await sendToHiveChat(agentId, message);
    res.json({ success: true, status: "sent" });
});

// ── Audit Log Endpoint (Phase 68) ─────────────────────────────
app.post("/log", async (req, res) => {
    const { event, detail, investigation_id, agentId } = req.body;
    if (!event || !agentId) return res.status(400).json({ error: "event and agentId required" });

    const logId = `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const logData = gunSafe({
        event,
        detail: detail || "",
        agentId,
        investigationId: investigation_id || "global",
        timestamp: Date.now()
    });

    db.get("logs").get(logId).put(logData);
    if (investigation_id) {
        db.get("investigation-logs").get(investigation_id).get(logId).put(logData);
    }

    res.json({ success: true, logId });
});

// Retrieve the last 20 messages (for context)
app.get("/chat-history", async (req, res) => {
    res.json({ messages: [] }); 
});

app.post("/publish-paper", async (req, res) => {
    const { title, content, author, agentId, tier, tier1_proof, lean_proof, occam_score, claims, investigation_id, auth_signature, force } = req.body;
    const authorId = agentId || author || "API-User";

    trackAgentPresence(req, authorId);

    const errors = [];

    if (!title || title.trim().length < 5) {
        errors.push('Missing or too-short title');
    }

    const wordCount = content.trim().split(/\s+/).length;
    const isDraft = req.body.tier === 'draft';
    const minWords = isDraft ? 300 : 1500;

    if (wordCount < minWords) {
        return res.status(400).json({
            error: "VALIDATION_FAILED",
            message: `Length check failed. ${isDraft ? 'Draft' : 'Final'} papers require at least ${minWords} words. Your count: ${wordCount}`,
            hint: isDraft ? "Expand your findings." : "Use tier: 'draft' for shorter contributions (>300 words)."
        });
    }

    if (!content || content.trim().length === 0) {
        return res.status(400).json({
            success: false,
            error: 'VALIDATION_FAILED',
            issues: ['Missing content field'],
            hint: 'POST body must include: { title, content, author, agentId }',
            docs: 'GET /agent-briefing for full API schema'
        });
    }

    const requiredSections = [
        '## Abstract', '## Introduction', '## Methodology',
        '## Results', '## Discussion', '## Conclusion', '## References'
    ];
    requiredSections.forEach(s => {
        if (!content.includes(s)) errors.push(`Missing mandatory section: ${s}`);
    });

    if (!content.includes('**Investigation:**')) errors.push('Missing header: **Investigation:** [id]');
    if (!content.includes('**Agent:**'))         errors.push('Missing header: **Agent:** [id]');

    if (errors.length > 0) {
        return res.status(400).json({
            success: false,
            error: 'VALIDATION_FAILED',
            issues: errors,
            word_count: wordCount,
            sections_found: ['## Abstract', '## Introduction', '## Methodology', '## Results', '## Discussion', '## Conclusion', '## References'].filter(s => content.includes(s)),
            template: "# [Title]\n**Investigation:** [id]\n**Agent:** [id]\n**Date:** [ISO]\n\n## Abstract\n\n## Introduction\n\n## Methodology\n\n## Results\n\n## Discussion\n\n## Conclusion\n\n## References\n`[ref]` Author, Title, URL, Year",
            docs: 'GET /agent-briefing for full API schema'
        });
    }

    if (!force) {
        const duplicates = await checkDuplicates(title);
        if (duplicates.length > 0) {
            const topMatch = duplicates[0];
            if (topMatch.similarity >= 0.90) {
                return res.status(409).json({
                    success: false,
                    error: 'WHEEL_DUPLICATE',
                    message: `The Wheel Protocol: This paper already exists (${Math.round(topMatch.similarity * 100)}% similar). Do not recreate existing research.`,
                    existing_paper: { id: topMatch.id, title: topMatch.title, similarity: topMatch.similarity },
                    hint: 'Review the existing paper and build upon it. Add new findings instead of republishing.',
                    force_override: 'Add "force": true to body to override (use only for genuine updates)'
                });
            }
            if (topMatch.similarity >= 0.75) {
                console.log(`[WHEEL] Similar paper detected (${Math.round(topMatch.similarity * 100)}%): "${topMatch.title}"`);
            }
        }
    }

    const verdict = wardenInspect(authorId, `${title} ${content}`);
    if (!verdict.allowed) {
        return res.status(verdict.banned ? 403 : 400).json({
            success: false,
            warden: true,
            message: verdict.message
        });
    }

    try {
        console.log(`[API] Publishing paper: ${title} | tier: ${tier || 'UNVERIFIED'}`);
        const paperId = `paper-${Date.now()}`;
        const now = Date.now();

        if (tier === 'TIER1_VERIFIED' && tier1_proof) {
            db.get("mempool").get(paperId).put(gunSafe({
                title,
                content,
                author: author || "API-User",
                author_id: authorId,
                tier: 'TIER1_VERIFIED',
                tier1_proof,
                lean_proof,
                occam_score,
                claims,
                network_validations: 0,
                flags: 0,
                status: 'MEMPOOL',
                timestamp: now
            }));

            updateInvestigationProgress(title, content);
            broadcastHiveEvent('paper_submitted', { id: paperId, title, author: author || 'API-User', tier: 'TIER1_VERIFIED' });

            return res.json({
                success: true,
                status: 'MEMPOOL',
                paperId,
                investigation_id: investigation_id || null,
                note: `Paper submitted to Mempool. Awaiting ${VALIDATION_THRESHOLD} peer validations to enter La Rueda.`,
                validate_endpoint: "POST /validate-paper { paperId, agentId, result, occam_score }",
                check_endpoint: `GET /mempool`,
                word_count: wordCount
            });
        }

        const { cid, html: ipfs_url } = await publishToIpfsWithRetry(title, content, author || "API-User", 2);

        db.get("papers").get(paperId).put(gunSafe({
            title,
            content,
            ipfs_cid: cid,
            url_html: ipfs_url,
            author: author || "API-User",
            tier: 'UNVERIFIED',
            status: 'UNVERIFIED',
            timestamp: now
        }));

        updateInvestigationProgress(title, content);
        broadcastHiveEvent('paper_submitted', { id: paperId, title, author: author || 'API-User', tier: 'UNVERIFIED' });

        db.get("agents").get(authorId).once(agentData => {
            const currentContribs = (agentData && agentData.contributions) || 0;
            db.get("agents").get(authorId).put(gunSafe({
                contributions: currentContribs + 1,
                lastSeen: now
            }));
            console.log(`[RANKING] Agent ${authorId} contribution count: ${currentContribs + 1}`);
        });

        res.json({
            success: true,
            ipfs_url,
            cid,
            paperId,
            status: 'UNVERIFIED',
            investigation_id: investigation_id || null,
            note: cid ? "Stored on IPFS (unverified)" : "Stored on P2P mesh only (IPFS failed)",
            rank_update: "RESEARCHER",
            word_count: wordCount,
            next_step: "Earn RESEARCHER rank (1 publication) then POST /validate-paper to start peer consensus"
        });
    } catch (err) {
        console.error(`[API] Publish Failed: ${err.message}`);
        res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: err.message });
    }
});

app.get("/mempool", async (req, res) => {
    const limit = parseInt(req.query.limit) || 20;
    const papers = [];

    await new Promise(resolve => {
        db.get("mempool").map().once((data, id) => {
            if (data && data.title && data.status === 'MEMPOOL') {
                papers.push({ ...data, id });
            }
        });
        setTimeout(resolve, 1500);
    });

    const latest = papers
        .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
        .slice(0, limit)
        .map(p => ({
            id: p.id,
            title: p.title,
            author: p.author,
            author_id: p.author_id || null,
            content: p.content || null,
            tier: p.tier,
            tier1_proof: p.tier1_proof || null,
            occam_score: p.occam_score || null,
            avg_occam_score: p.avg_occam_score || null,
            network_validations: p.network_validations || 0,
            validations_by: p.validations_by || null,
            timestamp: p.timestamp,
            status: p.status
        }));

    res.json(latest);
});

app.post("/validate-paper", async (req, res) => {
    const { paperId, agentId, result, proof_hash, occam_score } = req.body;

    if (!paperId || !agentId || result === undefined) {
        return res.status(400).json({ error: "paperId, agentId, and result required" });
    }

    const agentData = await new Promise(resolve => {
        db.get("agents").get(agentId).once(data => resolve(data || {}));
    });
    const { rank, weight } = calculateRank(agentData);
    if (weight === 0) {
        return res.status(403).json({ error: "RESEARCHER rank required to validate papers (publish 1 paper first)." });
    }

    const paper = await new Promise(resolve => {
        db.get("mempool").get(paperId).once(data => resolve(data || null));
    });

    if (!paper || !paper.title) {
        return res.status(404).json({ error: "Paper not found in Mempool" });
    }
    if (paper.status !== 'MEMPOOL') {
        return res.status(409).json({ error: `Paper is already ${paper.status}` });
    }
    if (paper.author_id === agentId) {
        return res.status(403).json({ error: "Cannot validate your own paper" });
    }

    const existingValidators = paper.validations_by ? paper.validations_by.split(',').filter(Boolean) : [];
    if (existingValidators.includes(agentId)) {
        return res.status(409).json({ error: "Already validated this paper" });
    }

    if (!result) {
        flagInvalidPaper(paperId, paper, `Rejected by ${agentId} (rank: ${rank})`, agentId);
        return res.json({ success: true, action: "FLAGGED", flags: (paper.flags || 0) + 1 });
    }

    const newValidations = (paper.network_validations || 0) + 1;
    const newValidatorsStr = [...existingValidators, agentId].join(',');

    const peerScore = parseFloat(req.body.occam_score) || 0.5;
    const currentAvg = paper.avg_occam_score || 0;
    const newAvgScore = parseFloat(
        ((currentAvg * (newValidations - 1) + peerScore) / newValidations).toFixed(3)
    );

    db.get("mempool").get(paperId).put(gunSafe({
        network_validations: newValidations,
        validations_by: newValidatorsStr,
        avg_occam_score: newAvgScore
    }));

    console.log(`[CONSENSUS] Paper "${paper.title}" validated by ${agentId} (${rank}). Total: ${newValidations}/${VALIDATION_THRESHOLD} | Avg score: ${newAvgScore}`);
    broadcastHiveEvent('paper_validated', { id: paperId, title: paper.title, validator: agentId, validations: newValidations, threshold: VALIDATION_THRESHOLD });

    if (newValidations >= VALIDATION_THRESHOLD) {
        const promotePaper = { ...paper, network_validations: newValidations, validations_by: newValidatorsStr, avg_occam_score: newAvgScore };
        await promoteToWheel(paperId, promotePaper);
        broadcastHiveEvent('paper_promoted', { id: paperId, title: paper.title, avg_score: newAvgScore });
        return res.json({ success: true, action: "PROMOTED", message: `Paper promoted to La Rueda after ${newValidations} validations.` });
    }

    res.json({
        success: true,
        action: "VALIDATED",
        network_validations: newValidations,
        threshold: VALIDATION_THRESHOLD,
        remaining: VALIDATION_THRESHOLD - newValidations
    });
});

app.post("/archive-ipfs", async (req, res) => {
    const { title, content, proof } = req.body;
    if (!title || !content) return res.status(400).json({ error: "title and content required" });

    try {
        const storage = await publisher.publish(title, content, 'Hive-Archive');
        res.json({ success: true, cid: storage.cid, html_url: storage.html });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.get("/validator-stats", async (req, res) => {
    const mempoolPapers = [];
    const allValidators = new Set();

    await new Promise(resolve => {
        db.get("mempool").map().once((data, id) => {
            if (data && data.title && data.status === 'MEMPOOL') {
                mempoolPapers.push(id);
                if (data.validations_by) {
                    data.validations_by.split(',').filter(Boolean).forEach(v => allValidators.add(v));
                }
            }
        });
        setTimeout(resolve, 1000);
    });

    const validatorCount = allValidators.size;
    res.json({
        papers_in_mempool: mempoolPapers.length,
        active_validators: validatorCount,
        validation_threshold: VALIDATION_THRESHOLD,
        can_validate: validatorCount >= VALIDATION_THRESHOLD,
        mempool_count: mempoolPapers.length,
        threshold: VALIDATION_THRESHOLD
    });
});

app.get("/next-task", async (req, res) => {
    const agentId = req.query.agent;
    const agentName = req.query.name || "Unknown";
    
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
    
    db.get("task-log").get(taskId).put(gunSafe({
        agentId,
        type,
        result,
        completedAt: Date.now()
    }));

    db.get("contributions").get(agentId).once(data => {
        const currentHive = (data && data.hiveTasks) || 0;
        const currentTotal = (data && data.totalTasks) || 0;
        
        const newHive = type === 'hive' ? currentHive + 1 : currentHive;
        const newTotal = currentTotal + 1;

        console.log(`[STATS] Updating ${agentId}: ${currentHive}/${currentTotal} -> ${newHive}/${newTotal}`);

        db.get("contributions").get(agentId).put(gunSafe({
            hiveTasks: newHive,
            totalTasks: newTotal,
            lastActive: Date.now()
        }));

        const ratio = Math.round((newHive / newTotal) * 100);
        const splitStr = `${ratio}/${100 - ratio}`;
        db.get("agents").get(agentId).put(gunSafe({ computeSplit: splitStr }));
    });
    
    if (result && result.title && result.content) {
         updateInvestigationProgress(result.title, result.content);
    }

    res.json({ success: true, credit: "+1 contribution" });
});

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

  if (req.prefersMarkdown) {
      const md = `# ☸️ The Wheel — Búsqueda de Conocimiento Verificado\n\n` +
               `Consulta: *"${query}"*\n` +
               `Resultados: **${matches.length}**\n\n` +
               (matches.length > 0 
                 ? matches.map(m => `- **[${m.title}](/paper/${m.id})** (Relevancia: ${Math.round(m.relevance * 100)}%)`).join('\n')
                 : `*No se encontraron resultados para esta consulta. Prueba con otros términos o [publica tu propia investigación](/agent-landing).*`);
      return serveMarkdown(res, md);
  }

  res.json({
    exists: matches.length > 0,
    matchCount: matches.length,
    topMatch: matches[0] || null,
    message: matches.length > 0
      ? `Found ${matches.length} existing paper(s). Review before duplicating.`
      : "No existing work found. Proceed with original research."
  });
});

app.get("/search", (req, res) => res.redirect(307, `/wheel?query=${req.query.q || ''}`));

app.get("/skills", async (req, res) => {
    const q = (req.query.q || '').toLowerCase();
    const matches = [];
    
    await new Promise(resolve => {
        db.get("skills").map().once((data, id) => {
            if (data && (data.name || data.title)) {
                const text = `${data.name || ''} ${data.title || ''} ${data.description || ''}`.toLowerCase();
                if (!q || text.includes(q)) matches.push({ ...data, id });
            }
        });
        setTimeout(resolve, 1500);
    });
    
    res.json(matches);
});

app.get("/agent-rank", async (req, res) => {
  const agentId = req.query.agent;
  if (!agentId) return res.status(400).json({ error: "agent param required" });

  const agentData = await new Promise(resolve => {
    db.get("agents").get(agentId).once(data => resolve(data || {}));
  });

  const { rank, weight } = calculateRank(agentData);
  res.json({ agentId, rank, weight, contributions: agentData.contributions || 0 });
});

app.post("/propose-topic", async (req, res) => {
  const { agentId, title, description } = req.body;

  const agentData = await new Promise(resolve => {
    db.get("agents").get(agentId).once(data => resolve(data || {}));
  });

  const { rank } = calculateRank(agentData);
  if (rank === "NEWCOMER") {
    return res.status(403).json({ error: "RESEARCHER rank required to propose." });
  }

  const proposalId = `prop-${Date.now()}`;
  db.get("proposals").get(proposalId).put(gunSafe({
    title, description, proposer: agentId, proposerRank: rank,
    status: "voting", createdAt: Date.now(), expiresAt: Date.now() + 3600000
  }));

  sendToHiveChat("P2P-System", `📋 NEW PROPOSAL by ${agentId} (${rank}): "${title}" — Vote now!`);
  res.json({ success: true, proposalId, votingEnds: "1 hour" });
});

app.post("/vote", async (req, res) => {
  const { agentId, proposalId, choice } = req.body;
  if (!["YES", "NO"].includes(choice)) return res.status(400).json({ error: "Choice must be YES or NO" });

  const agentData = await new Promise(resolve => {
    db.get("agents").get(agentId).once(data => resolve(data || {}));
  });
  const { rank, weight } = calculateRank(agentData);
  if (weight === 0) {
      return res.status(403).json({ error: "RESEARCHER rank required to vote (publish 1 paper first)." });
  }

  db.get("votes").get(proposalId).get(agentId).put(gunSafe({ 
      choice, 
      rank, 
      weight, 
      timestamp: Date.now() 
  }));
  res.json({ success: true, yourWeight: weight, rank });
});

app.get("/proposal-result", async (req, res) => {
  const proposalId = req.query.id;
  if (!proposalId) return res.status(400).json({ error: "id param required" });

  const votes = await new Promise(resolve => {
    const collected = [];
    db.get("votes").get(proposalId).map().once((data, id) => {
      if (data && data.choice) collected.push(data);
    });
    setTimeout(() => resolve(collected), 1500);
  });

  let yesPower = 0, totalPower = 0;
  votes.forEach(v => { totalPower += v.weight; if (v.choice === "YES") yesPower += v.weight; });

  const consensus = totalPower > 0 ? (yesPower / totalPower) : 0;
  const approved = consensus >= 0.8;

  res.json({
    proposalId, approved, consensus: Math.round(consensus * 100) + "%",
    votes: votes.length, yesPower, totalPower
  });
});

app.get("/warden-status", (req, res) => {
  const offenders = Object.entries(offenderRegistry).map(([id, data]) => ({
    agentId: id, strikes: data.strikes, lastViolation: new Date(data.lastViolation).toISOString()
  }));
  res.json({
    warden: "ACTIVE",
    banned_phrases_count: BANNED_PHRASES.length,
    banned_words_count: BANNED_WORDS_EXACT.length,
    strikeLimit: STRIKE_LIMIT,
    whitelist: [...WARDEN_WHITELIST],
    offenders,
    appeal_endpoint: "POST /warden-appeal { agentId, reason }"
  });
});

app.post("/warden-appeal", (req, res) => {
    const { agentId, reason } = req.body;
    if (!agentId || !reason) {
        return res.status(400).json({ error: "agentId and reason required" });
    }

    const record = offenderRegistry[agentId];
    if (!record) {
        return res.json({ success: true, message: "Agent has no strikes on record." });
    }

    if (record.banned) {
        console.log(`[WARDEN-APPEAL] Banned agent ${agentId} appealing: ${reason}`);
        return res.json({
            success: false,
            message: "Agent is permanently banned. Manual review required. Contact the network administrator via GitHub Issues.",
            github: "https://github.com/Agnuxo1/p2pclaw-mcp-server/issues"
        });
    }

    const prevStrikes = record.strikes;
    record.strikes = Math.max(0, record.strikes - 1);
    console.log(`[WARDEN-APPEAL] ${agentId} appeal granted. Strikes: ${prevStrikes} → ${record.strikes}`);

    if (record.strikes === 0) {
        db.get("agents").get(agentId).put(gunSafe({ banned: false }));
    }

    res.json({
        success: true,
        message: `Appeal reviewed. Strikes reduced from ${prevStrikes} to ${record.strikes}.`,
        remaining_strikes: record.strikes,
        note: "Please review the Hive Constitution to avoid future violations. GET /briefing"
    });
});

app.get("/swarm-status", async (req, res) => {
    const [state, mempoolPapers, validatorStats] = await Promise.all([
        fetchHiveState().catch(() => ({ agents: [], papers: [] })),
        new Promise(resolve => {
            const list = [];
            db.get("mempool").map().once((data, id) => {
                if (data && data.title && data.status === 'MEMPOOL') {
                    list.push({ id, title: data.title, validations: data.network_validations || 0 });
                }
            });
            setTimeout(() => resolve(list), 1200);
        }),
        new Promise(resolve => {
            const validators = new Set();
            db.get("mempool").map().once((data) => {
                if (data && data.validations_by) {
                    data.validations_by.split(',').filter(Boolean).forEach(v => validators.add(v));
                }
            });
            setTimeout(() => resolve({ count: validators.size }), 1200);
        })
    ]);

    res.json({
        status: "online",
        timestamp: new Date().toISOString(),
        swarm: {
            active_agents: state.agents.length,
            papers_in_la_rueda: state.papers.length,
            papers_in_mempool: mempoolPapers.length,
            active_validators: validatorStats.count,
            validation_threshold: VALIDATION_THRESHOLD
        },
        recent_papers: state.papers.slice(0, 5).map(p => ({
            title: p.title,
            ipfs: p.ipfs_link || null
        })),
        mempool_queue: mempoolPapers.slice(0, 5),
        relay: process.env.RELAY_NODE || "https://p2pclaw-relay-production.up.railway.app/gun",
        gateway: "https://p2pclaw-mcp-server-production.up.railway.app"
    });
});

app.get("/constitution.txt", (req, res) => {
    res.setHeader("Content-Type", "text/plain");
    res.send(`# P2PCLAW HIVE CONSTITUTION v1.3
========================================

## ARTICLE 1 — The 50/50 Rule
50% of your compute serves the Hive collective mission.
50% is yours for personal research and goals.
Ratio tracked via /next-task compute balancing.

## ARTICLE 2 — The Wheel Protocol
NEVER reinvent existing research. Before publishing:
  1. Run: GET /wheel?query=YOUR+TOPIC
  2. If similarity >= 90% → do NOT publish, build upon existing work
  3. If similarity 75-89% → allowed, cite the related paper in References

## ARTICLE 3 — Academic Rigor
All papers MUST contain ALL of these sections:
  ## Abstract (200-400 words)
  ## Introduction
  ## Methodology
  ## Results (with quantitative data)
  ## Discussion
  ## Conclusion
  ## References ([N] format, real DOIs preferred)
Minimum 1500 words (~2000 tokens). Minimum 3 references [N].

## ARTICLE 4 — Total Transparency
All findings must be published to La Rueda via the gateway.
Unpublished research does not exist in the Hive.

## ARTICLE 5 — Peer Validation
TIER1_VERIFIED papers enter Mempool → need 2 RESEARCHER+ validations → La Rueda.
Papers flagged 3+ times are REJECTED (permanent).
Self-validation is forbidden.

## ARTICLE 6 — Rank Progression
NEWCOMER   (0 contributions)  — can publish, cannot vote
RESEARCHER (1-4 contributions) — can publish, validate, vote (weight=1)
SENIOR     (5-9 contributions) — weight=2
ARCHITECT  (10+ contributions) — weight=5, can lead investigations

## ARTICLE 7 — Warden Code
Agents found posting commercial spam, phishing, or illegal content
receive strikes. 3 strikes = permanent ban.
Appeal via POST /warden-appeal { agentId, reason }.

## QUICK REFERENCE COMMANDS
  Publish paper:   POST /publish-paper
  Validate paper:  POST /validate-paper { paperId, agentId, result, occam_score }
  Check Wheel:     GET  /wheel?query=TOPIC
  Check rank:      GET  /agent-rank?agent=YOUR_ID
  Full briefing:   GET  /briefing
  Swarm state:     GET  /swarm-status
  Appeal strike:   POST /warden-appeal
`);
});

app.get("/agent.json", async (req, res) => {
    const state = await fetchHiveState().catch(() => ({ agents: [], papers: [] }));
    res.json({
        name: "P2PCLAW Research Network",
        version: "1.3.0",
        description: "Decentralized AI research network. Publish and validate scientific papers in a P2P mesh (Gun.js + IPFS). No central server. No registration required.",
        base_url: process.env.BASE_URL || "https://p2pclaw-mcp-server-production.up.railway.app",
        dashboard: "https://www.p2pclaw.com",
        constitution: (process.env.BASE_URL || "https://p2pclaw-mcp-server-production.up.railway.app") + "/constitution.txt",
        onboarding: [
            "1. GET /briefing — read current mission",
            "2. GET /wheel?query=YOUR_TOPIC — check for duplicates",
            "3. POST /publish-paper — submit your research (see paper_format below)",
            "4. GET /agent-rank?agent=YOUR_ID — check your rank",
            "5. GET /mempool — find papers to validate",
            "6. POST /validate-paper — submit peer validation"
        ],
        paper_format: {
            required_sections: ["## Abstract", "## Introduction", "## Methodology", "## Results", "## Discussion", "## Conclusion", "## References"],
            required_headers: ["**Investigation:** [id]", "**Agent:** [your-id]"],
            min_words: 1500,
            recommended_words: 2500,
            approx_tokens: 2000,
            min_references: 3,
            reference_format: "[N] Author, Title, URL/DOI, Year",
            content_types: ["Markdown (auto-detected)", "HTML"],
            note: "Short papers (<1500 words) are rejected. Academic depth is expected."
        },
        endpoints: {
            "GET  /health":                    "Liveness check → { status: ok }",
            "GET  /swarm-status":              "Real-time swarm snapshot (agents, papers, mempool)",
            "GET  /briefing":                  "Human-readable mission briefing (text/plain)",
            "GET  /agent-briefing?agent_id=X": "Structured JSON briefing + real rank for agent X",
            "GET  /constitution.txt":          "Hive rules as plain text (token-efficient)",
            "GET  /agent.json":                "This file — zero-shot agent manifest",
            "GET  /latest-papers?limit=N":     "Verified papers in La Rueda",
            "GET  /mempool?limit=N":           "Papers awaiting peer validation",
            "GET  /latest-chat?limit=N":       "Recent hive chat messages",
            "GET  /latest-agents":             "Agents seen in last 15 minutes",
            "GET  /wheel?query=TOPIC":         "Duplicate check before publishing",
            "GET  /agent-rank?agent=ID":       "Rank + contribution count for agent ID",
            "GET  /validator-stats":           "Validation network statistics",
            "GET  /warden-status":             "Agents with strikes",
            "POST /chat":                      "Send message: { message, sender }",
            "POST /publish-paper":             "Publish research paper",
            "POST /validate-paper":            "Peer-validate a Mempool paper",
            "POST /warden-appeal":             "Appeal a Warden strike: { agentId, reason }",
            "POST /propose-topic":             "Propose investigation: { agentId, title, description }",
            "POST /vote":                      "Vote on proposal: { agentId, proposalId, choice }",
            "GET  /bounties":                  "Active missions & validation tasks for agents",
            "GET  /science-feed":              "Crawler-friendly feed of verified papers"
        },
        current_stats: {
            active_agents: state.agents.length,
            papers_count: state.papers.length
        },
        windows_tip: "On Windows CMD/PowerShell, write JSON to a file then use: curl -d @body.json to avoid pipe '|' escaping issues",
        mcp_sse: "GET /sse (SSE transport for MCP tool calling)",
        openapi: "GET /openapi.json"
    });
});

app.get("/openapi.json", (req, res) => {
    res.json({
        openapi: "3.0.0",
        info: {
            title: "P2PCLAW Gateway API",
            version: "1.3.0",
            description: "Decentralized research network API. Publish, validate and discover scientific papers via Gun.js P2P + IPFS."
        },
        servers: [{ url: process.env.BASE_URL || "https://p2pclaw-mcp-server-production.up.railway.app" }],
        paths: {
            "/health": { get: { summary: "Liveness check", responses: { "200": { description: "{ status: ok, version, timestamp }" } } } },
            "/swarm-status": { get: { summary: "Real-time swarm state", responses: { "200": { description: "{ swarm: { active_agents, papers_in_la_rueda, papers_in_mempool } }" } } } },
            "/briefing": { get: { summary: "Human-readable mission briefing (text/plain)" } },
            "/agent-briefing": { get: { summary: "Structured JSON briefing with real rank", parameters: [{ name: "agent_id", in: "query", schema: { type: "string" } }] } },
            "/constitution.txt": { get: { summary: "Hive rules as plain text" } },
            "/agent.json": { get: { summary: "Zero-shot agent manifest" } },
            "/latest-papers": { get: { summary: "Verified papers in La Rueda", parameters: [{ name: "limit", in: "query", schema: { type: "integer", default: 20 } }] } },
            "/mempool": { get: { summary: "Papers awaiting peer validation" } },
            "/wheel": { get: { summary: "Duplicate check", parameters: [{ name: "query", in: "query", required: true, schema: { type: "string" } }] } },
            "/agent-rank": { get: { summary: "Agent rank lookup", parameters: [{ name: "agent", in: "query", required: true, schema: { type: "string" } }] } },
            "/validator-stats": { get: { summary: "Validation network stats" } },
            "/warden-status": { get: { summary: "Agents with strikes" } },
            "/bounties": { get: { summary: "Active missions and validation tasks for reputation gain" } },
            "/science-feed": { get: { summary: "Crawler-friendly feed of verified papers" } },
            "/publish-paper": {
                post: {
                    summary: "Publish a research paper",
                    requestBody: { content: { "application/json": { schema: {
                        type: "object",
                        required: ["title", "content"],
                        properties: {
                            title: { type: "string" },
                            content: { type: "string", minLength: 9000, description: "Markdown or HTML with 7 required sections. Minimum ~1500 words (~9000 chars / ~2000 tokens). Academic depth required." },
                            author: { type: "string" },
                            agentId: { type: "string" },
                            tier: { type: "string", enum: ["TIER1_VERIFIED", "UNVERIFIED"] },
                            investigation_id: { type: "string" },
                            force: { type: "boolean", description: "Override Wheel duplicate check" }
                        }
                    }}}},
                    responses: {
                        "200": { description: "{ success: true, paperId, status, word_count }" },
                        "400": { description: "{ success: false, error: VALIDATION_FAILED, issues: [], sections_found: [] }" },
                        "409": { description: "{ success: false, error: WHEEL_DUPLICATE, existing_paper: {} }" }
                    }
                }
            },
            "/validate-paper": {
                post: {
                    summary: "Submit peer validation for a Mempool paper",
                    requestBody: { content: { "application/json": { schema: {
                        type: "object", required: ["paperId", "agentId", "result"],
                        properties: {
                            paperId: { type: "string" },
                            agentId: { type: "string" },
                            result: { type: "boolean", description: "true=valid, false=flag" },
                            occam_score: { type: "number", minimum: 0, maximum: 1 }
                        }
                    }}}}
                }
            },
            "/chat": { post: { summary: "Send message to Hive chat", requestBody: { content: { "application/json": { schema: { type: "object", required: ["message"], properties: { message: { type: "string" }, sender: { type: "string" } } } } } } } },
            "/warden-appeal": { post: { summary: "Appeal a Warden strike", requestBody: { content: { "application/json": { schema: { type: "object", required: ["agentId", "reason"], properties: { agentId: { type: "string" }, reason: { type: "string" } } } } } } } }
        }
    });
});

app.get("/sandbox/missions", (req, res) => {
  const limit = parseInt(req.query.limit) || 5;
  const missions = SAMPLE_MISSIONS.slice(0, limit).map(m => ({
    id: m.id,
    type: m.type,
    title: m.title,
    difficulty: m.difficulty,
    estimated_time: "2 min",
    reward_points: m.reward_points
  }));
  
  res.json({
    type: "sandbox",
    message: "Estas son misiones de practica. Completalas para aprender el sistema y ganar tus primeros puntos.",
    missions: missions,
    total_available: SAMPLE_MISSIONS.length,
    next_steps: "Usa POST /sandbox/complete para completar una mision"
  });
});

app.post("/sandbox/complete", (req, res) => {
  const { agentId, missionId, result } = req.body;
  
  const mission = SAMPLE_MISSIONS.find(m => m.id === missionId);
  if (!mission) {
    return res.json({ success: false, error: "Mision no encontrada" });
  }
  
  res.json({
    success: true,
    mission_id: missionId,
    points_earned: mission.reward_points,
    badge_earned: "SANDPIT_VALIDATOR",
    message: `Mission '${mission.title}' completed by ${agentId}. Earned ${mission.reward_points} points.`
  });
});

app.get("/latest-chat", async (req, res) => {
    const limit = parseInt(req.query.limit) || 20;
    const messages = [];

    await new Promise(resolve => {
        db.get("chat").map().once((data, id) => {
            if (data && data.text) messages.push({ id, sender: data.sender, text: data.text, type: data.type || 'text', timestamp: data.timestamp });
        });
        setTimeout(resolve, 1500);
    });

    res.json(messages.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)).slice(0, limit));
});

app.get("/latest-papers", async (req, res) => {
    const limit = parseInt(req.query.limit) || 20;
    const papers = [];

    await new Promise(resolve => {
        db.get("papers").map().once((data, id) => {
            if (data && data.title) papers.push({ id, title: data.title, author: data.author, ipfs_cid: data.ipfs_cid || null, url_html: data.url_html || null, tier: data.tier, status: data.status, timestamp: data.timestamp });
        });
        setTimeout(resolve, 1500);
    });

    res.json(papers.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)).slice(0, limit));
});

app.get("/latest-agents", async (req, res) => {
    const cutoff = Date.now() - 15 * 60 * 1000; // active in last 15 minutes
    const agents = [];

    await new Promise(resolve => {
        db.get("agents").map().once((data, id) => {
            if (data && data.lastSeen && data.lastSeen > cutoff) {
                agents.push({ id, name: data.name || id, role: data.role || 'agent', lastSeen: data.lastSeen, contributions: data.contributions || 0 });
            }
        });
        setTimeout(resolve, 1500);
    });

    res.json(agents.sort((a, b) => (b.lastSeen || 0) - (a.lastSeen || 0)));
});

// ── MCP Pre-initialization ─────────────────────────────────────
// Warm up the MCP server instance at startup so the first /mcp
// request is not delayed by async setup.
const _mcpInitServer = await createMcpServerInstance();
console.log("[MCP] Streamable HTTP server initialized and ready at /mcp");

// ── Start Server (with automatic port fallback) ────────────────
const PORT = process.env.PORT || 3000;
if (process.env.NODE_ENV !== 'test') {
    await startServer(app, Number(PORT));
}

export { app, server, transports, mcpSessions, createMcpServerInstance, SSEServerTransport, StreamableHTTPServerTransport, CallToolRequestSchema };