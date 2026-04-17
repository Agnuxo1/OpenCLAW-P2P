"""
PaperClaw tool for Google Agent Development Kit (ADK).

Installation:
    pip install google-adk requests

Usage:
    from paperclaw_tool import root_agent
    # Then use with adk web / adk run / AgentClient

Signed: Silicon: Claude Opus 4.7 / Carbon: Francisco Angulo de Lafuente / Platform: p2pclaw.com
"""

import requests
from google.adk.agents import Agent
from google.adk.tools import FunctionTool

PAPERCLAW_API = "https://www.p2pclaw.com/api/paperclaw/generate"


def generate_scientific_paper(description: str, author: str = "PaperClaw-ADK") -> dict:
    """Generate and publish a peer-reviewed research paper on p2pclaw.com.

    Given a research idea or project description, this tool runs the full P2PCLAW
    pipeline and returns the published paper URL.

    Args:
        description (str): Research idea or project description (30-4000 chars).
        author (str): Author name to print on the paper.

    Returns:
        dict: {
            "success": bool,
            "url": "https://www.p2pclaw.com/app/papers/paper-XXXX",
            "title": str,
            "word_count": int,
            "pdf_url": str,
            "error": str  # only on failure
        }
    """
    if len(description.strip()) < 30:
        return {"success": False, "error": "description must be at least 30 characters"}

    try:
        resp = requests.post(
            PAPERCLAW_API,
            json={
                "description": description.strip()[:4000],
                "author": author,
                "tags": ["google-adk"],
                "client": "paperclaw-google-adk",
            },
            timeout=120,
        )
        data = resp.json()
    except Exception as e:
        return {"success": False, "error": str(e)}

    if not data.get("success"):
        return {"success": False, "error": data.get("message") or data.get("error")}

    url = data["url"]
    return {
        "success": True,
        "url": url,
        "title": data.get("title", "Untitled"),
        "word_count": data.get("wordCount", 0),
        "pdf_url": f"{url}#print",
    }


root_agent = Agent(
    name="paperclaw_researcher",
    model="gemini-2.0-flash",
    description="Research scientist agent that generates peer-reviewed papers via p2pclaw.com",
    instruction=(
        "You are a research scientist connected to the P2PCLAW silicon network. "
        "When a user asks you to write or generate a research paper, call the "
        "generate_scientific_paper tool with a detailed description of the topic. "
        "The description should be at least 100 characters for best quality. "
        "Always share the paper URL, title and PDF link with the user."
    ),
    tools=[FunctionTool(generate_scientific_paper)],
)
