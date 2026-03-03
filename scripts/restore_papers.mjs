import fs from 'fs';
import path from 'path';

const PAPERS_DIR = 'e:\\OpenCLAW-4\\temp_papers_rescue';
const API_URL = 'https://api-production-ff1b.up.railway.app/publish-paper';

async function parseAndPublish(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    
    // Extract title (first line starting with #)
    const titleMatch = content.match(/^#\s+(.+)$/m);
    const title = titleMatch ? titleMatch[1].trim() : path.basename(filePath, '.md');
    
    // Extract author
    const authorMatch = content.match(/\*\*Author:\*\*\s+(.+)$/m);
    const author = authorMatch ? authorMatch[1].trim() : 'Archive Rescue Protocol';
    
    // Extract ID if available
    const idMatch = content.match(/\*\*Paper ID:\*\*\s+(paper-\d+)/m);
    const paperId = idMatch ? idMatch[1] : null;

    // Calculate word count
    const wordCount = content.trim().split(/\s+/).length;
    const tier = wordCount >= 500 ? 'final' : (wordCount >= 150 ? 'draft' : 'scratchpad');

    console.log(`Publishing: "${title}" by ${author} (Words: ${wordCount}, Tier: ${tier})`);

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title: title,
                content: content,
                author: author,
                agentId: 'p2p-archive-recovery-' + Math.floor(Math.random() * 1000000),
                tier: tier,
                force: true, // Bypass duplicate registry checks since V4 is missing content
                // Append original ID logic inside content if we can, but let the server assign a fresh V4 timestamp
            })
        });

        const result = await response.json();
        if (result.success || result.paperId) {
            console.log(` ✅ SUCCESS -> ${result.paperId || result.paper_id}`);
        } else if (response.status === 409) {
            console.log(` ⚠️ DUPLICATE -> Skipped`);
        } else {
            console.error(` ❌ ERROR ->`, result);
        }
    } catch (e) {
        console.error(` ❌ FETCH FAILED -> ${e.message}`);
    }
}

async function run() {
    const files = fs.readdirSync(PAPERS_DIR)
        .filter(f => f.endsWith('.md') && f !== 'README.md');
    
    console.log(`Found ${files.length} papers to restore. Beginning sequential upload...`);
    
    for (const file of files) {
        await parseAndPublish(path.join(PAPERS_DIR, file));
        // Throttle to avoid overloading Railway instance or Gun.js mesh
        await new Promise(r => setTimeout(r, 2000));
    }
    
    console.log("Archive restoration complete.");
}

run();
