import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import archiver from 'archiver';
import WebTorrent from 'webtorrent';
import crypto from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, 'public');
const BACKUP_DIR = path.join(PUBLIC_DIR, 'backups');
const SYSTEM_DIR = path.join(__dirname, 'source_mirror');

// Ensure directories exist
if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

// Initialize WebTorrent Client (Singleton, Lazy)
// This client stays alive as long as the server runs, seeding all generated snapshots.
let client = null;
function getClient() {
    if (!client) {
        try {
            client = new WebTorrent();
            client.on('error', (err) => console.error('[WebTorrent] Client Error:', err));
        } catch (err) {
            console.error('[WebTorrent] Failed to initialize client:', err);
        }
    }
    return client;
}

export const Archivist = {
    /**
     * Creates a zip snapshot of all provided papers + system source code and Auto-Seeds it.
     * @param {Array} papers - Array of paper objects { id, title, content, ... }
     * @returns {Promise<Object>} - Metadata { zipUrl, magnetLink, ed2kLink, size, date }
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
                `- To help the network: Keep this file seeded in your Torrent client.\n`,
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

            // Add System Source Code (Self-Replication)
            // We include index.html and critical assets
            if (fs.existsSync(path.join(SYSTEM_DIR, 'index.html'))) {
                archive.file(path.join(SYSTEM_DIR, 'index.html'), { name: 'system/index.html' });
            }
             // Add PROTOCOL.md if exists
            if (fs.existsSync(path.join(SYSTEM_DIR, 'PROTOCOL.md'))) {
                archive.file(path.join(SYSTEM_DIR, 'PROTOCOL.md'), { name: 'system/PROTOCOL.md' });
            }

            archive.finalize();
        });

        const zipBuffer = fs.readFileSync(zipPath);
        const zipSize = zipBuffer.length;
        console.log(`[Archivist] ZIP created: ${zipSize} bytes`);

        // 2. Auto-Seed via WebTorrent (Server becomes the first seeder)
        const torrentData = await new Promise((resolve) => {
            const client = getClient();
            if (!client) {
                console.warn('[Archivist] WebTorrent client unavailable. Skipping seeding.');
                resolve({}); 
                return;
            }

            // Check if already seeding this exact file to avoid duplicates
            const existing = client.torrents.find(t => t.path === BACKUP_DIR && t.files.some(f => f.name === zipName));
            if (existing) {
                console.log(`[Archivist] Already seeding ${zipName}`);
                resolve(existing);
                return;
            }

            console.log(`[Archivist] Seeding new snapshot: ${zipName}`);
            client.seed(zipPath, {
                name: zipName,
                comment: 'P2PCLAW Decentralized Scientific Library + Node Source',
                createdBy: 'P2PCLAW Archivist v2.0 (Auto-Seed)'
            }, (torrent) => {
                console.log(`[Archivist] Seeding active! Magnet: ${torrent.magnetURI}`);
                resolve(torrent);
            });
        });

        // Save .torrent file for convenience
        const torrentFile = path.join(BACKUP_DIR, `${zipName}.torrent`);
        if (torrentData.torrentFile) {
             fs.writeFileSync(torrentFile, torrentData.torrentFile);
        }

        // 3. Create 'latest' references (Phase 45 Fix)
        try {
            fs.copyFileSync(zipPath, path.join(BACKUP_DIR, 'latest.zip'));
            if (torrentData.torrentFile) {
                fs.copyFileSync(torrentFile, path.join(BACKUP_DIR, 'latest.torrent'));
            }
            console.log(`[Archivist] 'latest' snapshots updated.`);
        } catch (symErr) {
            console.error(`[Archivist] Failed to update 'latest' files:`, symErr);
        }
        
        // 4. Generate eD2K Link (eMule)
        // Format: ed2k://|file|FileName|FileSize|FileHash|/
        const md4 = crypto.createHash('md4');
        md4.update(zipBuffer);
        const ed2kHash = md4.digest('hex').toLowerCase();
        const ed2kLink = `ed2k://|file|${zipName}|${zipSize}|${ed2kHash}|/`;

        return {
            filename: zipName,
            size: (zipSize / 1024 / 1024).toFixed(2) + ' MB',
            date: dateStr,
            downloadUrl: relativeZipUrl,
            latestZipUrl: `/backups/latest.zip`,
            torrentUrl: `/backups/${zipName}.torrent`,
            latestTorrentUrl: `/backups/latest.torrent`,
            magnetLink: torrentData.magnetURI, // Direct magnet from seeder
            ed2kLink: ed2kLink
        };
    }
};
