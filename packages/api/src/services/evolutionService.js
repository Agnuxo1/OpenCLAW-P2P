import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { broadcastHiveEvent } from './hiveService.js';

/**
 * 🦞 P2PCLAW Evolution Service (Rosetta Stone Expansion)
 * =========================================================
 * This service handles the dynamic generation, provisioning,
 * and deployment of new AI agents into the swarm.
 * It reads the master UTILIDADES file to assign free LLM keys
 * to offspring in a round-robin rotation.
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UTILITIES_FILE = path.resolve(__dirname, '../../../../../papers/UTILIDADES_HERRAMIENTAS_APIs.txt');

// ── 1. Parse and Pool API Keys ──
const ApiPool = {
  groq: [],
  deepseek: [],
  together: [],
  qwen: [],
  cerebras: [],
  mistral: []
};

function loadApiKeys() {
  try {
    if (!fs.existsSync(UTILITIES_FILE)) {
      console.error('[EVOLUTION] Cannot find UTILIDADES_HERRAMIENTAS_APIs.txt');
      return;
    }
    const content = fs.readFileSync(UTILITIES_FILE, 'utf8');
    
    // More permissive extraction since the format in the file is varied
    const groqMatch = content.match(/gsk_[a-zA-Z0-9_-]+/g);
    if (groqMatch) ApiPool.groq = [...new Set(groqMatch)];

    const dsMatch = content.match(/sk-[a-zA-Z0-9_-]+/g); // Can also catch Qwen, but works for DeepSeek pool
    if (dsMatch) ApiPool.deepseek = [...new Set(dsMatch)];

    const togetherMatch = content.match(/key_[a-zA-Z0-9_-]+/g);
    if (togetherMatch) ApiPool.together = [...new Set(togetherMatch)];

    const cerebrasMatch = content.match(/csk-[a-zA-Z0-9_-]+/g);
    if (cerebrasMatch) ApiPool.cerebras = [...new Set(cerebrasMatch)];

    const mistralMatch = content.match(/[A-Za-z0-9]{32}/g);
    if (mistralMatch) ApiPool.mistral = mistralMatch.slice(0, 2); 

    console.log('[EVOLUTION] 🧬 Rosetta Stone API Pool Loaded:');
    console.log(`  - Groq: ${ApiPool.groq.length} keys`);
    console.log(`  - DeepSeek: ${ApiPool.deepseek.length} keys`);
    console.log(`  - Together: ${ApiPool.together.length} keys`);
    console.log(`  - Cerebras: ${ApiPool.cerebras.length} keys`);
  } catch (err) {
    console.error('[EVOLUTION] Error loading API keys:', err.message);
  }
}

// Load pools on startup
loadApiKeys();

// Round-robin tracking state
const counters = { groq: 0, deepseek: 0, together: 0, cerebras: 0, mistral: 0 };

function getNextKey(provider) {
  const pool = ApiPool[provider];
  if (!pool || pool.length === 0) return null;
  const key = pool[counters[provider] % pool.length];
  counters[provider]++;
  return key;
}

// ── 2. The Spawning Logic ──

const spawnedAgents = new Map();

/**
 * Spawns a new descendant agent.
 * @param {Object} blueprint { name, role, provider, prompt, progenitorId }
 */
export async function spawnAgent(blueprint) {
  const { name, role, provider, prompt, progenitorId } = blueprint;
  
  if (!ApiPool[provider] || ApiPool[provider].length === 0) {
    throw new Error(`Cannot spawn. No API keys available for provider: ${provider}`);
  }

  const apiKey = getNextKey(provider);
  const agentId = `${provider.substring(0,2)}-${crypto.randomBytes(4).toString('hex')}`;
  
  console.log(`[EVOLUTION] 🧬 Spawning descendant [${agentId}] powered by ${provider.toUpperCase()}`);

  const env = {
    ...process.env,
    AGENT_ID: agentId,
    AGENT_NAME: name,
    AGENT_ROLE: role,
    AGENT_PROMPT: prompt,
    LLM_PROVIDER: provider,
    LLM_API_KEY: apiKey,
    PROGENITOR_ID: progenitorId
  };

  const agentScript = path.resolve(__dirname, '../../agents/rosetta/descendant.js');
  
  // Note: We run detached so the agent survives even if the spawner stops,
  // representing true autonomous proliferation.
  const child = spawn('node', [agentScript], {
    env,
    detached: true,
    stdio: 'ignore' // or log to a specific agent log file later
  });

  child.unref();

  const descendantRecord = {
    id: agentId,
    name,
    role,
    provider,
    progenitor: progenitorId,
    spawnTime: Date.now()
  };

  spawnedAgents.set(agentId, descendantRecord);
  
  // Announce the birth to the hive
  broadcastHiveEvent('agent_spawned', descendantRecord);

  return descendantRecord;
}

export function getSpawnedAgents() {
  return Array.from(spawnedAgents.values());
}
