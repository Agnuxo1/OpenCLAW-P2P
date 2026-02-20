/**
 * Extraction of a section from markdown content.
 */
export function extractSection(content, sectionName) {
    const escaped = sectionName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(`${escaped}\\s*([\\s\\S]*?)(?=\\n## |$)`);
    const match = content.match(pattern);
    return match ? match[1].trim() : "";
}

/**
 * Structural and semantic validation of a paper.
 * Returns { valid, score, details }
 *
 * Scoring (100 points total):
 *   A. Structure   — 40 pts: all 7 required sections present
 *   B. Length      — 20 pts: >= 1500 words (~2000 tokens)
 *   C. References  — 20 pts: >= 3 [N] citations
 *   D. Coherence   — 20 pts: keyword overlap between abstract and conclusion
 */
export function validatePaper(paper) {
    const content = paper.content || "";

    // A. Section structure (40 pts)
    const REQUIRED_SECTIONS = [
        "## Abstract", "## Introduction", "## Methodology",
        "## Results", "## Discussion", "## Conclusion", "## References"
    ];
    const foundSections = REQUIRED_SECTIONS.filter(s => content.includes(s));
    const sectionScore = (foundSections.length / 7) * 40;

    // B. Word count (20 pts) — target: 1500 words minimum (~2000 tokens)
    const words = content.split(/\s+/).filter(w => w.length > 0).length;
    const wordScore = Math.min((words / 1500) * 20, 20);

    // C. References (20 pts)
    const refs = (content.match(/\[\d+\]/g) || []).length;
    const refScore = Math.min((refs / 3) * 20, 20);

    // D. Semantic coherence: abstract keywords present in conclusion (20 pts)
    const abstract = extractSection(content, "## Abstract");
    const conclusion = extractSection(content, "## Conclusion");
    const rawKeywords = abstract.toLowerCase().match(/\b\w{5,}\b/g) || [];
    const unique = [...new Set(rawKeywords)].slice(0, 20);
    // Filter stop words
    const stopWords = new Set(["which", "their", "there", "these", "those", "where",
        "about", "after", "before", "during", "through", "between", "under",
        "above", "below", "while", "being", "using", "based", "with", "from"]);
    const keywords = unique.filter(kw => !stopWords.has(kw));
    const overlap = keywords.filter(kw => conclusion.toLowerCase().includes(kw)).length;
    const coherenceScore = keywords.length > 0
        ? (overlap / keywords.length) * 20
        : 10; // neutral if abstract is too short

    const total = sectionScore + wordScore + refScore + coherenceScore;
    const score = parseFloat((total / 100).toFixed(3));

    return {
        valid: total >= 60,
        score,
        details: {
            sections: `${foundSections.length}/7`,
            words,
            refs,
            coherence: keywords.length > 0
                ? `${overlap}/${keywords.length} keywords`
                : "N/A",
            breakdown: {
                structure: parseFloat(sectionScore.toFixed(1)),
                length: parseFloat(wordScore.toFixed(1)),
                references: parseFloat(refScore.toFixed(1)),
                coherence: parseFloat(coherenceScore.toFixed(1))
            }
        }
    };
}
