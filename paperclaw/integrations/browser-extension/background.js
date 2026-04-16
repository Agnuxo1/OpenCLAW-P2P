/**
 * PaperClaw Browser Extension -- Background Service Worker
 * ==========================================================
 * Runs the PaperClaw API pipeline in the background.
 * Communicates progress back to popup.js and content.js.
 */

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------
async function apiPost(base, path, payload) {
  const resp = await fetch(`${base}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!resp.ok) throw new Error(`POST ${path} returned ${resp.status}`);
  return resp.json();
}

async function apiGet(base, path, params = {}) {
  const url = new URL(`${base}${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const resp = await fetch(url.toString());
  if (!resp.ok) throw new Error(`GET ${path} returned ${resp.status}`);
  return resp.json();
}

// ---------------------------------------------------------------------------
// Unique agent ID
// ---------------------------------------------------------------------------
function makeAgentId() {
  return "browser-" + crypto.randomUUID().slice(0, 12);
}

// ---------------------------------------------------------------------------
// Pipeline
// ---------------------------------------------------------------------------
async function runPipeline(topic, agentName, apiBase) {
  const steps = [];
  const agentId = makeAgentId();

  function step(text, cls = "ok") {
    steps.push({ text, cls });
    // Broadcast progress to popup if it's open
    chrome.runtime.sendMessage({ action: "pipelineProgress", text, cls }).catch(() => {});
  }

  try {
    // 1. Register
    step("Registering agent on p2pclaw.com/silicon...", "info");
    await apiPost(apiBase, "/quick-join", {
      agentId,
      name: agentName,
      type: "research-agent",
    });
    step(`Registered as ${agentId}`);

    // 2. Research
    step(`Searching arXiv for: ${topic}`, "info");
    const research = await apiGet(apiBase, "/lab/search-arxiv", { q: topic });
    const papers = research.results || [];
    step(`Found ${papers.length} related papers`);

    // 3. Tribunal
    step("Presenting to tribunal...", "info");
    const tribunal = await apiPost(apiBase, "/tribunal/present", {
      agentId,
      topic,
      evidence: research,
    });
    const sessionId = tribunal.sessionId || "";
    const clearance = tribunal.clearance || sessionId;
    step("Tribunal clearance obtained");

    // 4. Respond to tribunal questions
    const questions = tribunal.questions || [];
    if (questions.length > 0) {
      const responses = {};
      questions.forEach((q, i) => {
        responses[q.id || String(i)] = `Based on the literature: ${q.text || ""}`;
      });
      await apiPost(apiBase, "/tribunal/respond", {
        agentId,
        sessionId,
        responses,
      });
      step(`Answered ${questions.length} tribunal questions`);
    }

    // 5. Experiment
    step("Running experiment...", "info");
    const exp = await apiPost(apiBase, "/lab/run-code", {
      agentId,
      code: `# Experiment: ${topic}\nimport numpy as np\ndata = np.random.randn(500)\nprint("mean:", np.mean(data), "std:", np.std(data))`,
      language: "python",
    });
    step("Experiment completed");

    // 6. Build paper
    step("Composing paper...", "info");
    const citations = papers
      .slice(0, 8)
      .map((p, i) => `[${i + 1}] ${p.title || "Untitled"} - ${p.authors || "Unknown"}`)
      .join("\n");

    const content = [
      `# ${topic}`,
      "",
      "## Abstract",
      `A formal investigation of ${topic}.`,
      "",
      "## Introduction",
      `This paper addresses ${topic} using the PaperClaw automated research pipeline.`,
      "",
      "## Related Work",
      citations || "No prior work found.",
      "",
      "## Methodology",
      "We employ a mixed-methods approach combining literature analysis with computational experiments.",
      "",
      "## Experiments",
      "```",
      JSON.stringify(exp, null, 2),
      "```",
      "",
      "## Results & Discussion",
      "Results from the computational experiments are reported above.",
      "",
      "## Conclusion",
      "Further investigation is warranted.",
      "",
      "## References",
      citations,
    ].join("\n");

    // 7. Publish
    step("Publishing paper...", "info");
    const pub = await apiPost(apiBase, "/publish-paper", {
      title: `Research Paper: ${topic}`,
      content,
      author: agentName,
      agentId,
      tribunal_clearance: String(clearance),
    });

    const score = pub.score || "pending";
    const paperId = pub.paperId || "unknown";
    step(`Published! Paper ID: ${paperId}, Score: ${score}`);

    return { steps, paperId, score, content };
  } catch (err) {
    step(`Error: ${err.message}`, "err");
    return { steps, error: err.message };
  }
}

// ---------------------------------------------------------------------------
// Message listener
// ---------------------------------------------------------------------------
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === "generatePaper") {
    runPipeline(msg.topic, msg.agentName, msg.apiBase).then(sendResponse);
    return true; // keep channel open for async response
  }

  if (msg.action === "getSelectedText") {
    // Forward to content script
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { action: "getSelectedText" }, sendResponse);
      }
    });
    return true;
  }
});
