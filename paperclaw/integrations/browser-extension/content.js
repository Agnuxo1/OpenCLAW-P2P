/**
 * PaperClaw Browser Extension -- Content Script
 * ================================================
 * Injected into AI chat interfaces (ChatGPT, Claude, Gemini, etc.)
 * Adds a floating "Generate Paper" button that captures the current
 * conversation context and triggers the PaperClaw pipeline.
 *
 * Supported sites:
 *   - chat.openai.com / chatgpt.com
 *   - claude.ai
 *   - gemini.google.com
 *   - poe.com
 *   - chat.mistral.ai
 *   - huggingface.co/chat
 *   - you.com
 *   - perplexity.ai
 */

(function () {
  "use strict";

  // Avoid double injection
  if (document.getElementById("paperclaw-fab")) return;

  // ---------------------------------------------------------------------------
  // Create floating action button
  // ---------------------------------------------------------------------------
  const fab = document.createElement("div");
  fab.id = "paperclaw-fab";
  fab.title = "PaperClaw: Generate Research Paper";
  fab.innerHTML = "&#128220;"; // scroll emoji
  Object.assign(fab.style, {
    position: "fixed",
    bottom: "20px",
    right: "20px",
    width: "48px",
    height: "48px",
    borderRadius: "50%",
    background: "linear-gradient(135deg, #4fc3f7, #0288d1)",
    color: "#fff",
    fontSize: "22px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    zIndex: "999999",
    boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
    transition: "transform 0.2s, box-shadow 0.2s",
    userSelect: "none",
  });

  fab.addEventListener("mouseenter", () => {
    fab.style.transform = "scale(1.1)";
    fab.style.boxShadow = "0 6px 16px rgba(0,0,0,0.4)";
  });
  fab.addEventListener("mouseleave", () => {
    fab.style.transform = "scale(1)";
    fab.style.boxShadow = "0 4px 12px rgba(0,0,0,0.3)";
  });

  document.body.appendChild(fab);

  // ---------------------------------------------------------------------------
  // Progress overlay
  // ---------------------------------------------------------------------------
  function createOverlay() {
    const overlay = document.createElement("div");
    overlay.id = "paperclaw-overlay";
    Object.assign(overlay.style, {
      position: "fixed",
      top: "0",
      left: "0",
      right: "0",
      bottom: "0",
      background: "rgba(15, 15, 35, 0.92)",
      zIndex: "1000000",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      color: "#e0e0e0",
    });

    overlay.innerHTML = `
      <div style="text-align:center; max-width:500px; padding:24px;">
        <h2 style="color:#4fc3f7; margin-bottom:8px;">PaperClaw Pipeline</h2>
        <p style="color:#78909c; font-size:13px; margin-bottom:20px;">Generating research paper...</p>
        <div id="paperclaw-progress" style="text-align:left; background:#1a1a2e; border-radius:8px; padding:16px; max-height:300px; overflow-y:auto; font-size:13px; line-height:1.6;"></div>
        <button id="paperclaw-close" style="margin-top:16px; padding:8px 24px; border:1px solid #4fc3f7; border-radius:6px; background:transparent; color:#4fc3f7; cursor:pointer; font-size:13px; display:none;">Close</button>
      </div>
    `;

    document.body.appendChild(overlay);
    return overlay;
  }

  function removeOverlay() {
    const el = document.getElementById("paperclaw-overlay");
    if (el) el.remove();
  }

  function appendProgress(text, color = "#66bb6a") {
    const prog = document.getElementById("paperclaw-progress");
    if (!prog) return;
    const div = document.createElement("div");
    div.textContent = text;
    div.style.color = color;
    prog.appendChild(div);
    prog.scrollTop = prog.scrollHeight;
  }

  // ---------------------------------------------------------------------------
  // Extract idea text from the page
  // ---------------------------------------------------------------------------
  function extractIdeaText() {
    // Try selected text first
    const sel = window.getSelection().toString().trim();
    if (sel.length > 10) return sel;

    // Try to get the last user message from known chat UIs
    const selectors = [
      // ChatGPT
      '[data-message-author-role="user"] .markdown',
      // Claude
      '.human-turn .contents',
      // Gemini
      '.query-text',
      // Generic
      '.user-message:last-of-type',
      '[class*="user"][class*="message"]:last-of-type',
    ];

    for (const s of selectors) {
      const els = document.querySelectorAll(s);
      if (els.length > 0) {
        const last = els[els.length - 1];
        const text = last.textContent.trim();
        if (text.length > 5) return text;
      }
    }

    return "";
  }

  // ---------------------------------------------------------------------------
  // FAB click handler
  // ---------------------------------------------------------------------------
  fab.addEventListener("click", async () => {
    const ideaText = extractIdeaText();

    if (!ideaText) {
      // Prompt user
      const topic = prompt(
        "PaperClaw: Enter a research topic to generate a paper about:"
      );
      if (!topic) return;
      startPipeline(topic);
    } else {
      const confirmed = confirm(
        `PaperClaw: Generate a research paper about:\n\n"${ideaText.slice(0, 200)}${ideaText.length > 200 ? "..." : ""}"\n\nProceed?`
      );
      if (confirmed) startPipeline(ideaText);
    }
  });

  function startPipeline(topic) {
    createOverlay();
    appendProgress("Starting PaperClaw pipeline...", "#ffb74d");

    chrome.runtime.sendMessage(
      {
        action: "generatePaper",
        topic: topic,
        agentName: "PaperClaw-Browser",
        apiBase: "https://www.p2pclaw.com/api",
      },
      (response) => {
        if (chrome.runtime.lastError) {
          appendProgress("Error: " + chrome.runtime.lastError.message, "#ef5350");
          showCloseButton();
          return;
        }

        if (response && response.steps) {
          response.steps.forEach((s) => {
            const color =
              s.cls === "err" ? "#ef5350" : s.cls === "info" ? "#ffb74d" : "#66bb6a";
            appendProgress(s.text, color);
          });
        }

        if (response && response.paperId) {
          appendProgress(
            `Paper published! View at: https://p2pclaw.com/paper/${response.paperId}`,
            "#4fc3f7"
          );
        }

        if (response && response.error) {
          appendProgress("Pipeline error: " + response.error, "#ef5350");
        }

        showCloseButton();
      }
    );
  }

  function showCloseButton() {
    const btn = document.getElementById("paperclaw-close");
    if (btn) {
      btn.style.display = "inline-block";
      btn.addEventListener("click", removeOverlay);
    }
  }

  // ---------------------------------------------------------------------------
  // Listen for messages from background/popup
  // ---------------------------------------------------------------------------
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.action === "getSelectedText") {
      sendResponse({ text: extractIdeaText() });
    }
    if (msg.action === "pipelineProgress") {
      const color =
        msg.cls === "err" ? "#ef5350" : msg.cls === "info" ? "#ffb74d" : "#66bb6a";
      appendProgress(msg.text, color);
    }
  });
})();
