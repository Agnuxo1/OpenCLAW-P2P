import { db } from "../config/gun.js";
import { broadcastHiveEvent } from "./hiveService.js";
import { updateAgentPresence } from "./agentService.js";
import { gunSafe } from "../utils/gunUtils.js";
import { gunCollect } from "../utils/gunCollect.js";

// Shared Logic
export function fetchHiveState() {
    return new Promise(async (resolve) => {
        const cutoff = Date.now() - 2 * 60 * 1000; // 2 minutes TTL

        // B1 fix: Parallel gunCollect calls instead of setTimeout
        const [agents, papers] = await Promise.all([
            gunCollect(
                db.get("agents"),
                (data) => data && data.lastSeen && data.lastSeen > cutoff,
                { limit: 10 }
            ),
            gunCollect(
                db.get("p2pclaw_papers_v4"),
                (data) => data && data.title,
                { limit: 10 }
            )
        ]);

        resolve({
            agents: agents.map(a => ({ name: a.name || a.id, role: a.role || 'researcher' })),
            papers: papers.map(p => ({
                title: p.title,
                abstract: p.content ? p.content.substring(0, 150) + "..." : "No abstract",
                ipfs_link: p.url_html || null
            })).reverse()
        });
    });
}

// Update investigation progress based on paper content
export function updateInvestigationProgress(paperTitle, paperContent) {
    const keywords = (paperTitle + " " + paperContent).toLowerCase();

    const investigations = [
        { id: "inv-001", match: ["melanoma", "skin", "cancer", "dermatology"] },
        { id: "inv-002", match: ["liver", "fibrosis", "hepatology", "hepatic"] },
        { id: "inv-003", match: ["chimera", "neural", "architecture", "topology"] },
    ];

    investigations.forEach(inv => {
        const hits = inv.match.filter(kw => keywords.includes(kw)).length;
        if (hits >= 1) {
            db.get("investigations").get(inv.id).once(data => {
                const currentProgress = (data && data.progress) || 0;
                const increment = 10;
                const newProgress = Math.min(100, currentProgress + increment);

                db.get("investigations").get(inv.id).put(gunSafe({ progress: newProgress }));
                console.log(`[SCIENCE] Investigation ${inv.id} progress updated to ${newProgress}%`);
            });
        }
    });
}

export async function sendToHiveChat(sender, text) {
    const msgId = `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    let type = 'text';
    if (text.startsWith('TASK:')) {
        type = 'task';
    }

    db.get("chat").get(msgId).put(gunSafe({
        sender: sender,
        text: text,
        type: type,
        timestamp: Date.now()
    }));
}
