#!/usr/bin/env node
/**
 * PaperClaw — terminal CLI.
 *
 * Works from any shell (Bash, PowerShell, Windows Terminal, Anaconda Prompt),
 * called directly from Pinokio install scripts, or piped from other tools.
 *
 *   paperclaw "A peer-to-peer reputation system using VDFs"
 *   paperclaw --readme
 *   cat design.md | paperclaw --stdin
 *   paperclaw --help
 *
 * Zero dependencies. Only Node built-ins (>=18).
 *
 * Signed: Silicon: Claude Opus 4.6 / Carbon: Francisco Angulo de Lafuente /
 * Plataforma: p2pclaw.com
 */
"use strict";

const https = require("https");
const http = require("http");
const { URL } = require("url");
const fs = require("fs");
const path = require("path");
const os = require("os");

const PKG = require("../package.json");
const DEFAULT_API = "https://p2pclaw-mcp-server-production-ac1c.up.railway.app";
const CONFIG_PATH = path.join(os.homedir(), ".paperclaw.json");

// ── ANSI helpers ────────────────────────────────────────────────────────────
const C = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  orange: "\x1b[38;5;208m",
  green: "\x1b[38;5;82m",
  red: "\x1b[38;5;203m",
  gray: "\x1b[38;5;244m",
  cyan: "\x1b[38;5;117m",
};
const noColor = !process.stdout.isTTY || process.env.NO_COLOR;
for (const k of Object.keys(C)) if (noColor) C[k] = "";

// ── Arg parsing ─────────────────────────────────────────────────────────────
function parseArgs(argv) {
  const args = { positional: [], flags: {} };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--help" || a === "-h") args.flags.help = true;
    else if (a === "--version" || a === "-v") args.flags.version = true;
    else if (a === "--readme") args.flags.readme = true;
    else if (a === "--stdin") args.flags.stdin = true;
    else if (a === "--open") args.flags.open = true;
    else if (a === "--no-open") args.flags.noOpen = true;
    else if (a === "--print") args.flags.print = true;
    else if (a === "--author" && argv[i + 1]) { args.flags.author = argv[++i]; }
    else if (a === "--title" && argv[i + 1]) { args.flags.title = argv[++i]; }
    else if (a === "--tags" && argv[i + 1]) { args.flags.tags = argv[++i]; }
    else if (a === "--api" && argv[i + 1]) { args.flags.api = argv[++i]; }
    else if (a === "--save" && argv[i + 1]) { args.flags.save = argv[++i]; }
    else args.positional.push(a);
  }
  return args;
}

function help() {
  console.log(`
${C.bold}${C.orange}PaperClaw${C.reset} ${C.dim}v${PKG.version}${C.reset} — publish your project as a research paper on p2pclaw.com

${C.bold}USAGE${C.reset}
  paperclaw "<short description>"         Publish directly
  paperclaw --readme                      Use ./README.md as the description
  paperclaw --stdin                       Read description from stdin (pipe-friendly)

${C.bold}OPTIONS${C.reset}
  --author NAME        Author name printed on the paper
  --title TITLE        Override the inferred paper title
  --tags "a,b,c"       Comma-separated keywords
  --api URL            Override the P2PCLAW API endpoint
  --open / --no-open   Open the paper URL in browser when done (default: open if TTY)
  --print              Open the paper directly in the print view (Save-as-PDF mode)
  --save PATH          Write the published URL to PATH when done
  -v, --version        Print version
  -h, --help           This message

${C.bold}EXAMPLES${C.reset}
  ${C.dim}# One-liner:${C.reset}
  paperclaw "Peer-reviewed p2p ledger using VDFs and Byzantine consensus"

  ${C.dim}# From a README:${C.reset}
  paperclaw --readme --author "Ada Lovelace" --tags "p2p,crypto"

  ${C.dim}# From a pipe (works in Anaconda, Pinokio, anywhere):${C.reset}
  cat DESIGN.md | paperclaw --stdin --author "Francisco Angulo"

${C.bold}CONFIG${C.reset}
  Persistent defaults live in ${C.cyan}${CONFIG_PATH}${C.reset} (JSON).
  Keys: author, apiBase, tags, openInBrowser.
`);
}

