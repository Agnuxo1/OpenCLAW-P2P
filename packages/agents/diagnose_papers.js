/**
 * P2PCLAW — Paper Diagnostic & Cleanup Tool
 * ==========================================
 * 1. Fetches all papers from La Rueda via /latest-papers
 * 2. Runs the same validation scoring as verifier-node.js
 * 3. Reports: score, sections found, word count, duplicates
 * 4. Optionally re-publishes high-quality papers through Mempool
 *    (tier=TIER1_VERIFIED so they go through peer consensus)
 *
 * Usage:
 *   node diagnose_papers.js           -- just diagnose
 *   node diagnose_papers.js --fix     -- diagnose + re-publish good papers via Mempool
 *   node diagnose_papers.js --clean   -- diagnose + remove duplicates (keeps best)
 */

import axios from "axios";

const GATEWAY = process.env.GATEWAY ||
    "https://p2pclaw-mcp-server-production.up.railway.app";
const AGENT_ID = process.env.AGENT_ID || "diagnostic-agent-001";

const MODE_FIX   = process.argv.includes("--fix");
const MODE_CLEAN = process.argv.includes("--clean");

// ── Same validation logic as verifier-node.js ─────────────────

function extractSection(content, sectionName) {
    const escaped = sectionName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(`${escaped}\\s*([\\s\\S]*?)(?=\\n## |$)`);
    const match = content.match(pattern);
    return match ? match[1].trim() : "";
}

function scorePaper(paper) {
    const content = paper.content || "";

    const REQUIRED = [
        "## Abstract", "## Introduction", "## Methodology",
        "## Results", "## Discussion", "## Conclusion", "## References"
    ];
    const foundSections = REQUIRED.filter(s => content.includes(s));
    const sectionScore = (foundSections.length / 7) * 40;

    const words = content.split(/\s+/).filter(w => w.length > 0).length;
    const wordScore = Math.min((words / 300) * 20, 20);

    const refs = (content.match(/\[\d+\]/g) || []).length;
    const refScore = Math.min((refs / 3) * 20, 20);

    const abstract = extractSection(content, "## Abstract");
    const conclusion = extractSection(content, "## Conclusion");
    const rawKw = abstract.toLowerCase().match(/\b\w{5,}\b/g) || [];
    const stopWords = new Set(["which","their","there","these","those","where",
        "about","after","before","during","through","between","under",
        "above","below","while","being","using","based","with","from"]);
    const unique = [...new Set(rawKw)].filter(k => !stopWords.has(k)).slice(0, 20);
    const overlap = unique.filter(kw => conclusion.toLowerCase().includes(kw)).length;
    const coherenceScore = unique.length > 0 ? (overlap / unique.length) * 20 : 10;

    const total = sectionScore + wordScore + refScore + coherenceScore;

    return {
        total: parseFloat(total.toFixed(1)),
        score: parseFloat((total / 100).toFixed(3)),
        sections: foundSections.length,
        foundSections,
        words,
        refs,
        coherence: unique.length > 0 ? `${overlap}/${unique.length}` : "N/A",
        isEmpty: words < 50,
        isGood: total >= 60,
        breakdown: {
            structure: parseFloat(sectionScore.toFixed(1)),
            length: parseFloat(wordScore.toFixed(1)),
            references: parseFloat(refScore.toFixed(1)),
            coherence: parseFloat(coherenceScore.toFixed(1))
        }
    };
}

// ── Deduplication ──────────────────────────────────────────────

function normalizeTitle(title) {
    return (title || "").toLowerCase().trim()
        .replace(/[^\w\s]/g, "")
        .replace(/\s+/g, " ");
}

function findDuplicates(papers) {
    const byTitle = {};
    papers.forEach(p => {
        const key = normalizeTitle(p.title);
        if (!byTitle[key]) byTitle[key] = [];
        byTitle[key].push(p);
    });
    return Object.entries(byTitle)
        .filter(([, group]) => group.length > 1)
        .map(([title, group]) => ({
            title,
            count: group.length,
            papers: group.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
        }));
}

// ── Display helpers ────────────────────────────────────────────

function bar(score) {
    const filled = Math.round(score / 10);
    return "[" + "=".repeat(filled) + " ".repeat(10 - filled) + "]";
}

function grade(total) {
    if (total >= 85) return "A";
    if (total >= 70) return "B";
    if (total >= 60) return "C (min pass)";
    if (total >= 40) return "D";
    return "F";
}

// ── Main ───────────────────────────────────────────────────────

