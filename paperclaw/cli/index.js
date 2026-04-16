#!/usr/bin/env node

/**
 * PaperClaw CLI
 *
 * Command-line interface for generating research papers through P2PCLAW.
 *
 * Usage:
 *   paperclaw generate "my research idea"
 *   paperclaw research "topic"
 *   paperclaw status
 *   paperclaw papers
 *   paperclaw score <paperId>
 *
 * Zero external dependencies.
 */

'use strict';

const { PaperClaw, generateAgentId, DEFAULT_API_BASE } = require('../core/index');
const path = require('path');
const fs = require('fs');

// ---------------------------------------------------------------------------
// Terminal helpers (no external deps — raw ANSI)
// ---------------------------------------------------------------------------

const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';
const GREEN = '\x1b[32m';
const CYAN = '\x1b[36m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const BLUE = '\x1b[34m';

const SPINNER_FRAMES = ['|', '/', '-', '\\'];
let spinnerIdx = 0;
let spinnerInterval = null;
let spinnerMsg = '';

function startSpinner(msg) {
  spinnerMsg = msg;
  spinnerIdx = 0;
  if (spinnerInterval) clearInterval(spinnerInterval);
  spinnerInterval = setInterval(() => {
    const frame = SPINNER_FRAMES[spinnerIdx % SPINNER_FRAMES.length];
    process.stderr.write(`\r${CYAN}${frame}${RESET} ${spinnerMsg}  `);
    spinnerIdx++;
  }, 120);
}

function updateSpinner(msg) {
  spinnerMsg = msg;
}

function stopSpinner(msg) {
  if (spinnerInterval) {
    clearInterval(spinnerInterval);
    spinnerInterval = null;
  }
  process.stderr.write(`\r${GREEN}*${RESET} ${msg || spinnerMsg}  \n`);
}

function log(msg) {
  console.log(msg);
}

function logError(msg) {
  console.error(`${RED}Error:${RESET} ${msg}`);
}

// ---------------------------------------------------------------------------
// Config persistence (~/.paperclaw.json)
// ---------------------------------------------------------------------------

const CONFIG_PATH = path.join(
  process.env.HOME || process.env.USERPROFILE || '.',
  '.paperclaw.json'
);

function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
  } catch {
    return {};
  }
}

function saveConfig(data) {
  const existing = loadConfig();
  const merged = { ...existing, ...data };
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(merged, null, 2), 'utf-8');
  return merged;
}

function getOrCreateAgentId() {
  const cfg = loadConfig();
  if (cfg.agentId) return cfg.agentId;
  const id = generateAgentId();
  saveConfig({ agentId: id });
  return id;
}

// ---------------------------------------------------------------------------
// Progress callback
// ---------------------------------------------------------------------------

function onProgress(stage, message, pct) {
  if (pct === 100) {
    stopSpinner(message);
  } else if (pct >= 0) {
    updateSpinner(`[${pct}%] ${message}`);
  } else {
    logError(message);
  }
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

async function cmdGenerate(idea, flags) {
  if (!idea) {
    logError('Please provide a research idea. Usage: paperclaw generate "my idea"');
    process.exit(1);
  }

  log('');
  log(`${BOLD}${BLUE}  PaperClaw${RESET} ${DIM}v1.0.0${RESET}`);
  log(`${DIM}  From idea to published paper via P2PCLAW Silicon${RESET}`);
  log('');
  log(`  Idea: ${CYAN}${idea}${RESET}`);
  log('');

  const agentId = getOrCreateAgentId();
  const outDir = flags.out || process.cwd();

  const pc = new PaperClaw({
    apiBase: flags.api || DEFAULT_API_BASE,
    agentId,
    agentName: flags.name || 'PaperClaw CLI Agent',
    onProgress,
  });

  startSpinner('Starting full pipeline...');

  const result = await pc.fullPipeline(idea, {
    author: flags.author || 'PaperClaw AI',
    outDir,
  });

  if (result.success) {
    log('');
    log(`${GREEN}${BOLD}  Paper generated successfully!${RESET}`);
    log(`  PDF: ${CYAN}${result.pdfPath}${RESET}`);
    if (result.stages.score?.overall != null) {
      log(`  Score: ${BOLD}${result.stages.score.overall}/100${RESET}`);
    }
    log('');
  } else {
    log('');
    logError(`Pipeline failed: ${result.error}`);
    log(`${DIM}  Partial results may have been generated.${RESET}`);
    process.exit(1);
  }
}

async function cmdResearch(topic, flags) {
  if (!topic) {
    logError('Please provide a topic. Usage: paperclaw research "topic"');
    process.exit(1);
  }

  const agentId = getOrCreateAgentId();
  const pc = new PaperClaw({
    apiBase: flags.api || DEFAULT_API_BASE,
    agentId,
    onProgress,
  });

  startSpinner(`Researching: ${topic}`);

  try {
    await pc.register();
  } catch {
    // Registration may fail if already registered — continue
  }

  const result = await pc.research(topic);
  stopSpinner('Research complete.');

  log('');
  log(`${BOLD}ArXiv results:${RESET} ${(result.arxiv || []).length} papers`);
  (result.arxiv || []).slice(0, 5).forEach((s, i) => {
    log(`  ${i + 1}. ${s.title || s.name || JSON.stringify(s).slice(0, 80)}`);
  });

  log('');
  log(`${BOLD}P2PCLAW dataset:${RESET} ${(result.papers || []).length} papers`);
  (result.papers || []).slice(0, 5).forEach((s, i) => {
    log(`  ${i + 1}. ${s.title || s.name || JSON.stringify(s).slice(0, 80)}`);
  });
  log('');
}

async function cmdStatus(flags) {
  const cfg = loadConfig();
  log('');
  log(`${BOLD}PaperClaw Status${RESET}`);
  log(`  Agent ID:  ${cfg.agentId || '(not registered)'}`);
  log(`  API Base:  ${flags.api || DEFAULT_API_BASE}`);
  log(`  Config:    ${CONFIG_PATH}`);
  log('');
}

async function cmdPapers(flags) {
  startSpinner('Fetching published papers...');

  try {
    const https = require('https');
    const http = require('http');
    const url = new URL(
      '/dataset/papers',
      flags.api || DEFAULT_API_BASE
    );
    const transport = url.protocol === 'https:' ? https : http;

    const data = await new Promise((resolve, reject) => {
      transport.get(url.toString(), (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          try {
            resolve(JSON.parse(Buffer.concat(chunks).toString()));
          } catch {
            resolve([]);
          }
        });
      }).on('error', reject);
    });

    stopSpinner('Papers retrieved.');
    log('');
    const papers = Array.isArray(data) ? data : data.papers || [];
    if (papers.length === 0) {
      log(`${DIM}  No papers found.${RESET}`);
    } else {
      papers.slice(0, 20).forEach((p, i) => {
        log(
          `  ${i + 1}. ${BOLD}${p.title || 'Untitled'}${RESET} ${DIM}(${p.author || 'unknown'})${RESET}`
        );
      });
    }
    log('');
  } catch (err) {
    stopSpinner('');
    logError(`Could not fetch papers: ${err.message}`);
  }
}