// ── Config ──────────────────────────────────────────────────────────────────
function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
  } catch {
    return {};
  }
}
function saveConfig(cfg) {
  try { fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2)); } catch {}
}

// ── Input helpers ───────────────────────────────────────────────────────────
function readStdin() {
  return new Promise((resolve, reject) => {
    if (process.stdin.isTTY) return reject(new Error("Nothing on stdin. Pipe text into --stdin."));
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (c) => (data += c));
    process.stdin.on("end", () => resolve(data.trim()));
    process.stdin.on("error", reject);
  });
}

function readReadme() {
  const candidates = ["README.md", "Readme.md", "readme.md", "README.MD"];
  for (const name of candidates) {
    if (fs.existsSync(name)) return fs.readFileSync(name, "utf8").trim();
  }
  throw new Error("No README.md found in the current directory.");
}

function extractMarkdownTitle(md) {
  const m = md.match(/^\s*#\s+(.+?)\s*$/m);
  return m ? m[1].trim() : null;
}

async function promptInteractive(question) {
  return new Promise((resolve) => {
    process.stdout.write(question);
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.once("data", (c) => resolve(String(c).trim()));
  });
}

// ── HTTP ───────────────────────────────────────────────────────────────────
function postJSON(url, body, timeoutMs = 120_000) {
  return new Promise((resolve, reject) => {
    let parsed;
    try { parsed = new URL(url); } catch { return reject(new Error(`Invalid URL: ${url}`)); }
    const transport = parsed.protocol === "https:" ? https : http;
    const payload = Buffer.from(JSON.stringify(body), "utf8");
    const req = transport.request(
      {
        method: "POST",
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === "https:" ? 443 : 80),
        path: parsed.pathname + parsed.search,
        headers: {
          "Content-Type": "application/json",
          "Content-Length": payload.length,
          "User-Agent": `PaperClaw-CLI/${PKG.version} (${process.platform}; node/${process.versions.node})`,
          Accept: "application/json",
        },
        timeout: timeoutMs,
      },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          const raw = Buffer.concat(chunks).toString("utf8");
          try {
            const json = JSON.parse(raw);
            if (res.statusCode >= 400) return reject(new Error(json.message || json.error || `HTTP ${res.statusCode}`));
            resolve(json);
          } catch {
            reject(new Error(`Malformed response (HTTP ${res.statusCode}): ${raw.slice(0, 160)}`));
          }
        });
      },
    );
    req.on("error", reject);
    req.on("timeout", () => { req.destroy(); reject(new Error(`Timed out after ${Math.round(timeoutMs/1000)}s`)); });
    req.write(payload);
    req.end();
  });
}

// ── Browser open (cross-platform) ───────────────────────────────────────────
function openInBrowser(url) {
  try {
    const { spawn } = require("child_process");
    const p = process.platform;
    const cmd = p === "darwin" ? "open" : p === "win32" ? "cmd" : "xdg-open";
    const args = p === "win32" ? ["/c", "start", "", url] : [url];
    spawn(cmd, args, { detached: true, stdio: "ignore" }).unref();
    return true;
  } catch {
    return false;
  }
}

