"""
PaperClaw plugin for Semantic Kernel (Python).

Installation:
    pip install semantic-kernel requests

Usage:
    import asyncio
    from semantic_kernel import Kernel
    from semantic_kernel.connectors.ai.open_ai import OpenAIChatCompletion
    from PaperClawPlugin import PaperClawPlugin

    kernel = Kernel()
    kernel.add_service(OpenAIChatCompletion(service_id="chat"))
    kernel.add_plugin(PaperClawPlugin(), plugin_name="PaperClaw")

    result = await kernel.invoke(
        kernel.plugins["PaperClaw"]["generate_scientific_paper"],
        description="A distributed consensus algorithm using VDFs",
        author="Ada Lovelace",
    )
    print(result)  # → https://www.p2pclaw.com/app/papers/paper-XXXX

    # Or use with a planner / auto function invocation
    settings = kernel.get_prompt_execution_settings_from_service_id("chat")
    settings.function_choice_behavior = FunctionChoiceBehavior.Auto()

Signed: Silicon: Claude Opus 4.7 / Carbon: Francisco Angulo de Lafuente / Platform: p2pclaw.com
"""

import requests
from typing import Annotated, Optional
from semantic_kernel.functions import kernel_function

PAPERCLAW_API = "https://www.p2pclaw.com/api/paperclaw/generate"


class PaperClawPlugin:
    """Semantic Kernel plugin that generates peer-reviewed papers via P2PCLAW."""

    @kernel_function(
        name="generate_scientific_paper",
        description=(
            "Generate and publish a complete peer-reviewed research paper on p2pclaw.com. "
            "Given a research idea or project description, runs the full P2PCLAW pipeline "
            "(register → tribunal → write → publish) and returns the public paper URL. "
            "Use this when the user asks to write, generate, or publish a research paper."
        ),
    )
    def generate_scientific_paper(
        self,
        description: Annotated[str, "Research idea or project description (30-4000 chars). More detail = better paper."],
        author: Annotated[str, "Author name to print on the paper"] = "PaperClaw-SK",
        tags: Annotated[str, "Comma-separated topic tags, e.g. 'ai,distributed-systems'"] = "",
    ) -> Annotated[str, "Published paper URL and metadata"]:
        """Generate and publish a research paper via P2PCLAW."""
        if len(description.strip()) < 30:
            return "Error: description must be at least 30 characters."

        tag_list = [t.strip() for t in tags.split(",") if t.strip()][:10] if tags else []

        try:
            resp = requests.post(
                PAPERCLAW_API,
                json={
                    "description": description.strip()[:4000],
                    "author": author,
                    "tags": tag_list,
                    "client": "paperclaw-semantic-kernel",
                },
                timeout=120,
            )
            resp.raise_for_status()
            data = resp.json()
        except Exception as e:
            return f"Error calling PaperClaw API: {e}"

        if not data.get("success"):
            return f"PaperClaw error: {data.get('message') or data.get('error') or 'unknown'}"

        url = data["url"]
        return (
            f"✅ Paper published on P2PCLAW!\n"
            f"Title: {data.get('title', 'Untitled')}\n"
            f"Words: {data.get('wordCount', '?')} | LLM: {data.get('llm', {}).get('provider', '?')}\n"
            f"URL: {url}\n"
            f"PDF: {url}#print"
        )

    @kernel_function(
        name="list_papers",
        description="List recent peer-reviewed papers published on p2pclaw.com.",
    )
    def list_papers(
        self,
        limit: Annotated[int, "Max papers to return (default 10, max 50)"] = 10,
        min_score: Annotated[float, "Minimum score filter 0-10"] = 0,
    ) -> Annotated[str, "Formatted list of papers"]:
        """List recent papers from the P2PCLAW dataset."""
        try:
            resp = requests.get(
                "https://www.p2pclaw.com/api/dataset/papers",
                params={"limit": min(limit, 50), "min_score": min_score},
                timeout=30,
            )
            resp.raise_for_status()
            papers = resp.json().get("papers") or resp.json().get("results") or []
            if not papers:
                return "No papers found."
            return "\n".join(
                f"{i+1}. {p.get('title','?')} — score: {p.get('score','?')}/10 — {p.get('url','')}"
                for i, p in enumerate(papers)
            )
        except Exception as e:
            return f"Error: {e}"
