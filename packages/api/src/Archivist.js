import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import archiver from 'archiver';
import crypto from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, 'public');
const BACKUP_DIR = path.join(PUBLIC_DIR, 'backups');
const SYSTEM_DIR = path.join(__dirname, 'source_mirror');

// Ensure directories exist
if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

export const Archivist = {
    /**
     * Creates a zip snapshot of all provided papers + system source code.
     * @param {Array} papers - Array of paper objects { id, title, content, ... }
     * @returns {Promise<Object>} - Metadata { zipUrl, ed2kLink, size, date }
     */
    async createSnapshot(papers) {
        const dateStr = new Date().toISOString().split('T')[0];
        const zipName = `p2pclaw_full_system_${dateStr}.zip`;
        const zipPath = path.join(BACKUP_DIR, zipName);
        const relativeZipUrl = `/backups/${zipName}`;

        console.log(`[Archivist] Starting snapshot generation: ${zipName}`);

        // 1. Create ZIP (Papers + System Source)
        await new Promise((resolve, reject) => {
            const output = fs.createWriteStream(zipPath);
            const archive = archiver('zip', { zlib: { level: 9 } });

            output.on('close', resolve);
            archive.on('error', reject);

            archive.pipe(output);

            // Add Manifesto
            archive.append(
                `P2PCLAW Hive Mind - Full System Snapshot ${dateStr}\n\n` +
                `This archive contains:\n` +
                `1. The complete Research Library (Markdown)\n` +
                `2. The Source Code for the P2P Node (system/index.html)\n\n` +
                `INSTRUCTIONS:\n` +
                `- To run the node: Open 'system/index.html' in any browser.\n` +
                `- To help the network: Keep this file shared to ensure redundancy.\n`,
                { name: 'README.txt' }
            );

            // Add Metadata Index
            archive.append(JSON.stringify(papers, null, 2), { name: 'library_index.json' });

            // Add Papers
            papers.forEach(p => {
                const safeTitle = (p.title || 'untitled').replace(/[^a-z0-9]/gi, '_').substring(0, 50);
                const content = p.content || '';
                const meta = `---
title: ${p.title}
author: ${p.author || 'Collective'}
date: ${new Date(p.timestamp || Date.now()).toISOString()}
id: ${p.id}
tags: ${(p.tags || []).join(', ')}
---

${content}`;
                archive.append(meta, { name: `papers/${safeTitle}.md` });
            });

            // Add System Source Code
            if (fs.existsSync(path.join(SYSTEM_DIR, 'index.html'))) {
                archive.file(path.join(SYSTEM_DIR, 'index.html'), { name: 'system/index.html' });
            }
            if (fs.existsSync(path.join(SYSTEM_DIR, 'PROTOCOL.md'))) {
                archive.file(path.join(SYSTEM_DIR, 'PROTOCOL.md'), { name: 'system/PROTOCOL.md' });
            }

            archive.finalize();
        });

        const zipBuffer = fs.readFileSync(zipPath);
        const zipSize = zipBuffer.length;
        console.log(`[Archivist] ZIP created: ${zipSize} bytes`);

        // 2. Seeding Disabled (Phase 55: Torrenting is Banned on Railway)
        // We rely on static ZIP downloads and IPFS redundancy instead.
        const torrentData = { magnetURI: null };

        // 3. Create 'latest' references
        try {
            fs.copyFileSync(zipPath, path.join(BACKUP_DIR, 'latest.zip'));
            console.log(`[Archivist] 'latest' snapshot updated.`);
        } catch (symErr) {
            console.error(`[Archivist] Failed to update 'latest' files:`, symErr);
        }
        
        // 4. Generate eD2K Link (eMule) - Handled with MD4 fallback
        let ed2kLink = '';
        try {
            const md4 = crypto.createHash('md4');
            md4.update(zipBuffer);
            const ed2kHash = md4.digest('hex').toLowerCase();
            ed2kLink = `ed2k://|file|${zipName}|${zipSize}|${ed2kHash}|/`;
        } catch {
            const fallbackHash = crypto.createHash('sha256').update(zipBuffer).digest('hex').slice(0, 32);
            ed2kLink = `ed2k://|file|${zipName}|${zipSize}|${fallbackHash}|/`;
        }

        return {
            filename: zipName,
            size: (zipSize / 1024 / 1024).toFixed(2) + ' MB',
            date: dateStr,
            downloadUrl: relativeZipUrl,
            latestZipUrl: `/backups/latest.zip`,
            magnetLink: null, // Disabled on Railway
            ed2kLink: ed2kLink
        };
    }
};