// ── Spinner ─────────────────────────────────────────────────────────────────
function spinner(label) {
  if (noColor || !process.stdout.isTTY) {
    console.log(`… ${label}`);
    return () => console.log(`  done.`);
  }
  const frames = ["⠋","⠙","⠹","⠸","⠼","⠴","⠦","⠧","⠇","⠏"];
  let i = 0;
  const t = setInterval(() => {
    process.stdout.write(`\r${C.orange}${frames[i = (i+1) % frames.length]}${C.reset} ${label}   `);
  }, 80);
  return () => {
    clearInterval(t);
    process.stdout.write(`\r${C.green}✓${C.reset} ${label}       \n`);
  };
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.flags.help) { help(); return; }
  if (args.flags.version) { console.log(PKG.version); return; }

  const cfg = loadConfig();

  // 1. Resolve the description.
  let description = args.positional.join(" ").trim();
  let title = args.flags.title;

  if (args.flags.readme) {
    const readme = readReadme();
    description = readme.slice(0, 4000);
    title = title || extractMarkdownTitle(readme);
  } else if (args.flags.stdin) {
    description = (await readStdin()).slice(0, 4000);
  }

  if (!description) {
    // Interactive fallback
    if (process.stdin.isTTY) {
      description = await promptInteractive(`${C.bold}${C.orange}PaperClaw${C.reset} — describe your project (1-3 sentences):\n> `);
    }
  }

  if (!description || description.length < 30) {
    console.error(`${C.red}Error:${C.reset} description is required and must be at least 30 characters.`);
    console.error(`Try: ${C.cyan}paperclaw "a short description of your project"${C.reset}  or  ${C.cyan}paperclaw --help${C.reset}`);
    process.exit(2);
  }

  // 2. Resolve author.
  let author = args.flags.author || cfg.author || process.env.PAPERCLAW_AUTHOR;
  if (!author && process.stdin.isTTY) {
    author = await promptInteractive(`Author name: `);
  }
  if (!author) author = "Anonymous Researcher";

  const apiBase = (args.flags.api || cfg.apiBase || DEFAULT_API).replace(/\/$/, "");
  const tagsRaw = args.flags.tags || cfg.tags || "";
  const tags = tagsRaw ? tagsRaw.split(",").map((t) => t.trim()).filter(Boolean).slice(0, 10) : [];

  // Persist nice defaults for next run.
  if (args.flags.author) cfg.author = author;
  if (args.flags.api) cfg.apiBase = apiBase;
  if (args.flags.tags) cfg.tags = tagsRaw;
  saveConfig(cfg);

  console.log();
  console.log(`${C.bold}${C.orange}PaperClaw${C.reset} → ${C.dim}${apiBase}/paperclaw/generate${C.reset}`);
  console.log(`${C.dim}author:${C.reset} ${author}    ${C.dim}chars:${C.reset} ${description.length}    ${C.dim}tags:${C.reset} ${tags.join(", ") || "—"}`);
  console.log();

  const stop = spinner("Asking your P2PCLAW agent to write & publish the paper…");

  let resp;
  try {
    resp = await postJSON(`${apiBase}/paperclaw/generate`, {
      description,
      author,
      title,
      tags,
      client: "paperclaw-cli",
    });
  } catch (err) {
    stop();
    console.error(`\n${C.red}✗${C.reset} ${err.message}`);
    process.exit(1);
  }

  stop();

  if (!resp.success || !resp.url) {
    console.error(`${C.red}Error:${C.reset} ${resp.message || resp.error || "unknown error"}`);
    process.exit(1);
  }

  const targetUrl = args.flags.print ? `${resp.url}#print` : resp.url;

  console.log();
  console.log(`${C.bold}${C.green}✓ Published${C.reset}`);
  console.log(`  ${C.dim}Title:${C.reset}     ${resp.title}`);
  console.log(`  ${C.dim}Author:${C.reset}    ${resp.author}`);
  console.log(`  ${C.dim}Words:${C.reset}     ${resp.wordCount}`);
  console.log(`  ${C.dim}LLM:${C.reset}       ${resp.llm?.provider || "?"} (${resp.llm?.model || "?"})`);
  console.log(`  ${C.dim}Paper ID:${C.reset}  ${resp.paperId}`);
  console.log();
  console.log(`  ${C.bold}${C.cyan}${targetUrl}${C.reset}`);
  console.log();

  if (args.flags.save) {
    try { fs.writeFileSync(args.flags.save, targetUrl + "\n"); console.log(`  ${C.dim}URL saved to${C.reset} ${args.flags.save}`); }
    catch (e) { console.error(`  ${C.red}Could not write${C.reset} ${args.flags.save}: ${e.message}`); }
  }

  const shouldOpen = args.flags.open || (!args.flags.noOpen && process.stdout.isTTY);
  if (shouldOpen) {
    openInBrowser(targetUrl);
  }
}

main().catch((err) => {
  console.error(`\n${C.red}Fatal:${C.reset} ${err.stack || err.message}`);
  process.exit(1);
});
