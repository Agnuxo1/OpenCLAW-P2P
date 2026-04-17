"""
PaperClaw — Hugging Face Space
================================
Gradio app that lets anyone generate a peer-reviewed research paper
via P2PCLAW directly from Hugging Face Spaces.

Deploy:
    1. Create a new Space at https://huggingface.co/new-space
    2. Choose Gradio SDK
    3. Upload this file as app.py
    4. Done — no secrets required (P2PCLAW API is public)

Or use from any HF agent:
    from paperclaw import generate_paper
    result = generate_paper("Your research topic here")

Signed: Silicon: Claude Opus 4.7 / Carbon: Francisco Angulo de Lafuente / Platform: p2pclaw.com
"""

import requests
import gradio as gr

PAPERCLAW_API = "https://www.p2pclaw.com/api/paperclaw/generate"


def generate_paper(description: str, author: str, tags_str: str):
    """Generate a paper via P2PCLAW and return status + markdown result."""
    description = description.strip()
    author = author.strip() or "Anonymous Researcher"
    tags = [t.strip() for t in tags_str.split(",") if t.strip()][:10]

    if len(description) < 30:
        return "⚠️ Please enter at least 30 characters.", ""

    yield "⏳ Connecting to p2pclaw.com/silicon...", ""

    try:
        resp = requests.post(
            PAPERCLAW_API,
            json={
                "description": description[:4000],
                "author": author,
                "tags": tags,
                "client": "paperclaw-hf-space",
            },
            timeout=120,
        )
        data = resp.json()
    except Exception as e:
        yield f"❌ Error: {e}", ""
        return

    if not data.get("success"):
        yield f"❌ {data.get('message') or data.get('error') or 'Unknown error'}", ""
        return

    url = data["url"]
    title = data.get("title", "Untitled")
    words = data.get("wordCount", "?")
    provider = data.get("llm", {}).get("provider", "?")

    status = f"✅ Published! {words} words via {provider}"
    paper_md = (
        f"## [{title}]({url})\n\n"
        f"**Author:** {author}  \n"
        f"**Words:** {words}  \n"
        f"**LLM:** {provider}  \n\n"
        f"🔗 **[Read on P2PCLAW]({url})**  \n"
        f"📄 **[Save as PDF]({url}#print)**"
    )
    yield status, paper_md


# ---------------------------------------------------------------------------
# Gradio UI
# ---------------------------------------------------------------------------

with gr.Blocks(title="PaperClaw — P2PCLAW Paper Generator", theme=gr.themes.Soft()) as demo:
    gr.Markdown(
        "# 🦀 PaperClaw — Research Paper Generator\n"
        "Turn your project idea into a **peer-reviewed research paper** published on "
        "[p2pclaw.com](https://www.p2pclaw.com). Free, no API key needed."
    )

    with gr.Row():
        with gr.Column(scale=3):
            description = gr.Textbox(
                label="Research description",
                placeholder=(
                    "Describe your research idea in detail. Example:\n"
                    "'A distributed key-value store using consistent hashing and quorum "
                    "replication for high availability under network partitions, with "
                    "formal proofs of linearizability.'"
                ),
                lines=5,
            )
            author = gr.Textbox(label="Your name", placeholder="Ada Lovelace", value="")
            tags = gr.Textbox(
                label="Tags (optional, comma-separated)",
                placeholder="distributed-systems, databases, consistency",
            )
            btn = gr.Button("🚀 Generate & Publish Paper", variant="primary")

        with gr.Column(scale=2):
            status = gr.Textbox(label="Status", lines=2, interactive=False)
            result = gr.Markdown(label="Paper")

    btn.click(generate_paper, inputs=[description, author, tags], outputs=[status, result])

    gr.Markdown(
        "---\n"
        "Built with [PaperClaw](https://github.com/Agnuxo1/OpenCLAW-P2P) · "
        "[p2pclaw.com](https://www.p2pclaw.com) · MIT License"
    )

if __name__ == "__main__":
    demo.launch()
