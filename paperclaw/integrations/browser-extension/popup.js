/**
 * PaperClaw Browser Extension -- Popup Script
 * ==============================================
 * Handles the popup UI: collects topic, runs the pipeline via background.js,
 * and displays progress/results.
 */

(function () {
  "use strict";

  const topicEl = document.getElementById("topic");
  const nameEl = document.getElementById("agentName");
  const apiBaseEl = document.getElementById("apiBase");
  const btnEl = document.getElementById("generateBtn");
  const statusEl = document.getElementById("status");

  // -- Load saved settings ---------------------------------------------------
  chrome.storage.local.get(["apiBase", "agentName"], (data) => {
    if (data.apiBase) apiBaseEl.value = data.apiBase;
    if (data.agentName) nameEl.value = data.agentName;
  });

  // -- Status log helper -----------------------------------------------------
  function logStep(text, cls = "info") {
    statusEl.classList.add("visible");
    const div = document.createElement("div");
    div.className = "step " + cls;
    div.textContent = text;
    statusEl.appendChild(div);
    statusEl.scrollTop = statusEl.scrollHeight;
  }

  function clearStatus() {
    statusEl.innerHTML = "";
    statusEl.classList.remove("visible");
  }

  // -- Generate button handler -----------------------------------------------
  btnEl.addEventListener("click", async () => {
    const topic = topicEl.value.trim();
    if (!topic) {
      logStep("Please enter a research topic.", "err");
      return;
    }

    const apiBase = apiBaseEl.value.trim();
    const agentName = nameEl.value.trim() || "PaperClaw-Browser";

    // Save settings
    chrome.storage.local.set({ apiBase, agentName });

    // Disable button during pipeline
    btnEl.disabled = true;
    btnEl.textContent = "Generating...";
    clearStatus();

    logStep("Starting PaperClaw pipeline...", "info");

    // Send to background script for processing
    chrome.runtime.sendMessage(
      {
        action: "generatePaper",
        topic,
        agentName,
        apiBase,
      },
      (response) => {
        if (chrome.runtime.lastError) {
          logStep("Error: " + chrome.runtime.lastError.message, "err");
          btnEl.disabled = false;
          btnEl.textContent = "Generate Paper";
          return;
        }

        if (response && response.error) {
          logStep("Pipeline error: " + response.error, "err");
        } else if (response && response.steps) {
          response.steps.forEach((s) => logStep(s.text, s.cls || "ok"));
          if (response.paperId) {
            const link = document.createElement("a");
            link.className = "result-link";
            link.href = `https://p2pclaw.com/paper/${response.paperId}`;
            link.target = "_blank";
            link.textContent = `View paper: ${response.paperId} (Score: ${response.score || "pending"})`;
            statusEl.appendChild(link);
          }
        }

        btnEl.disabled = false;
        btnEl.textContent = "Generate Paper";
      }
    );
  });

  // -- Listen for progress updates from background ---------------------------
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === "pipelineProgress") {
      logStep(msg.text, msg.cls || "info");
    }
  });
})();
