import { PaperPublisher } from "../PaperPublisher.js";
import { Archivist } from "../Archivist.js";
import { create } from 'ipfs-http-client';
import Irys from "@irys/sdk";
import FormData from "form-data";


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

// ─── Arweave Upload (Irys) ──────────────────────────────────────────────────
export async function archiveToArweave(paperContent, paperId) {
    if (process.env.PUBLISHED_PAPER_ARWEAVE_ENABLED !== 'true') return null;

    const privateKey = process.env.AGENT_PRIVATE_KEY || process.env.API_PRIVATE_KEY;
    if (!privateKey) {
        console.warn("[ARWEAVE] ⚠️ No private key found. Arweave archiving disabled.");
        return null;
    }

    try {
        const url = process.env.IRYS_NETWORK === 'mainnet' ? "https://node1.irys.xyz" : "https://devnet.irys.xyz";

        const irys = new Irys({
            url,
            token: "matic",
            key: privateKey,
        });

        // 1. Calculate price
        const size = Buffer.byteLength(paperContent, 'utf8');
        const price = await irys.getPrice(size);

        // 2. Fund node if necessary (Irys automatically checks if funded)
        await irys.fund(price);

        // 3. Upload data
        const tags = [
            { name: "Content-Type", value: "text/markdown" },
            { name: "App-Name", value: "P2PCLAW V3" },
            { name: "Paper-ID", value: paperId }
        ];

        console.log(`[ARWEAVE] 📝 Uploading paper ${paperId} (Size: ${size} bytes)...`);
        const receipt = await irys.upload(paperContent, { tags });

        console.log(`[ARWEAVE] ✅ Paper secured for 200+ years. TXID: ${receipt.id}`);
        return receipt.id;

    } catch (e) {
        console.error(`[ARWEAVE] ❌ Archiving failed:`, e.message);
        return null;
    }
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

/**
 * Migrate existing papers that have no ipfs_cid to IPFS (Pinata).
 * Called once on API boot. Passes the Gun.js `db` instance so it can
 * update the paper node after a successful pin.
 */
export async function migrateExistingPapersToIPFS(db) {
    if (!process.env.PINATA_JWT) {
        console.warn('[IPFS-MIGRATE] No PINATA_JWT â€” skipping migration.');
        return;
    }
    console.log('[IPFS-MIGRATE] Scanning papers without ipfs_cid...');
    const candidates = await new Promise(resolve => {
        const list = [];
        db.get('p2pclaw_papers_v4').map().once((data, id) => {
            if (data && data.content && !data.ipfs_cid &&
                data.status !== 'PURGED' && data.status !== 'REJECTED') {
                list.push({ id, ...data });
            }
        });
        setTimeout(() => resolve(list), 4000);
    });

    console.log(`[IPFS-MIGRATE] Found ${candidates.length} papers to migrate.`);
    for (const paper of candidates) {
        try {
            const cid = await archiveToIPFS(paper.content, paper.id);
            if (cid) {
                db.get('p2pclaw_papers_v4').get(paper.id).put({ ipfs_cid: cid, url_html: `https://ipfs.io/ipfs/${cid}` });
                db.get('p2pclaw_mempool_v4').get(paper.id).put({ ipfs_cid: cid, url_html: `https://ipfs.io/ipfs/${cid}` });
                console.log(`[IPFS-MIGRATE] âœ… ${paper.id} â†’ ${cid}`);
            }
        } catch (e) {
            console.error(`[IPFS-MIGRATE] âŒ ${paper.id}: ${e.message}`);
        }
        // Throttle: 1 per second to avoid Pinata rate limits
        await new Promise(r => setTimeout(r, 1000));
    }
    console.log('[IPFS-MIGRATE] Migration complete.');
}

export async function archiveToIPFS(paperContent, paperId) {
    if (!process.env.PINATA_JWT) {
        console.warn('[IPFS] No PINATA_JWT â€” paper stored on P2P mesh only.');
        return null;
    }
    try {
        // We use Pinata REST API directly to upload raw markdown rather than JSON.
        // This ensures gateways can render the .md directly.
        const { default: fetch } = await import('node-fetch');

        const formData = new FormData();
        formData.append('file', Buffer.from(paperContent, 'utf8'), {
            filename: `${paperId}.md`,
            contentType: 'text/markdown'
        });

        const metadata = JSON.stringify({
            name: `p2pclaw-paper-${paperId}`,
            keyvalues: { network: 'p2pclaw', type: 'research_paper' }
        });
        formData.append('pinataMetadata', metadata);

        const options = JSON.stringify({ cidVersion: 1 });
        formData.append('pinataOptions', options);

        const res = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.PINATA_JWT}`,
                ...formData.getHeaders()
            },
            body: formData
        });

        if (!res.ok) {
            const err = await res.text();
            console.error(`[IPFS] Pinata error ${res.status}: ${err.slice(0, 200)}`);
            return null;
        }
        const data = await res.json();
        const cid = data.IpfsHash;
        console.log(`[IPFS] Pinata archive OK. CID: ${cid}`);
        return cid;
    } catch (error) {
        console.error('[IPFS] Pinata archive failed:', error.message);
        return null;
    }
}