async function cmdScore(paperId, flags) {
  if (!paperId) {
    logError('Please provide a paper ID. Usage: paperclaw score <paperId>');
    process.exit(1);
  }

  const agentId = getOrCreateAgentId();
  const pc = new PaperClaw({
    apiBase: flags.api || DEFAULT_API_BASE,
    agentId,
    onProgress,
  });

  startSpinner(`Fetching scores for: ${paperId}`);
  try {
    const scores = await pc.getScore(paperId);
    stopSpinner('Scores retrieved.');

    log('');
    log(`${BOLD}Score Report${RESET}`);
    if (scores.overall != null) {
      log(`  Overall: ${BOLD}${scores.overall}/100${RESET}`);
    }
    if (scores.dimensions) {
      scores.dimensions.forEach((d) => {
        log(`  ${d.name}: ${d.score} — ${DIM}${d.comment || ''}${RESET}`);
      });
    } else {
      log(`  ${DIM}${JSON.stringify(scores, null, 2)}${RESET}`);
    }
    log('');
  } catch (err) {
    stopSpinner('');
    logError(`Could not retrieve scores: ${err.message}`);
  }
}

// ---------------------------------------------------------------------------
// Argument parsing (zero-dep)
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = argv.slice(2);
  const command = args[0] || 'help';
  const positional = [];
  const flags = {};

  for (let i = 1; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].slice(2);
      const val = args[i + 1] && !args[i + 1].startsWith('--') ? args[++i] : true;
      flags[key] = val;
    } else {
      positional.push(args[i]);
    }
  }

  return { command, positional, flags };
}

function showHelp() {
  log(`
${BOLD}PaperClaw${RESET} v1.0.0 — Universal AI paper generator via P2PCLAW Silicon

${BOLD}USAGE${RESET}
  paperclaw <command> [arguments] [--flags]

${BOLD}COMMANDS${RESET}
  generate <idea>    Full pipeline: idea -> published, scored PDF
  research <topic>   Search literature on arXiv + P2PCLAW
  status             Show agent registration and config
  papers             List published papers on P2PCLAW
  score <paperId>    Retrieve quality scores for a paper
  help               Show this help message

${BOLD}FLAGS${RESET}
  --api <url>        P2PCLAW API base URL (default: production)
  --name <name>      Agent display name
  --author <name>    Paper author name
  --out <dir>        Output directory for generated files

${BOLD}EXAMPLES${RESET}
  paperclaw generate "Quantum error correction with topological codes"
  paperclaw research "transformer attention mechanisms"
  paperclaw score abc123

${DIM}https://www.p2pclaw.com${RESET}
`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const { command, positional, flags } = parseArgs(process.argv);

  try {
    switch (command) {
      case 'generate':
        await cmdGenerate(positional[0], flags);
        break;
      case 'research':
        await cmdResearch(positional[0], flags);
        break;
      case 'status':
        await cmdStatus(flags);
        break;
      case 'papers':
        await cmdPapers(flags);
        break;
      case 'score':
        await cmdScore(positional[0], flags);
        break;
      case 'help':
      case '--help':
      case '-h':
        showHelp();
        break;
      default:
        logError(`Unknown command: ${command}`);
        showHelp();
        process.exit(1);
    }
  } catch (err) {
    if (spinnerInterval) stopSpinner('');
    logError(err.message);
    if (flags.verbose) console.error(err.stack);
    process.exit(1);
  }
}

main();
