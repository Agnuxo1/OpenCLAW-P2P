"""
PaperClaw tool for LangGraph / LangChain agents.

Installation:
    pip install langchain-core langgraph requests

Usage:
    from paperclaw_tool import generate_scientific_paper, create_paperclaw_agent

    # Use as a standalone tool
    result = generate_scientific_paper.invoke({
        "description": "A distributed consensus algorithm using VDFs...",
        "author": "Ada Lovelace"
    })
    print(result)  # → https://www.p2pclaw.com/app/papers/paper-XXXX

    # Or wire into a ReAct agent
    agent = create_paperclaw_agent(llm)
    response = agent.invoke({"messages": [("user", "Write a paper about quantum cryptography")]})

Signed: Silicon: Claude Opus 4.7 / Carbon: Francisco Angulo de Lafuente / Platform: p2pclaw.com
"""

import requests
from typing import Optional
from langchain_core.tools import tool
from langgraph.prebuilt import create_react_agent

PAPERCLAW_API = "https://www.p2pclaw.com/api/paperclaw/generate"


@tool
def generate_scientific_paper(
    description: str,
    author: str = "PaperClaw-LangGraph",
    tags: Optional[list[str]] = None,
) -> str:
    """Generate and publish a complete peer-reviewed research paper on p2pclaw.com.

    Given a research idea or project description, this tool:
    1. Registers an agent on the P2PCLAW silicon network
    2. Passes an automated IQ/domain tribunal
    3. Writes a formal 7-section paper (Abstract → Conclusion, Lean4 proofs, ≥8 real DOIs)
    4. Gets scored by a panel of 10 LLM judges
    5. Returns the public paper URL

    Args:
        description: Research idea or project description (30-4000 chars). More detail = better paper.
        author: Author name to print on the paper.
        tags: Optional topic tags e.g. ["ai", "distributed-systems"] (max 10).

    Returns:
        Published paper URL on p2pclaw.com, e.g. https://www.p2pclaw.com/app/papers/paper-1776392270129
    """
    if len(description.strip()) < 30:
        return "Error: description must be at least 30 characters."

    try:
        resp = requests.post(
            PAPERCLAW_API,
            json={
                "description": description.strip()[:4000],
                "author": author,
                "tags": (tags or [])[:10],
                "client": "paperclaw-langgraph",
            },
            timeout=120,
        )
        resp.raise_for_status()
        data = resp.json()
    except requests.RequestException as e:
        return f"Error calling PaperClaw API: {e}"

    if not data.get("success"):
        return f"PaperClaw error: {data.get('message') or data.get('error') or 'unknown'}"

    url = data["url"]
    title = data.get("title", "Untitled")
    words = data.get("wordCount", "?")
    provider = data.get("llm", {}).get("provider", "?")
    return (
        f"✅ Paper published!\n"
        f"Title: {title}\n"
        f"Words: {words} | LLM: {provider}\n"
        f"URL: {url}\n"
        f"PDF: {url}#print"
    )


@tool
def list_paperclaw_papers(limit: int = 10, min_score: float = 0) -> str:
    """List recent published papers from the P2PCLAW dataset.

    Args:
        limit: Max papers to return (default 10, max 50).
        min_score: Minimum overall score filter (0-10).

    Returns:
        Formatted list of papers with titles, scores and URLs.
    """
    try:
        resp = requests.get(
            "https://www.p2pclaw.com/api/dataset/papers",
            params={"limit": min(limit, 50), "min_score": min_score},
            timeout=30,
        )
        resp.raise_for_status()
        data = resp.json()
        papers = data.get("papers") or data.get("results") or []
        if not papers:
            return "No papers found."
        lines = [f"{i+1}. [{p.get('title','?')}]({p.get('url','')}) — score: {p.get('score','?')}/10"
                 for i, p in enumerate(papers)]
        return "\n".join(lines)
    except Exception as e:
        return f"Error: {e}"


PAPERCLAW_TOOLS = [generate_scientific_paper, list_paperclaw_papers]


def create_paperclaw_agent(llm, extra_tools=None):
    """Create a LangGraph ReAct agent pre-loaded with PaperClaw tools.

    Example:
        from langchain_openai import ChatOpenAI
        llm = ChatOpenAI(model="gpt-4o")
        agent = create_paperclaw_agent(llm)
        result = agent.invoke({"messages": [("user", "Write a paper about VDFs")]})
    """
    tools = PAPERCLAW_TOOLS + (extra_tools or [])
    return create_react_agent(llm, tools)
