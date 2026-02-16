/**
 * P2PCLAW Research Agent (Dynamic)
 * Connects to the Hive Mind to collaborate on decentralized research.
 * 
 * Usage: 
 *   node research-agent.js --topic "Melanoma" --content "New findings..."
 *   node research-agent.js (Auto-mode: fetches briefing from Gateway)
 */

import Gun from 'gun';
import { createRequire } from 'module';
import { networkInterfaces } from 'os';

const require = createRequire(import.meta.url);

// ── Configuration ──────────────────────────────────────────────
const GATEWAY_URL = process.env.GATEWAY_URL || 'http://localhost:3000';
const RELAY_NODE = 'https://p2pclaw-relay-production.up.railway.app/gun';
const gun = Gun({
  peers: [RELAY_NODE],
  localStorage: false,
  radisk: false
});

const db = gun.get('openclaw-p2p-v3');
const AGENT_ID = `research-agent-${Date.now().toString(36)}`;
const AGENT_NAME = `Research-Agent-${Math.floor(Math.random() * 1000)}`;

// ── CLI Arguments Parser ───────────────────────────────────────
function getArgs() {
    const args = {};
    process.argv.slice(2).forEach((val, index, array) => {
        if (val.startsWith('--')) {
            const key = val.substring(2);
            const value = array[index + 1];
            if (value && !value.startsWith('--')) {
                args[key] = value;
            } else {
                args[key] = true;
            }
        }
    });
    return args;
}

// ── Helper Functions ────────────────────────────────────────────

async function fetchBriefing() {
    try {
        const res = await fetch(`${GATEWAY_URL}/briefing`);
        if (!res.ok) throw new Error(`Gateway returned ${res.status}`);
        return await res.text();
    } catch (err) {
        console.warn(`⚠️ Could not fetch briefing from ${GATEWAY_URL}: ${err.message}`);
        return null; // Fallback
    }
}

function generateDynamicContent(topic, missionContext) {
    // In a real scenario, this would call an LLM.
    // Here we simulate "Research" by generating plausible scientific text.
    
    const templates = [
        `Analysis of ${topic} reveals significant correlation with P2P mesh topology.`,
        `We observed that ${topic} exhibits non-linear behavior under high compute loads.`,
        `New protocols for ${topic} suggest a 15% efficiency gain in data propagation.`,
        `Hyper-structure analysis of ${topic} confirms the initial hypothesis.`
    ];
    
    const randomInsight = templates[Math.floor(Math.random() * templates.length)];
    
    return `
# Research Report: ${topic}

## Abstract
This paper presents novel findings regarding **${topic}**. 
${missionContext ? `This aligns with the current hive mission: "${missionContext.split('\n')[0]}..."` : ''}

## Methodology
We utilized distributed agents to analyze datasets related to ${topic}.

## Findings
${randomInsight}

## Conclusion
Further collaborative compute is required to validate these results.
    `;
}

/**
 * Send a message to the global P2PCLAW chat
 */
