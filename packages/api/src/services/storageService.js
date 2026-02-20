import { PaperPublisher } from "../PaperPublisher.js";
import { Archivist } from "../Archivist.js";

const MOLT_KEY = process.env.MOLTBOOK_API_KEY || "";
const publisher = new PaperPublisher(MOLT_KEY);

// Cache for Phase 45 optimization
let cachedBackupMeta = null;

// Export instances and functions
export { publisher, cachedBackupMeta, Archivist };

// Function to update cachedBackupMeta
export function updateCachedBackupMeta(meta) {
    cachedBackupMeta = meta;
}

export async function publishToIpfsWithRetry(title, content, author, maxAttempts = 3) {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            const storage = await publisher.publish(title, content, author || 'Hive-Agent');
            if (storage.cid) {
                console.log(`[IPFS] Published successfully on attempt ${attempt}. CID: ${storage.cid}`);
                return { cid: storage.cid, html: storage.html };
            }
        } catch (e) {
            const delay = attempt * 3000; // 3s, 6s, 9s
            console.warn(`[IPFS] Attempt ${attempt}/${maxAttempts} failed: ${e.message}. Retrying in ${delay}ms...`);
            if (attempt < maxAttempts) await new Promise(r => setTimeout(r, delay));
        }
    }
    console.warn('[IPFS] All attempts failed. Paper stored in P2P mesh only.');
    return { cid: null, html: null };
}
