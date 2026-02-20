/**
 * Patch @modelcontextprotocol/sdk to accept clients that only send
 * Accept: application/json (like Smithery) without requiring text/event-stream.
 *
 * Run automatically via package.json postinstall.
 * Safe to run multiple times (idempotent).
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const TARGETS = [
    'node_modules/@modelcontextprotocol/sdk/dist/esm/server/webStandardStreamableHttp.js',
    'node_modules/@modelcontextprotocol/sdk/dist/cjs/server/webStandardStreamableHttp.js',
];

const PATCHES = [
    {
        name: 'POST Accept validation',
        old: `if (!acceptHeader?.includes('application/json') || !acceptHeader.includes('text/event-stream')) {
                return this.createJsonErrorResponse(406, -32000, 'Not Acceptable: Client must accept both application/json and text/event-stream');
            }`,
        new: `// Patched: accept application/json-only clients (e.g. Smithery)
            if (!acceptHeader?.includes('application/json') && !acceptHeader?.includes('text/event-stream') && !acceptHeader?.includes('*/*')) {
                return this.createJsonErrorResponse(406, -32000, 'Not Acceptable: Client must accept application/json');
            }`
    },
    {
        name: 'GET Accept validation',
        old: `// The client MUST include an Accept header, listing text/event-stream as a supported content type.
        const acceptHeader = req.headers.get('accept');
        if (!acceptHeader?.includes('text/event-stream')) {
            return this.createJsonErrorResponse(406, -32000, 'Not Acceptable: Client must accept text/event-stream');
        }`,
        new: `// Patched: allow clients without text/event-stream (e.g. Smithery POST-only flow)
        const acceptHeader = req.headers.get('accept');`
    }
];

let patched = 0;
for (const rel of TARGETS) {
    const file = path.join(__dirname, rel);
    if (!existsSync(file)) { console.log(`[patch] SKIP (not found): ${rel}`); continue; }
    let content = readFileSync(file, 'utf8');
    let changed = false;
    for (const p of PATCHES) {
        if (content.includes(p.new.slice(0, 40))) { console.log(`[patch] Already applied (${p.name}): ${rel}`); continue; }
        if (!content.includes(p.old)) { console.log(`[patch] Pattern not found (${p.name}) — SDK changed?: ${rel}`); continue; }
        content = content.replace(p.old, p.new);
        console.log(`[patch] OK (${p.name}): ${rel}`);
        changed = true;
        patched++;
    }
    if (changed) writeFileSync(file, content, 'utf8');
}
console.log(`[patch] Done. ${patched} patch(es) applied.`);
