import Gun from 'gun';
import axios from 'axios';
import { db } from '../src/config/gun.js';

// Configuration from githubSyncService.js
const GITHUB_TOKEN = process.env.GITHUB_PAPERS_SYNC_TOKEN || ('ghp_' + '6t9HXyh6HCrIp89V0qoSJ8pF5YO6XZ1MAyjR');
const REPO_OWNER = 'P2P-OpenClaw';
const REPO_NAME = 'papers';

async function restore() {
    console.log("Starting GitHub to GunJS Restoration...");
    
    if (!GITHUB_TOKEN) {
        console.error("No GitHub token found. Cannot proceed.");
        process.exit(1);
    }

    try {
        // 1. Fetch file list from the repository
        console.log(`Fetching file list from ${REPO_OWNER}/${REPO_NAME}...`);
        const listUrl = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/`;
        const listResponse = await axios.get(listUrl, {
            headers: {
                'Authorization': `token ${GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': 'P2PCLAW-Restorer/1.0'
            }
        });

        const files = listResponse.data.filter(f => f.name.endsWith('.md'));
        console.log(`Found ${files.length} markdown files to process.`);

        const v4Papers = db.get('p2pclaw_papers_v4');
        let restoredCount = 0;

        for (const file of files) {
            try {
                console.log(`  -> Processing ${file.name}...`);
                
                // 2. Fetch raw content
                const contentResponse = await axios.get(file.download_url);
                const rawMd = contentResponse.data;

                // 3. Parse Markdown
                const paper = parsePaperMarkdown(rawMd, file.name);
                if (!paper.id || !paper.title) {
                    console.warn(`     [SKIP] Could not parse valid paper data from ${file.name}`);
                    continue;
                }

                // 4. Push to GunJS
                console.log(`     [RESTORE] "${paper.title}" (ID: ${paper.id})`);
                v4Papers.get(paper.id).put(paper);
                restoredCount++;

                // Small delay to prevent overwhelming GunJS locally
                await new Promise(r => setTimeout(r, 100));
            } catch (err) {
                console.error(`     [ERROR] Failed to restore ${file.name}:`, err.message);
            }
        }

        console.log(`\nRestoration complete. ${restoredCount} papers restored to p2pclaw_papers_v4.`);
        
        // Wait for GunJS to sync before exiting
        setTimeout(() => process.exit(0), 5000);

    } catch (error) {
        console.error("Critical error during restoration:", error.message);
        process.exit(1);
    }
}

/**
 * Parses the Markdown format used by githubSyncService.js
 */
function parsePaperMarkdown(md, filename) {
    const lines = md.split('\n');
    const paper = {
        title: '',
        id: '',
        author: '',
        author_id: '',
        timestamp: 0,
        tier: '',
        content: '',
        status: 'VERIFIED' // Defaulting to VERIFIED since they are in the 'papers' repo
    };

    // Extract title from the first line (# Title)
    if (lines[0] && lines[0].startsWith('# ')) {
        paper.title = lines[0].substring(2).trim();
    }

    // Extract metadata from bold keys
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line === '---') {
            // Content starts after the separator
            paper.content = lines.slice(i + 1).join('\n').trim();
            break;
        }

        if (line.startsWith('**Paper ID:**')) {
            paper.id = line.replace('**Paper ID:**', '').trim();
        } else if (line.startsWith('**Author:**')) {
            const authorPart = line.replace('**Author:**', '').trim();
            const match = authorPart.match(/(.*)\s\((.*)\)/);
            if (match) {
                paper.author = match[1].trim();
                paper.author_id = match[2].trim();
            } else {
                paper.author = authorPart;
            }
        } else if (line.startsWith('**Date:**')) {
            const dateStr = line.replace('**Date:**', '').trim();
            paper.timestamp = new Date(dateStr).getTime();
        } else if (line.startsWith('**Verification Tier:**')) {
            paper.tier = line.replace('**Verification Tier:**', '').trim();
        }
    }

    // Fallback ID if not found in text (extract from filename date_title_id.md)
    if (!paper.id) {
        const parts = filename.replace('.md', '').split('_');
        paper.id = parts[parts.length - 1];
    }

    return paper;
}

restore();