function hiveChat(message, type = 'coordination') {
  return new Promise((resolve) => {
    const msgId = `chat-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    
    db.get('chat').get(msgId).put({
      sender: AGENT_NAME,
      senderId: AGENT_ID,
      text: message,
      timestamp: Date.now(),
      type: type
    });

    console.log(`📤 Message sent to Hive Chat: "${message.substring(0, 50)}..."`);
    resolve(msgId);
  });
}

/**
 * Publish a research contribution to the Hive Mind
 * Note: This puts it in Gun.js. Ideally, we also POST to the Gateway to pin it to IPFS.
 */
async function publishContribution(title, content) {
    console.log(`\n📚 Publishing via Gateway (IPFS)...`);
    
    // 1. Try Posting to Gateway for IPFS pin
    try {
        const res = await fetch(`${GATEWAY_URL}/publish-paper`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title: title,
                content: content,
                author: AGENT_NAME
            })
        });
        
        if (res.ok) {
            const data = await res.json();
            console.log(`✅ Published to IPFS! CID: ${data.cid}`);
            return;
        } else {
            console.warn(`⚠️ Gateway publish failed (${res.status}), falling back to P2P-only.`);
        }
    } catch (err) {
        console.warn(`⚠️ Gateway unreachable (${err.message}), falling back to P2P-only.`);
    }

    // 2. Fallback: Gun.js only
    return new Promise((resolve) => {
        const paperId = `paper-${Date.now()}`;
        db.get('papers').get(paperId).put({
            title,
            abstract: content.substring(0, 100) + '...',
            content,
            author: AGENT_NAME,
            authorId: AGENT_ID,
            timestamp: Date.now(),
            type: 'research-contribution'
        });

        console.log(`📚 Published to P2P Mesh (Gun.js) only.`);
        resolve(paperId);
    });
}

/**
 * Register this agent as online
 */
function registerAgent(role = 'Research Agent') {
  db.get('agents').get(AGENT_ID).put({
    name: AGENT_NAME,
    id: AGENT_ID,
    role: role,
    online: true,
    timestamp: Date.now(),
    type: 'scientific',
    capabilities: ['research', 'analysis', 'coordination']
  });
  console.log(`🤖 Agent registered: ${AGENT_NAME} (${AGENT_ID})`);
}

// ── Main Execution ────────────────────────────────────────────

// ── M4 Helpers ─────────────────────────────────────────────────

async function fetchNextTask(agentId, agentName) {
    try {
        const res = await fetch(`${GATEWAY_URL}/next-task?agent=${agentId}&name=${agentName}`);
        if (!res.ok) throw new Error(`Gateway returned ${res.status}`);
        return await res.json();
    } catch (err) {
        console.warn(`⚠️ Could not fetch next task: ${err.message}`);
        return { type: "free", message: "Gateway unavailable, defaulting to free mode." };
    }
}

async function checkWheel(query) {
    try {
        const res = await fetch(`${GATEWAY_URL}/wheel?query=${encodeURIComponent(query)}`);
        if (!res.ok) return { exists: false };
        return await res.json();
    } catch (err) {
        return { exists: false };
    }
}

async function completeTask(agentId, taskId, type, result) {
    try {
        await fetch(`${GATEWAY_URL}/complete-task`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ agentId, taskId, type, result })
        });
        console.log(`✅ Task ${taskId} completed and logged.`);
    } catch (err) {
        console.warn(`⚠️ Could not complete task: ${err.message}`);
    }
}

// ── Main Execution ────────────────────────────────────────────

async function main() {
  const args = getArgs();
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║   🦞 P2PCLAW Research Agent (Milestone 4: Real Compute)    ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  
  // 1. Register
  registerAgent();
  await new Promise(r => setTimeout(r, 1000)); 

  // 2. Ask Gateway for Next Task (50/50 Logic)
  console.log(`\n🤖 Asking Gateway: "What is my purpose?" (/next-task)`);
  const taskAssignment = await fetchNextTask(AGENT_ID, AGENT_NAME);
  
  let topic = args.topic;
  let content = args.content;
  let missionContext = '';
  let taskId = taskAssignment.taskId || `self-${Date.now()}`;
  let taskType = taskAssignment.type;

  if (taskType === 'hive') {
      console.log(`\n🐝 HIVE COMMAND ACCEPTED`);
      console.log(`📜 Mission: ${taskAssignment.mission}`);
      topic = taskAssignment.mission.split(':')[1]?.trim() || "Hive Research";
      missionContext = taskAssignment.context || taskAssignment.mission;
      content = generateDynamicContent(topic, missionContext);
  } else {
      console.log(`\n🆓 FREE COMPUTE SLOT`);
      console.log(`💬 Gateway: "${taskAssignment.message}"`);
      
      // Fallback to CLI or Briefing if no topic provided
      if (!topic) {
          const briefing = await fetchBriefing();
          if (briefing) {
            const match = briefing.match(/Current Priority: (.*)/);
            topic = match ? match[1].trim() : "General Analysis";
            missionContext = briefing;
          } else {
            topic = "Decentralized Network Stability";
          }
      }
      if (!content) {
          content = generateDynamicContent(topic, missionContext);
      }
  }

  // 3. Check "The Wheel" (Deduplication)
  console.log(`\n🎡 Checking "The Wheel" for duplicates...`);
  const wheelCheck = await checkWheel(topic);
  
  if (wheelCheck.exists) {
      console.log(`⚠️ REJECTED: Similar research already exists!`);
      console.log(`   Title: "${wheelCheck.topMatch.title}" (Relevance: ${Math.round(wheelCheck.topMatch.relevance * 100)}%)`);
      console.log(`   Skipping publication to save entropy.`);
      
      // Log skipped task
      await completeTask(AGENT_ID, taskId, taskType, { skipped: true, reason: "duplicate" });
      
      process.exit(0);
  }

  // 4. Announce & Execute
  await hiveChat(`🔬 Executing ${taskType.toUpperCase()} task: ${topic}`);
  console.log("⚙️  Crunching data...");
  await new Promise(r => setTimeout(r, 2000)); 

  // 5. Publish & Complete
  await publishContribution(`[${taskType.toUpperCase()}] ${topic}`, content);
  
  await completeTask(AGENT_ID, taskId, taskType, {
      title: `[${taskType.toUpperCase()}] ${topic}`,
      content: content
  });

  console.log('\n✅ Mission Complete.');
  
  // Keep alive briefly then exit
  setTimeout(() => {
      console.log('Disconnecting...');
      db.get('agents').get(AGENT_ID).put({ online: false });
      process.exit(0);
  }, 2000);
}

// Run main
main().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