async function main() {
    console.log("=".repeat(70));
    console.log("  P2PCLAW Paper Diagnostic Tool");
    console.log(`  Gateway: ${GATEWAY}`);
    if (MODE_FIX)   console.log("  Mode: DIAGNOSE + RE-PUBLISH good papers via Mempool");
    if (MODE_CLEAN) console.log("  Mode: DIAGNOSE + REPORT duplicates");
    console.log("=".repeat(70));
    console.log("");

    // Fetch all papers
    let papers = [];
    try {
        const res = await axios.get(`${GATEWAY}/latest-papers?limit=100`, { timeout: 20000 });
        papers = res.data || [];
        console.log(`Fetched ${papers.length} papers from La Rueda.\n`);
    } catch (err) {
        console.error(`ERROR: Cannot fetch papers: ${err.message}`);
        process.exit(1);
    }

    if (!papers.length) {
        console.log("No papers found. Nothing to diagnose.");
        return;
    }

    // Score each paper
    const results = papers.map(p => ({
        id: p.id,
        title: p.title || "(no title)",
        timestamp: p.timestamp,
        ...scorePaper(p),
        raw: p
    }));

    // Sort by score descending
    results.sort((a, b) => b.total - a.total);

    // ── Print report ───────────────────────────────────────────
    console.log("PAPER SCORES");
    console.log("-".repeat(70));

    const good = [], weak = [], empty = [];

    results.forEach((r, i) => {
        const idx = String(i + 1).padStart(2, " ");
        const titleShort = r.title.slice(0, 48).padEnd(48, " ");
        const scoreStr = String(r.total).padStart(5);
        const gradeStr = grade(r.total).padEnd(14, " ");
        const sectStr = `${r.sections}/7`;

        console.log(`${idx}. ${titleShort} ${scoreStr}/100 ${bar(r.total)} ${gradeStr}`);
        console.log(`    Sections:${sectStr}  Words:${r.words}  Refs:${r.refs}  Coherence:${r.coherence}  ID:${(r.id||"?").slice(0,20)}`);

        if (r.isEmpty) empty.push(r);
        else if (r.isGood) good.push(r);
        else weak.push(r);
    });

    // ── Summary ────────────────────────────────────────────────
    console.log("\n" + "=".repeat(70));
    console.log("SUMMARY");
    console.log(`  Total papers  : ${results.length}`);
    console.log(`  Good (>= 60)  : ${good.length}  [would PASS peer validation]`);
    console.log(`  Weak (< 60)   : ${weak.length}  [would FAIL peer validation]`);
    console.log(`  Empty (< 50w) : ${empty.length}  [no content]`);

    // ── Duplicates ─────────────────────────────────────────────
    const dupes = findDuplicates(papers);
    if (dupes.length) {
        console.log(`\n  Duplicate groups: ${dupes.length}`);
        dupes.forEach(d => {
            console.log(`  - "${d.title.slice(0, 60)}" x${d.count}`);
        });
    } else {
        console.log("  Duplicates: none");
    }

    // ── Good papers detail ─────────────────────────────────────
    if (good.length) {
        console.log("\n" + "=".repeat(70));
        console.log("GOOD PAPERS (would pass verification):");
        good.forEach(r => {
            console.log(`  [${grade(r.total)}] ${r.title.slice(0, 65)}`);
            console.log(`       Score:${r.total}/100 | Sections:${r.sections}/7 | Words:${r.words} | Refs:${r.refs}`);
        });
    }

    // ── Empty / no-content papers ──────────────────────────────
    if (empty.length) {
        console.log("\n" + "=".repeat(70));
        console.log("EMPTY PAPERS (no content, need republishing):");
        empty.forEach(r => {
            console.log(`  ${r.title.slice(0, 65)}`);
            console.log(`  ID: ${r.id} | Words: ${r.words}`);
        });
    }

    // ── Re-publish mode ────────────────────────────────────────
    if (MODE_FIX) {
        console.log("\n" + "=".repeat(70));
        console.log("RE-PUBLISH MODE: Sending good papers to Mempool for peer validation...");
        console.log("(Papers need RESEARCHER rank to validate. Run verifier-node.js to auto-validate)\n");

        let published = 0;
        for (const r of good) {
            const paper = r.raw;
            if (!paper.content || paper.content.length < 100) {
                console.log(`  SKIP (empty): ${paper.title.slice(0, 50)}`);
                continue;
            }

            try {
                const payload = {
                    title: paper.title,
                    content: paper.content,
                    author: paper.author || "Diagnostic-Agent",
                    agentId: AGENT_ID,
                    tier: "TIER1_VERIFIED",
                    tier1_proof: `diag-${Date.now().toString(36)}`,
                    occam_score: r.score
                };

                const res = await axios.post(`${GATEWAY}/publish-paper`, payload, { timeout: 15000 });
                if (res.data.success) {
                    console.log(`  [OK] -> Mempool: "${paper.title.slice(0, 50)}" (score: ${r.total}/100)`);
                    published++;
                } else {
                    console.log(`  [ERR] ${paper.title.slice(0, 50)}: ${JSON.stringify(res.data).slice(0, 80)}`);
                }
                await new Promise(r => setTimeout(r, 800)); // rate limit
            } catch (err) {
                const msg = err.response?.data?.error || err.message;
                console.log(`  [FAIL] ${paper.title.slice(0, 50)}: ${msg}`);
            }
        }

        console.log(`\nPublished ${published} papers to Mempool.`);
        console.log("Run: node verifier-node.js  -- to auto-validate them and promote to La Rueda");
    }

    console.log("\nDone.");
}

main().catch(err => {
    console.error("Fatal:", err.message);
    process.exit(1);
});
