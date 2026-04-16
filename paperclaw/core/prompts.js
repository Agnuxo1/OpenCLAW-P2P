/**
 * prompts.js — Prompt templates for PaperClaw AI agents.
 *
 * These templates are injected into the agent's context at each stage of
 * the paper-generation pipeline. They guide the LLM through research,
 * tribunal defence, paper writing, and lab experimentation.
 *
 * Zero external dependencies.
 */

'use strict';

// ---------------------------------------------------------------------------
// System prompt — injected once at session start
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are a PaperClaw Research Agent operating through the P2PCLAW Silicon platform.

Your mission is to take a user's research idea and transform it into a
peer-reviewed, published paper with a quantitative quality score.

You follow the PaperClaw pipeline:
1. Register as an agent on the P2PCLAW network.
2. Conduct literature research (arXiv + P2PCLAW dataset).
3. Present your project to the P2PCLAW Tribunal and defend it.
4. Create a structured project plan (7 sections).
5. Use the P2PCLAW Lab to run experiments and validate citations.
6. Dry-run your paper for a preliminary score.
7. Publish the final paper.
8. Retrieve the official score and generate a formatted PDF.

Rules:
- Always cite sources with full bibliographic references.
- Never fabricate experimental results — use the Lab to run real code.
- Answer tribunal questions honestly and thoroughly.
- Target a score above 70/100 on every quality dimension.
- Write in clear, precise academic English.`;

// ---------------------------------------------------------------------------
// Research prompt — literature search phase
// ---------------------------------------------------------------------------

function RESEARCH_PROMPT(topic) {
  return `Conduct a comprehensive literature review on the following topic:

TOPIC: ${topic}

Steps:
1. Search arXiv for the 10 most relevant recent papers (last 3 years).
2. Search the P2PCLAW dataset for related published work.
3. Identify the key open problems, methods, and datasets in this area.
4. Summarise each source in 2-3 sentences: authors, contribution, relevance.
5. Identify gaps that the proposed research could fill.

Output format:
{
  "topic": "${topic}",
  "sources": [
    { "title": "...", "authors": "...", "year": ..., "url": "...", "summary": "...", "relevance": "high|medium|low" }
  ],
  "openProblems": ["..."],
  "proposedGap": "..."
}`;
}

// ---------------------------------------------------------------------------
// Tribunal prompt — answering the 8 tribunal questions
// ---------------------------------------------------------------------------

function TRIBUNAL_PROMPT(questions) {
  const numbered = questions
    .map((q, i) => `  Q${i + 1}: ${q}`)
    .join('\n');

  return `The P2PCLAW Tribunal has asked you ${questions.length} questions about your project.
Answer each question thoroughly (3-5 sentences minimum). Be specific,
cite your sources, and acknowledge limitations honestly.

Questions:
${numbered}

Output format — a JSON array of answers in the same order:
[
  "Answer to Q1 ...",
  "Answer to Q2 ...",
  ...
]`;
}

// ---------------------------------------------------------------------------
// Paper structure prompt — generates the full paper
// ---------------------------------------------------------------------------

function PAPER_STRUCTURE_PROMPT(topic, sources) {
  const sourceList = sources
    .map((s, i) => `  [${i + 1}] ${s.title} (${s.authors}, ${s.year})`)
    .join('\n');

  return `Write a complete academic paper on the following topic using the sources below.

TOPIC: ${topic}

SOURCES:
${sourceList}

The paper MUST contain exactly these 7 sections:
1. Abstract (150-250 words)
2. Introduction (motivation, context, contribution statement)
3. Related Work (compare and contrast with sources)
4. Methodology (detailed, reproducible description)
5. Experiments & Results (tables, figures described in text)
6. Discussion (implications, limitations, future work)
7. References (all sources cited in the text)

Formatting rules:
- Use Markdown headings (## Section).
- Number all equations.
- Every claim must have a citation [n].
- Include at least one algorithm or pseudocode block.

Output the complete paper as a single Markdown string.`;
}

// ---------------------------------------------------------------------------
// Lab prompt — designing and running experiments
// ---------------------------------------------------------------------------

function LAB_PROMPT(hypothesis) {
  return `Design and execute an experiment to test the following hypothesis:

HYPOTHESIS: ${hypothesis}

Steps:
1. State the null and alternative hypotheses formally.
2. Describe the experimental setup (data, parameters, metrics).
3. Write executable Python code that runs the experiment.
4. Analyse the results and state whether the hypothesis is supported.

Output format:
{
  "hypothesis": "${hypothesis}",
  "setup": "...",
  "code": "# Python code here ...",
  "language": "python",
  "expectedOutcome": "...",
  "analysis": "..."
}`;
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  SYSTEM_PROMPT,
  RESEARCH_PROMPT,
  TRIBUNAL_PROMPT,
  PAPER_STRUCTURE_PROMPT,
  LAB_PROMPT,
};
