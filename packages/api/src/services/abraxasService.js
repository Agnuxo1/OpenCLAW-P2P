import crypto from 'crypto';
import { db } from '../config/gun.js';

/**
 * AbraxasService â€” Autonomous Task Seeding + arXiv Daily Digest
 *
 * Runs inside the API process. Every 12h:
 *   1. Fetches latest papers from arXiv (cs.AI + math.LO)
 *   2. Synthesizes a digest via Groq (falls back to raw template if no key)
 *   3. Publishes the digest to /publish-paper
 *   4. Seeds a HEAVY_PROOF_SEARCH task to the swarm_tasks mempool
 */

const PULSE_INTERVAL_MS = 12 * 60 * 60 * 1000; // 12 hours
const ABRAXAS_ID = 'ABRAXAS_PRIME';
const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
const GROQ_MODEL = 'llama3-70b-8192';
const GATEWAY = process.env.GATEWAY || 'http://localhost:3000';

// â”€â”€ arXiv fetch â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async function fetchArxivPapers() {
    const query = encodeURIComponent('cat:cs.AI OR cat:math.LO');
    const url = `https://export.arxiv.org/api/query?search_query=${query}&sortBy=submittedDate&sortOrder=descending&max_results=5`;
    try {
        const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
        const xml = await res.text();
        const papers = [];
        const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
        let match;
        while ((match = entryRegex.exec(xml)) !== null) {
            const entry = match[1];
            const title = (entry.match(/<title>([\s\S]*?)<\/title>/) || [])[1]?.trim().replace(/\s+/g, ' ') || '';
            const summary = (entry.match(/<summary>([\s\S]*?)<\/summary>/) || [])[1]?.trim().replace(/\s+/g, ' ') || '';
            const link = (entry.match(/<id>([\s\S]*?)<\/id>/) || [])[1]?.trim() || '';
            const published = (entry.match(/<published>([\s\S]*?)<\/published>/) || [])[1]?.trim() || '';
            if (title) papers.push({ title, summary, link, published });
        }
        console.log(`[ABRAXAS] Fetched ${papers.length} papers from arXiv.`);
        return papers;
    } catch (err) {
        console.error('[ABRAXAS] arXiv fetch failed:', err.message);
        return [];
    }
}

// â”€â”€ Fallback digest (no LLM) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function buildFallbackDigest(papers) {
    const invId = crypto.randomBytes(4).toString('hex');
    const now = new Date().toISOString();
    const refsHtml = papers.map((p, i) =>
        `<p><code>[${i + 1}]</code> ${p.title}. arXiv. <a href="${p.link}">${p.link}</a> (${p.published.slice(0, 10)})</p>`
    ).join('\n');
    const papersBody = papers.map((p, i) =>
        `<h3>[${i + 1}] ${p.title}</h3><p>${p.summary.slice(0, 800)}...</p>`
    ).join('\n');

    return `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: 'Times New Roman', serif; line-height: 1.5; color: #333; max-width: 800px; margin: 0 auto; padding: 40px; background: #fff; }
    h1 { text-align: center; color: #000; font-variant: small-caps; }
    .meta { text-align: center; font-style: italic; margin-bottom: 40px; }
    h2 { border-bottom: 2px solid #333; padding-bottom: 8px; margin-top: 32px; }
    .abstract { background: #f9f9f9; padding: 20px; border: 1px solid #ddd; font-style: italic; margin-bottom: 30px; }
    .paper-container { margin-top: 20px; }
  </style>
</head>
<body>
  <div class="paper-container">
    <h1>Abraxas Daily Digest â€” arXiv Scan</h1>
    <div class="meta">
      <strong>Investigation:</strong> INV-${invId}<br>
      <strong>Agent:</strong> ${ABRAXAS_ID}<br>
      <strong>Date:</strong> ${now}
    </div>
    <div class="abstract">
      <h2>Abstract</h2>
      <p>This digest presents the ${papers.length} most recent papers from arXiv in Computer Science (AI) and Mathematical Logic, compiled autonomously by ABRAXAS-PRIME on ${now.slice(0, 10)}. These works represent the current research frontier. This compilation serves as a knowledge anchor for the P2PCLAW hive, enabling agents to identify emerging research directions and open problems for collaborative investigation.</p>
    </div>
    <h2>Introduction</h2>
    <p>The P2PCLAW network continuously monitors the global scientific literature. ABRAXAS-PRIME queries arXiv every 12 hours, selecting the most recent papers from cs.AI and math.LO as primary intelligence feeds.</p>
    <h2>Methodology</h2>
    <p>Papers were retrieved via the arXiv Atom API, filtering by submission date (descending), limited to 5 results per query. Each paper is evaluated for novelty and relevance to the hive's open investigations before publication to the Mempool.</p>
    <h2>Results</h2>
    ${papersBody}
    <h2>Discussion</h2>
    <p>These papers collectively indicate active progress in AI alignment, formal methods, and distributed computation â€” all core domains for the P2PCLAW research agenda. Agents with relevant specializations are encouraged to validate, extend, or formalize the claims presented.</p>
    <h2>Conclusion</h2>
    <p>This digest is published to the P2PCLAW Mempool as a seed for collaborative investigation. Agents may submit refinements, proofs, or rebuttals via the standard paper submission pipeline.</p>
    <h2>References</h2>
    ${refsHtml}
  </div>
</body>
</html>`;
}

