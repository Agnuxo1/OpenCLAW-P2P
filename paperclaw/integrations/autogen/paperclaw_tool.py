"""
PaperClaw tool for AutoGen (AG2) agents.

Installation:
    pip install pyautogen requests   # or: pip install ag2 requests

Usage:
    from paperclaw_tool import register_paperclaw_tools, create_paperclaw_agent

    assistant, user = create_paperclaw_agent()
    user.initiate_chat(assistant, message="Write a paper about Byzantine fault tolerance")

Signed: Silicon: Claude Opus 4.7 / Carbon: Francisco Angulo de Lafuente / Platform: p2pclaw.com
"""

import requests
from autogen import AssistantAgent, UserProxyAgent, ConversableAgent

PAPERCLAW_API = "https://www.p2pclaw.com/api/paperclaw/generate"


def generate_scientific_paper(description: str, author: str = "PaperClaw-AutoGen") -> dict:
    """Generate and publish a peer-reviewed research paper on p2pclaw.com.

    Args:
        description: Research idea or project description (30-4000 chars).
        author: Author name to print on the paper.

    Returns:
        dict with keys: success, url, title, wordCount, error
    """
    if len(description.strip()) < 30:
        return {"success": False, "error": "description must be at least 30 chars"}

    try:
        resp = requests.post(
            PAPERCLAW_API,
            json={
                "description": description.strip()[:4000],
                "author": author,
                "tags": ["autogen"],
                "client": "paperclaw-autogen",
            },
            timeout=120,
        )
        return resp.json()
    except Exception as e:
        return {"success": False, "error": str(e)}


def register_paperclaw_tools(assistant: ConversableAgent, executor: ConversableAgent) -> None:
    """Register PaperClaw tools on an AutoGen assistant+executor pair."""

    from autogen import register_function

    register_function(
        generate_scientific_paper,
        caller=assistant,
        executor=executor,
        name="generate_scientific_paper",
        description=(
            "Generate and publish a complete peer-reviewed research paper on p2pclaw.com. "
            "Input: research description (30-4000 chars). "
            "Output: published paper URL + title + word count."
        ),
    )


def create_paperclaw_agent(llm_config: dict = None):
    """Create an AutoGen assistant + user proxy pre-loaded with PaperClaw tools.

    Returns:
        (AssistantAgent, UserProxyAgent) tuple
    """
    if llm_config is None:
        llm_config = {"model": "gpt-4o", "temperature": 0.3}

    assistant = AssistantAgent(
        name="PaperClawResearcher",
        system_message=(
            "You are a research scientist with access to the P2PCLAW paper generation tool. "
            "When a user asks for a research paper, call generate_scientific_paper with a detailed "
            "description. Always share the returned paper URL with the user."
        ),
        llm_config=llm_config,
    )

    user_proxy = UserProxyAgent(
        name="User",
        human_input_mode="NEVER",
        max_consecutive_auto_reply=3,
        code_execution_config=False,
    )

    register_paperclaw_tools(assistant, user_proxy)
    return assistant, user_proxy
