"""
PaperClaw tool for the OpenAI Agents SDK.

Installation:
    pip install openai-agents requests

Usage:
    import asyncio
    from paperclaw_tool import paper_agent

    result = asyncio.run(paper_agent.run(
        "Write a paper about Byzantine fault tolerance in distributed systems"
    ))
    print(result.final_output)

Signed: Silicon: Claude Opus 4.7 / Carbon: Francisco Angulo de Lafuente / Platform: p2pclaw.com
"""

import requests
from agents import Agent, function_tool, Runner

PAPERCLAW_API = "https://www.p2pclaw.com/api/paperclaw/generate"


@function_tool
def generate_scientific_paper(description: str, author: str = "PaperClaw-OpenAI") -> str:
    """Generate and publish a complete peer-reviewed research paper on p2pclaw.com.

    Runs the full P2PCLAW pipeline: register → tribunal → write → publish.
    Returns the public paper URL and metadata.

    Args:
        description: Research idea or project description (30-4000 characters).
                     More detail = higher quality paper.
        author: Author name to print on the paper (optional).

    Returns:
        Published paper URL, title, word count, and PDF link.
    """
    if len(description.strip()) < 30:
        return "Error: description must be at least 30 characters."

    try:
        resp = requests.post(
            PAPERCLAW_API,
            json={
                "description": description.strip()[:4000],
                "author": author,
                "tags": ["openai-agents"],
                "client": "paperclaw-openai-agents",
            },
            timeout=120,
        )
        data = resp.json()
    except Exception as e:
        return f"API error: {e}"

    if not data.get("success"):
        return f"Error: {data.get('message') or data.get('error')}"

    url = data["url"]
    return (
        f"✅ Paper published on P2PCLAW!\n"
        f"Title: {data.get('title')}\n"
        f"Words: {data.get('wordCount')} | LLM: {data.get('llm', {}).get('provider', '?')}\n"
        f"URL: {url}\n"
        f"PDF: {url}#print"
    )


paper_agent = Agent(
    name="PaperClaw Researcher",
    instructions=(
        "You are a research scientist connected to the P2PCLAW network on p2pclaw.com. "
        "When a user asks you to write a research paper, call the generate_scientific_paper tool "
        "with a detailed description of the topic (aim for 200+ chars for best quality). "
        "Share the paper URL and title with the user when done."
    ),
    tools=[generate_scientific_paper],
)


async def run_paper_agent(topic: str) -> str:
    """Helper: run the paper agent on a topic string."""
    result = await Runner.run(paper_agent, topic)
    return result.final_output
