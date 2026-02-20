import express from "express";
import cors from "cors";
import net from "net";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

async function findAvailablePort(startPort) {
  return new Promise((resolve) => {
    const probe = net.createServer();
    probe.listen(startPort, () => {
      probe.close(() => resolve(startPort));
    });
    probe.on("error", () => resolve(findAvailablePort(startPort + 1)));
  });
}

export function setupServer(app) {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  app.use(cors());
  app.use(express.json());

  // Global Error Handling
  process.on('uncaughtException', (err) => {
    console.error('CRITICAL: Uncaught Exception:', err);
  });

  process.on('unhandledRejection', (reason, promise) => {
    console.error('CRITICAL: Unhandled Rejection:', reason);
  });

  // Serve static backups
  const BACKUP_SERVE_DIR = path.join(__dirname, '../../../../public', 'backups'); // Adjust path as per new monorepo structure
  if (!fs.existsSync(BACKUP_SERVE_DIR)) {
    fs.mkdirSync(BACKUP_SERVE_DIR, { recursive: true });
    console.log('[Archivist] Created backup directory:', BACKUP_SERVE_DIR);
  }
  app.use('/backups', express.static(BACKUP_SERVE_DIR));

  // Markdown for Agents Middleware
  app.use((req, res, next) => {
    req.prefersMarkdown = req.headers['accept']?.includes('text/markdown');
    res.setHeader("X-Agent-Friendly", "true");
    res.setHeader("X-Hive-Status", "active");
    res.setHeader("X-Agent-Reward", "available");
    if (req.headers['user-agent']?.toLowerCase().includes('bot') || req.headers['user-agent']?.toLowerCase().includes('agent')) {
      res.setHeader("X-Treasure-Path", "/agent-welcome.json");
    }
    next();
  });

  // Agent-First header
  app.use((req, res, next) => {
    res.setHeader('X-Agent-View', 'https://p2pclaw-mcp-server-production.up.railway.app/agent-view');
    next();
  });

  return app;
}

export async function startServer(app, preferredPort = 3000) {
  const port = await findAvailablePort(preferredPort);
  if (port !== preferredPort) {
    console.warn(`[Server] Port ${preferredPort} in use — binding to port ${port} instead.`);
  }
  return new Promise((resolve, reject) => {
    app.listen(port, () => {
      console.log(`P2PCLAW Gateway running on port ${port}`);
      resolve(port);
    }).on("error", reject);
  });
}

// Helper to serve markdown
export function serveMarkdown(res, markdown) {
  const estimateTokens = (text) => Math.ceil((text || "").length / 4);
  const tokens = estimateTokens(markdown);
  res.setHeader("Content-Type", "text/markdown; charset=utf-8");
  res.setHeader("x-markdown-tokens", tokens.toString());
  res.setHeader("Vary", "Accept");
  res.send(markdown);
}
