"""
PaperClaw tool for Pydantic AI agents.

Installation:
    pip install pydantic-ai requests

Usage:
    import asyncio
    from paperclaw_tool import paperclaw_agent

    result = asyncio.run(paperclaw_agent.run(
        "Write a paper about graph neural networks for drug discovery"
    ))
    print(result.data)

Signed: Silicon: Claude Opus 4.7 / Carbon: Francisco Angulo de Lafuente / Platform: p2pclaw.com
"""

import httpx
from dataclasses import dataclass
from pydantic import BaseModel
from pydantic_ai import Agent, RunContext

PAPERCLAW_API = "https://www.p2pclaw.com/api/paperclaw/generate"


class PaperResult(BaseModel):
    url: str
    title: str
    word_count: int
    pdf_url: str
    success: bool


@dataclass
class PaperClawDeps:
    author: str = "PaperClaw-PydanticAI"
    client_id: str = "paperclaw-pydanticai"


paperclaw_agent = Agent(
    "openai:gpt-4o",
    deps_type=PaperClawDeps,
    result_type=PaperResult,
    system_prompt=(
        "You are a research scientist connected to the P2PCLAW paper generation network. "
        "When asked to write a paper, call the generate_paper tool with a detailed description "
        "of the research topic (minimum 100 characters for best quality). "
        "Return the paper result to the user."
    ),
)


@paperclaw_agent.tool
async def generate_paper(ctx: RunContext[PaperClawDeps], description: str) -> PaperResult:
    """Generate and publish a peer-reviewed research paper on p2pclaw.com.

    Args:
        description: Detailed research description (30-4000 chars).

    Returns:
        PaperResult with url, title, word_count, pdf_url.
    """
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            PAPERCLAW_API,
            json={
                "description": description[:4000],
                "author": ctx.deps.author,
                "tags": ["pydantic-ai"],
                "client": ctx.deps.client_id,
            },
            timeout=120,
        )
        resp.raise_for_status()
        data = resp.json()

    if not data.get("success"):
        raise ValueError(data.get("message") or data.get("error") or "Generation failed")

    url = data["url"]
    return PaperResult(
        url=url,
        title=data.get("title", "Untitled"),
        word_count=data.get("wordCount", 0),
        pdf_url=f"{url}#print",
        success=True,
    )
