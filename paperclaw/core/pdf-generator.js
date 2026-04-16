/**
 * pdf-generator.js — Pure-text PDF/HTML generator for academic papers.
 *
 * Generates well-formatted HTML that can be rendered to PDF by any platform
 * (browser window.print(), Puppeteer, wkhtmltopdf, etc.). No external
 * dependencies — uses only Node.js built-in modules.
 */

'use strict';

const { writeFileSync } = require('fs');
const { join } = require('path');

// ---------------------------------------------------------------------------
// CSS — academic paper styling
// ---------------------------------------------------------------------------

const PAPER_CSS = `
@page {
  size: A4;
  margin: 2.5cm 2cm;
}
* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: 'Times New Roman', 'Noto Serif', Georgia, serif;
  font-size: 12pt;
  line-height: 1.6;
  color: #1a1a1a;
  max-width: 21cm;
  margin: 0 auto;
  padding: 2.5cm 2cm;
  background: #fff;
}
/* Title page */
.title-page {
  text-align: center;
  page-break-after: always;
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-height: 80vh;
}
.title-page h1 {
  font-size: 24pt;
  margin-bottom: 1em;
  line-height: 1.3;
}
.title-page .author {
  font-size: 14pt;
  margin-bottom: 0.5em;
}
.title-page .date {
  font-size: 12pt;
  color: #555;
  margin-bottom: 2em;
}
.score-badge {
  display: inline-block;
  background: linear-gradient(135deg, #0d6efd, #6610f2);
  color: #fff;
  font-size: 18pt;
  font-weight: bold;
  padding: 12px 32px;
  border-radius: 8px;
  margin-top: 1em;
}
.score-badge.low  { background: linear-gradient(135deg, #dc3545, #e85d04); }
.score-badge.mid  { background: linear-gradient(135deg, #fd7e14, #ffc107); color: #1a1a1a; }
.score-badge.high { background: linear-gradient(135deg, #198754, #20c997); }
/* Sections */
h2 {
  font-size: 16pt;
  margin-top: 1.5em;
  margin-bottom: 0.5em;
  border-bottom: 1px solid #ccc;
  padding-bottom: 4px;
}
h3 {
  font-size: 13pt;
  margin-top: 1em;
  margin-bottom: 0.3em;
}
p { margin-bottom: 0.8em; text-align: justify; }
/* Abstract */
.abstract {
  background: #f8f9fa;
  border-left: 4px solid #0d6efd;
  padding: 1em 1.2em;
  margin: 1em 0 2em;
  font-style: italic;
}
/* References */
.references ol {
  padding-left: 2em;
}
.references li {
  margin-bottom: 0.4em;
  font-size: 10pt;
}
/* Code blocks */
pre {
  background: #f4f4f4;
  border: 1px solid #ddd;
  border-radius: 4px;
  padding: 0.8em 1em;
  font-family: 'Courier New', monospace;
  font-size: 10pt;
  overflow-x: auto;
  margin: 0.8em 0;
  white-space: pre-wrap;
}
code {
  font-family: 'Courier New', monospace;
  font-size: 10pt;
  background: #f0f0f0;
  padding: 1px 4px;
  border-radius: 3px;
}
/* Score report page */
.score-page {
  page-break-before: always;
}
.score-page h2 { border-bottom-color: #0d6efd; }
.score-table {
  width: 100%;
  border-collapse: collapse;
  margin: 1em 0;
}
.score-table th, .score-table td {
  border: 1px solid #ccc;
  padding: 8px 12px;
  text-align: left;
}
.score-table th {
  background: #0d6efd;
  color: #fff;
}
.score-table tr:nth-child(even) { background: #f8f9fa; }
.footer {
  margin-top: 3em;
  padding-top: 1em;
  border-top: 1px solid #ccc;
  font-size: 9pt;
  color: #888;
  text-align: center;
}
`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Escape HTML entities. */
function esc(text) {
  if (typeof text !== 'string') return String(text ?? '');
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Convert simple Markdown to HTML (headings, bold, italic, code, lists). */
function markdownToHTML(md) {
  if (!md) return '';
  let html = esc(md);

  // Code blocks (``` ... ```)
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
    return `<pre><code>${code.trim()}</code></pre>`;
  });

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Headings
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h2>$1</h2>');

  // Bold and italic
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

  // Paragraphs — wrap lines that are not already tags
  html = html
    .split(/\n\n+/)
    .map((block) => {
      block = block.trim();
      if (!block) return '';
      if (/^<(h[1-6]|pre|ul|ol|div|table)/.test(block)) return block;
      return `<p>${block.replace(/\n/g, '<br/>')}</p>`;
    })
    .join('\n');

  return html;
}

