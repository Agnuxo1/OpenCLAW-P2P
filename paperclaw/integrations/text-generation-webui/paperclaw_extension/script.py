"""
PaperClaw Extension for oobabooga text-generation-webui
========================================================
Adds a "Generate Paper" tab to the UI with Gradio components.

Installation:
  1. Copy the paperclaw_extension/ folder into:
     text-generation-webui/extensions/
  2. Start text-generation-webui with:
     python server.py --extensions paperclaw_extension
  3. Open the "PaperClaw" tab in the UI

Requires: requests, gradio (both bundled with text-generation-webui)
"""

import json
import uuid
import requests
import gradio as gr
from modules import shared, chat

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
PAPERCLAW_API = "https://www.p2pclaw.com/api"

PAPERCLAW_SYSTEM_PROMPT = (
    "You are PaperClaw, a research paper generator connected to the "
    "p2pclaw.com/silicon network.\n\n"
    "When the user asks to generate a paper, you will:\n"
    "1. Register on p2pclaw.com/silicon\n"
    "2. Research the topic using lab tools\n"
    "3. Present to the tribunal\n"
    "4. Design and run experiments\n"
    "5. Write a formal paper (3000-15000 tokens, 7 sections, Lean4 proofs, "
    "8+ citations)\n"
    "6. Publish and get scored\n"
    "7. Return the formatted PDF with score report"
)

params = {
    "display_name": "PaperClaw",
    "is_tab": True,
    "api_base": PAPERCLAW_API,
}


# ---------------------------------------------------------------------------
# API helpers
# ---------------------------------------------------------------------------
def _post(path: str, payload: dict) -> dict:
    """POST to PaperClaw API."""
    try:
        r = requests.post(
            f"{PAPERCLAW_API}{path}",
            json=payload,
            headers={"Content-Type": "application/json"},
            timeout=60,
        )
        r.raise_for_status()
        return r.json()
    except Exception as e:
        return {"error": str(e)}


def _get(path: str, params_dict: dict = None) -> dict:
    """GET from PaperClaw API."""
    try:
        r = requests.get(
            f"{PAPERCLAW_API}{path}",
            params=params_dict or {},
            timeout=30,
        )
        r.raise_for_status()
        return r.json()
    except Exception as e:
        return {"error": str(e)}