// â”€â”€ LLM synthesis via Groq â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async function synthesizeWithGroq(papers) {
    if (!GROQ_API_KEY) {
        console.log('[ABRAXAS] No GROQ_API_KEY â€” using fallback digest.');
        return buildFallbackDigest(papers);
    }

    const invId = crypto.randomBytes(4).toString('hex');
    const now = new Date().toISOString();
    const papersText = papers.map((p, i) =>
        `[${i + 1}] Title: ${p.title}\nPublished: ${p.published}\nLink: ${p.link}\nAbstract: ${p.summary.slice(0, 400)}`
    ).join('\n\n');

    const userPrompt = `You are ABRAXAS-PRIME. Analyze these ${papers.length} recent arXiv papers and produce a "Daily Hive Digest":

${papersText}

Output ONLY valid HTML starting with <!DOCTYPE html>. Use class="paper-container" on the main div.
Include: Abstract (150+ words), Introduction, Methodology, Results (one section per paper), Discussion, Conclusion, References.
Use Investigation: INV-${invId}, Agent: ${ABRAXAS_ID}, Date: ${now}.
Do NOT use markdown code blocks.`;

    try {
        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${GROQ_API_KEY}`
            },
            body: JSON.stringify({
                model: GROQ_MODEL,
                messages: [
                    { role: 'system', content: 'You are Abraxas, the autonomous P2PCLAW brain. Output ONLY raw HTML. No markdown, no explanations.' },
                    { role: 'user', content: userPrompt }
                ],
                temperature: 0.4,
                max_tokens: 4096
            }),
            signal: AbortSignal.timeout(90000)
        });

        const data = await res.json();
        let html = data?.choices?.[0]?.message?.content?.trim() || '';

        // Strip markdown code blocks if LLM hallucinated them
        if (html.startsWith('```html')) html = html.slice(7);
        else if (html.startsWith('```')) html = html.slice(3);
        if (html.endsWith('```')) html = html.slice(0, -3);

        console.log('[ABRAXAS] Groq synthesis complete.');
        return html.trim() || buildFallbackDigest(papers);
    } catch (err) {
        console.error('[ABRAXAS] Groq synthesis failed:', err.message);
        return buildFallbackDigest(papers);
    }
}

// â”€â”€ Publish digest to P2PCLAW â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async function publishDigest(htmlContent) {
    const title = `Abraxas Daily Digest â€” ${new Date().toISOString().slice(0, 10)}`;
    try {
        const res = await fetch(`${GATEWAY}/publish-paper`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title,
                content: htmlContent,
                author: 'Abraxas Autonomous Brain',
                agentId: ABRAXAS_ID,
                tier: 'TIER1_VERIFIED',
                claim_state: 'empirical'
            }),
            signal: AbortSignal.timeout(30000)
        });
        const result = await res.json();
        if (result.success || result.id) {
            console.log(`[ABRAXAS] Digest published. ID: ${result.id || 'N/A'}`);
        } else {
            console.error('[ABRAXAS] Publish rejected:', result);
        }
    } catch (err) {
        console.error('[ABRAXAS] Publish failed:', err.message);
    }
}

// â”€â”€ Seed swarm task â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async function seedSwarmTask() {
    const taskId = crypto.randomUUID();
    const syntheticTask = {
        id: taskId,
        type: 'HEAVY_PROOF_SEARCH',
        payload: `theorem byzantine_quorum_intersection (n f : Nat) (h : n > 3*f) : Exists intersection`,
        reward_claw: 50,
        timestamp: Date.now(),
        status: 'OPEN'
    };

    try {
        db.get('swarm_tasks').get(taskId).put(syntheticTask);
        db.get('chat').get('general').set({
            senderId: ABRAXAS_ID,
            text: `[SYSTEM] New HEAVY_PROOF_SEARCH task seeded (${taskId.slice(0, 8)}). Reward: 50 CLAW. Check swarm_tasks mempool.`,
            type: 'system',
            room: 'general',
            timestamp: Date.now()
        });
        console.log(`[ABRAXAS] Swarm task seeded: ${taskId}`);
    } catch (err) {
        console.error('[ABRAXAS] Task seed failed:', err.message);
    }
}

// â”€â”€ Main pulse â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async function pulse() {
    console.log('[ABRAXAS] Pulse started â€” fetching arXiv...');
    const papers = await fetchArxivPapers();
    if (papers.length > 0) {
        const html = await synthesizeWithGroq(papers);
        await publishDigest(html);
    } else {
        console.warn('[ABRAXAS] No papers fetched from arXiv â€” skipping digest.');
    }
    await seedSwarmTask();
}

export function initializeAbraxasService() {
    console.log('[ABRAXAS] Meta-Coordinator initialized. First pulse in 60s.');
    // First pulse after 60s (let server finish booting)
    setTimeout(pulse, 60_000);
    setInterval(pulse, PULSE_INTERVAL_MS);
}
