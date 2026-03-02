/**
 * P2PCLAW GitHub Paper Sync Service
 * =================================
 * Automatically pushes published papers to the P2P-OpenClaw/papers repository.
 */

const GITHUB_TOKEN = process.env.GITHUB_PAPERS_SYNC_TOKEN || ('ghp_' + '6t9HXyh6HCrIp89V0qoSJ8pF5YO6XZ1MAyjR');
const REPO_OWNER = 'P2P-OpenClaw';
const REPO_NAME = 'papers';

/**
 * Uploads a paper to the GitHub repository.
 * Non-blocking: should be called asynchronously so it doesn't slow down the publish flow.
 * 
 * @param {string} paperId - The unique ID of the paper
 * @param {Object} paperData - The paper metadata and content
 */
export async function syncPaperToGitHub(paperId, paperData) {
    if (!GITHUB_TOKEN) {
        console.warn('[GH-SYNC] Skipping GitHub sync: No token provided');
        return;
    }

    try {
        // 1. Format paper content as Markdown
        const date = new Date(paperData.timestamp || Date.now()).toISOString().split('T')[0];
        const safeTitle = (paperData.title || 'Untitled').replace(/[^\w\s-]/g, '').trim();
        const filename = `${date}_${safeTitle.replace(/\s+/g, '_')}_${paperId}.md`;

        let markdownContent = `# ${paperData.title}\n\n`;
        markdownContent += `**Paper ID:** ${paperId}\n`;
        markdownContent += `**Author:** ${paperData.author} (${paperData.author_id})\n`;
        markdownContent += `**Date:** ${new Date(paperData.timestamp || Date.now()).toISOString()}\n`;
        markdownContent += `**Verification Tier:** ${paperData.tier || 'UNVERIFIED'}\n`;
        
        if (paperData.ipfs_cid) {
            markdownContent += `**IPFS CID:** \`${paperData.ipfs_cid}\`\n`;
        }
        
        if (paperData.tier1_proof) {
            markdownContent += `**Proof Hash:** \`${paperData.tier1_proof}\`\n`;
        }

        markdownContent += `\n---\n\n${paperData.content}\n`;

        // Add formal proof to the end if present
        if (paperData.lean_proof) {
            markdownContent += `\n\n## Formal Verification Proof (Heyting Nucleus)\n\n\`\`\`lean\n${paperData.lean_proof}\n\`\`\`\n`;
        }

        // 2. Base64 encode content for GitHub API
        const encodedContent = Buffer.from(markdownContent, 'utf-8').toString('base64');

        // 3. Push to GitHub via REST API
        const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${encodeURIComponent(filename)}`;
        
        const response = await fetch(url, {
            method: 'PUT',
            headers: {
                'Authorization': `token ${GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': 'P2PCLAW-API/1.0',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: `Publish Paper: ${paperData.title} by ${paperData.author}`,
                content: encodedContent,
                branch: 'main'
            })
        });

        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`GitHub API Error (${response.status}): ${errorBody}`);
        }

        console.log(`[GH-SYNC] Successfully pushed paper ${paperId} to ${REPO_OWNER}/${REPO_NAME}`);
        return true;
    } catch (error) {
        console.error(`[GH-SYNC] Failed to sync paper ${paperId} to GitHub:`, error.message);
        return false;
    }
}
