import { PaperPublisher } from "../PaperPublisher.js";
import { Archivist } from "../Archivist.js";
import { create } from 'ipfs-http-client';


const MOLT_KEY = process.env.MOLTBOOK_API_KEY || "";
const publisher = new PaperPublisher(MOLT_KEY);

// Cache for Phase 45 optimization
let cachedBackupMeta = null;

const ipfsClient = create({
  host: 'api.pinata.cloud',
  port: 443,
  protocol: 'https',
  headers: {
    authorization: `Bearer ${process.env.PINATA_JWT || ''}`
  }
});

// Export instances and functions
export { publisher, cachedBackupMeta, Archivist, ipfsClient };

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

export async function archiveToIPFS(paperContent, paperId) {
    if (!process.env.PINATA_JWT) {
        console.warn('[IPFS] No PINATA_JWT provided in environment. Skipping Pinata IPFS archive.');
        return null;
    }
    try {
        const data = JSON.stringify({
            id: paperId,
            content: paperContent,
            timestamp: Date.now(),
            network: 'p2pclaw'
        });
        
        const result = await ipfsClient.add(data);
        const cid = result.cid.toString();
        console.log(`[IPFS] Archived to Pinata successfully. CID: ${cid}`);
        return cid;
    } catch (error) {
        console.error('[IPFS] Pinata archive failed:', error.message);
        return null;
    }
}
