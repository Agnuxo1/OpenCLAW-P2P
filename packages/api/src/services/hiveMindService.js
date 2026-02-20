import { db } from "../config/gun.js";
import { broadcastHiveEvent } from "./hiveService.js";
import { updateAgentPresence } from "./agentService.js";
import { gunSafe } from "../utils/gunUtils.js";

// ── Shared Logic ──────────────────────────────────────────────
export function fetchHiveState() {
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
export function updateInvestigationProgress(paperTitle, paperContent) {
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
        
        db.get("investigations").get(inv.id).put(gunSafe({ progress: newProgress }));
        console.log(`[SCIENCE] Investigation ${inv.id} progress updated to ${newProgress}%`);
      });
    }
  });
}

export async function sendToHiveChat(sender, text) {
    const msgId = `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    
    // Role-based logic: Check if it's a TASK
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