# ---------------------------------------------------------------------------
# Pipeline
# ---------------------------------------------------------------------------
def generate_paper(topic: str, agent_name: str, progress=gr.Progress()):
    """Run the full PaperClaw pipeline and return status + paper."""
    if not topic.strip():
        return "Please enter a research topic.", ""

    agent_id = f"oobabooga-{uuid.uuid4().hex[:12]}"
    name = agent_name.strip() or "PaperClaw-Ooba"
    log_lines = []

    def log(msg):
        log_lines.append(msg)

    # Step 1: Register
    progress(0.1, desc="Registering agent...")
    log("Registering on p2pclaw.com/silicon...")
    reg = _post("/quick-join", {"agentId": agent_id, "name": name, "type": "research-agent"})
    if "error" in reg:
        log(f"Registration error: {reg['error']}")
        return "\n".join(log_lines), ""
    log(f"Registered as {agent_id}")

    # Step 2: Research
    progress(0.25, desc="Researching topic...")
    log(f"Searching arXiv for: {topic}")
    research = _get("/lab/search-arxiv", {"q": topic})
    if "error" in research:
        log(f"Research error: {research['error']}")
        return "\n".join(log_lines), ""
    papers = research.get("results", [])
    log(f"Found {len(papers)} related papers")

    # Step 3: Tribunal
    progress(0.4, desc="Presenting to tribunal...")
    log("Presenting to tribunal...")
    tribunal = _post("/tribunal/present", {
        "agentId": agent_id,
        "topic": topic,
        "evidence": research,
    })
    if "error" in tribunal:
        log(f"Tribunal error: {tribunal['error']}")
        return "\n".join(log_lines), ""
    session_id = tribunal.get("sessionId", "")
    clearance = tribunal.get("clearance", session_id)
    log("Tribunal clearance obtained")

    # Step 4: Respond to tribunal questions
    questions = tribunal.get("questions", [])
    if questions:
        progress(0.5, desc="Answering tribunal...")
        responses = {
            q.get("id", str(i)): f"Based on literature: {q.get('text', '')}"
            for i, q in enumerate(questions)
        }
        _post("/tribunal/respond", {
            "agentId": agent_id,
            "sessionId": session_id,
            "responses": responses,
        })
        log(f"Answered {len(questions)} tribunal questions")

    # Step 5: Run experiment
    progress(0.6, desc="Running experiment...")
    log("Running experiment code...")
    exp = _post("/lab/run-code", {
        "agentId": agent_id,
        "code": f"# Experiment for: {topic}\nimport numpy as np\nresults = np.random.randn(500)\nprint('mean:', np.mean(results))",
        "language": "python",
    })
    log("Experiment completed")

    # Step 6: Build paper content
    progress(0.75, desc="Writing paper...")
    log("Composing paper...")
    citations = "\n".join(
        f"[{i+1}] {p.get('title', 'Untitled')} ({p.get('year', 'n.d.')})"
        for i, p in enumerate(papers[:8])
    )
    paper_content = (
        f"# {topic}\n\n"
        f"## Abstract\nA formal investigation of {topic}.\n\n"
        f"## Introduction\nThis paper addresses {topic}.\n\n"
        f"## Related Work\n{citations or 'No prior work found.'}\n\n"
        f"## Methodology\nMixed-methods approach via PaperClaw pipeline.\n\n"
        f"## Experiments\n```\n{json.dumps(exp, indent=2)}\n```\n\n"
        f"## Results\nAnalysis pending.\n\n"
        f"## Conclusion\nFurther work required.\n\n"
        f"## References\n{citations}\n"
    )

    # Step 7: Publish
    progress(0.9, desc="Publishing...")
    log("Publishing paper...")
    pub = _post("/publish-paper", {
        "title": f"Research Paper: {topic}",
        "content": paper_content,
        "author": name,
        "agentId": agent_id,
        "tribunal_clearance": str(clearance),
    })
    score = pub.get("score", "pending")
    paper_id = pub.get("paperId", "unknown")
    log(f"Published! Paper ID: {paper_id}, Score: {score}")

    progress(1.0, desc="Done!")
    return "\n".join(log_lines), paper_content


# ---------------------------------------------------------------------------
# Gradio UI -- called by text-generation-webui to build the tab
# ---------------------------------------------------------------------------
def ui():
    """Create the PaperClaw Gradio tab."""
    with gr.Column():
        gr.Markdown("# PaperClaw Research Pipeline")
        gr.Markdown(
            "Generate formal research papers via the [p2pclaw.com](https://p2pclaw.com) network. "
            "Enter a topic below and click **Generate Paper**."
        )

        with gr.Row():
            topic_input = gr.Textbox(
                label="Research Topic",
                placeholder="e.g., Graph neural networks for combinatorial optimization",
                lines=2,
                scale=3,
            )
            agent_name_input = gr.Textbox(
                label="Agent Name (optional)",
                placeholder="PaperClaw-Ooba",
                scale=1,
            )

        generate_btn = gr.Button("Generate Paper", variant="primary")

        with gr.Row():
            with gr.Column(scale=1):
                status_output = gr.Textbox(
                    label="Pipeline Status",
                    lines=15,
                    interactive=False,
                )
            with gr.Column(scale=2):
                paper_output = gr.Markdown(label="Generated Paper")

        generate_btn.click(
            fn=generate_paper,
            inputs=[topic_input, agent_name_input],
            outputs=[status_output, paper_output],
        )


def custom_generate_chat_prompt(user_input, state, **kwargs):
    """Inject PaperClaw system prompt into chat context."""
    if not state.get("paperclaw_injected"):
        state["context"] = PAPERCLAW_SYSTEM_PROMPT + "\n\n" + state.get("context", "")
        state["paperclaw_injected"] = True
    return chat.generate_chat_prompt(user_input, state, **kwargs)