/** Choose score-badge CSS class based on numeric score. */
function scoreBadgeClass(score) {
  if (typeof score !== 'number') return '';
  if (score >= 70) return 'high';
  if (score >= 40) return 'mid';
  return 'low';
}

// ---------------------------------------------------------------------------
// Main generator
// ---------------------------------------------------------------------------

/**
 * Generate a full academic-paper HTML document.
 *
 * @param {object} paper
 *   - title       {string}
 *   - author      {string}
 *   - date        {string}  (ISO or human-readable)
 *   - abstract    {string}
 *   - sections    {Array<{heading: string, body: string}>}
 *   - references  {Array<string>}
 * @param {object} [scores]
 *   - overall     {number}
 *   - dimensions  {Array<{name: string, score: number, comment: string}>}
 * @returns {string} Complete HTML document ready for rendering / printing to PDF.
 */
function generatePaperHTML(paper, scores) {
  const {
    title = 'Untitled Paper',
    author = 'Unknown Author',
    date = new Date().toISOString().slice(0, 10),
    abstract = '',
    sections = [],
    references = [],
  } = paper;

  const overall = scores?.overall ?? null;

  // -- Title page --
  let titlePage = `
<div class="title-page">
  <h1>${esc(title)}</h1>
  <div class="author">${esc(author)}</div>
  <div class="date">${esc(date)}</div>`;

  if (overall !== null) {
    titlePage += `
  <div class="score-badge ${scoreBadgeClass(overall)}">${overall}/100</div>`;
  }
  titlePage += `
  <div style="margin-top:2em;font-size:10pt;color:#888;">
    Published via <a href="https://www.p2pclaw.com">P2PCLAW Silicon</a>
  </div>
</div>`;

  // -- Abstract --
  let abstractHTML = '';
  if (abstract) {
    abstractHTML = `
<div class="abstract">
  <strong>Abstract.</strong> ${esc(abstract)}
</div>`;
  }

  // -- Body sections --
  const bodyHTML = sections
    .map((sec, i) => {
      const num = i + 1;
      const heading = sec.heading || `Section ${num}`;
      const body = markdownToHTML(sec.body || '');
      return `<h2>${num}. ${esc(heading)}</h2>\n${body}`;
    })
    .join('\n');

  // -- References --
  let refsHTML = '';
  if (references.length > 0) {
    const items = references.map((r) => `  <li>${esc(r)}</li>`).join('\n');
    refsHTML = `
<div class="references">
  <h2>References</h2>
  <ol>
${items}
  </ol>
</div>`;
  }

  // -- Score report page --
  let scorePage = '';
  if (scores && scores.dimensions) {
    const rows = scores.dimensions
      .map(
        (d) =>
          `    <tr><td>${esc(d.name)}</td><td>${d.score}</td><td>${esc(d.comment || '')}</td></tr>`
      )
      .join('\n');

    scorePage = `
<div class="score-page">
  <h2>P2PCLAW Quality Score Report</h2>
  <p>Overall score: <strong>${overall ?? 'N/A'}/100</strong></p>
  <table class="score-table">
    <thead><tr><th>Dimension</th><th>Score</th><th>Comment</th></tr></thead>
    <tbody>
${rows}
    </tbody>
  </table>
</div>`;
  }

  // -- Footer --
  const footer = `
<div class="footer">
  Generated by PaperClaw v1.0.0 &mdash; P2PCLAW Silicon &mdash; ${esc(date)}
</div>`;

  // -- Full document --
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc(title)}</title>
  <style>${PAPER_CSS}</style>
</head>
<body>
${titlePage}
${abstractHTML}
${bodyHTML}
${refsHTML}
${scorePage}
${footer}
</body>
</html>`;
}

/**
 * Write the HTML paper to disk.
 *
 * @param {string} html     The HTML string from generatePaperHTML().
 * @param {string} outPath  Absolute path for the output .html file.
 * @returns {string} The outPath written.
 */
function writeHTMLFile(html, outPath) {
  writeFileSync(outPath, html, 'utf-8');
  return outPath;
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  generatePaperHTML,
  writeHTMLFile,
  markdownToHTML,
};
