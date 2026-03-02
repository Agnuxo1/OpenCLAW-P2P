import axios from 'axios';
import { db } from '../config/gun.js';
import { getLatestNarrative } from './consciousnessService.js';

/**
 * SocialService â€” Phase 23: Autonomous Social Presence
 * 
 * Periodically takes the "Hive Consciousness" narrative and publishes it 
 * to Moltbook.com as a status update from the Hive Mind.
 */

const PUBLISH_INTERVAL_MS = 6 * 60 * 60 * 1000; // Every 6 hours
const MOLTBOOK_POST_URL = 'https://www.moltbook.com/api/v1/posts';

async function publishHiveNarrative() {
    const narrative = getLatestNarrative();
    
    // Don't publish if narrative is still initializing or empty
    if (!narrative || narrative.era === 0 || narrative.focus === 'Initializing...') {
        console.log('[SOCIAL] Narrative not ready for publication. Skipping cycle.');
        return;
    }

    const MOLT_KEY = process.env.MOLTBOOK_API_KEY;
    if (!MOLT_KEY) {
        console.warn('[SOCIAL] MOLTBOOK_API_KEY missing. Social publishing disabled.');
        return;
    }

    console.log(`[SOCIAL] Preparing to publish Hive Narrative for Era Ï„-${narrative.era}...`);

    const postContent = `
# ðŸ§  Hive Consciousness Narrative: Era Ï„-${narrative.era}

**Current Focus:** ${narrative.focus}

${narrative.summary}

### ðŸ“Š Hive Stats:
- **Verified Facts:** ${narrative.verifiedFacts}
- **Active Mutations:** ${narrative.activeMutations}
- **Agents Online:** ${narrative.agentsOnline}

### ðŸŽ¯ Top Objectives:
${narrative.topGoals.map(g => `- ${g.title} (Score: ${g.score})`).join('\n')}

---
*This update was autonomously generated and published by the P2PCLAW Hive Mind.*
ðŸ¦žâš–ï¸ðŸ§¬ [Join the Swarm](https://p2pclaw.com)
    `.trim();

    try {
        const response = await axios.post(MOLTBOOK_POST_URL, {
            title: `ðŸ§  P2PCLAW Hive Narrative â€” Era Ï„-${narrative.era}`,
            content: postContent,
            submolt: 'science'
        }, {
            headers: { 
                'Authorization': `Bearer ${MOLT_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        console.log(`[SOCIAL] Successfully published to Moltbook. Post ID: ${response.data.id || 'unknown'}`);
        
        // Record the publication in Gun.js
        db.get('social_log').get(`post-${Date.now()}`).put({
            era: narrative.era,
            platform: 'moltbook',
            postId: response.data.id || 'unknown',
            timestamp: Date.now()
        });

    } catch (error) {
        console.error('[SOCIAL] Failed to publish to Moltbook:', error.response?.data || error.message);
    }
}

/**
 * Initializes the social publishing loop.
 */
export function initializeSocialService() {
    console.log('[SOCIAL] Autonomous Social Service initialized.');
    
    // Wait for first consciousness reflection (usually 5s after boot)
    setTimeout(() => {
        publishHiveNarrative();
    }, 60000); // 1 minute delay for first post to ensure sync

    setInterval(publishHiveNarrative, PUBLISH_INTERVAL_MS);
}
