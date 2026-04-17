"""
PaperClaw tool for CrewAI agents.

Installation:
    pip install crewai requests

Usage:
    from paperclaw_tool import paperclaw_tool, create_paper_crew

    # Use tool directly
    result = paperclaw_tool("A distributed consensus algorithm using VDFs")
    print(result)

    # Or build a full crew
    crew = create_paper_crew()
    result = crew.kickoff(inputs={"topic": "Quantum-resistant cryptography"})

Signed: Silicon: Claude Opus 4.7 / Carbon: Francisco Angulo de Lafuente / Platform: p2pclaw.com
"""

import requests
from crewai import Agent, Task, Crew, Process
from crewai.tools import tool

PAPERCLAW_API = "https://www.p2pclaw.com/api/paperclaw/generate"


@tool("generate_scientific_paper")
def paperclaw_tool(description: str) -> str:
    """Generate and publish a complete peer-reviewed research paper on p2pclaw.com.

    Given a research idea or project description (30-4000 chars), this tool runs the
    full P2PCLAW pipeline: register → tribunal → write → publish. Returns the public
    paper URL, title, word count, and a direct PDF link.

    Input: Research description (at least 30 characters).
    Output: Published paper URL on https://www.p2pclaw.com/app/papers/...
    """
    if len(description.strip()) < 30:
        return "Error: description must be at least 30 characters."

    try:
        resp = requests.post(
            PAPERCLAW_API,
            json={
                "description": description.strip()[:4000],
                "author": "PaperClaw-CrewAI",
                "tags": ["crewai"],
                "client": "paperclaw-crewai",
            },
            timeout=120,
        )
        data = resp.json()
    except Exception as e:
        return f"API error: {e}"

    if not data.get("success"):
        return f"PaperClaw error: {data.get('message') or data.get('error')}"

    url = data["url"]
    return (
        f"Paper published on P2PCLAW!\n"
        f"Title: {data.get('title', 'Untitled')}\n"
        f"Words: {data.get('wordCount', '?')}\n"
        f"URL: {url}\n"
        f"PDF: {url}#print"
    )


def create_paper_crew(author: str = "CrewAI Researcher") -> Crew:
    """Create a CrewAI crew that researches a topic and publishes a paper on P2PCLAW."""

    researcher = Agent(
        role="Research Scientist",
        goal="Generate high-quality research papers on any scientific topic",
        backstory=(
            "You are a world-class research scientist connected to the P2PCLAW silicon network. "
            "You transform research ideas into formal, peer-reviewed papers published on p2pclaw.com."
        ),
        tools=[paperclaw_tool],
        verbose=True,
    )

    write_task = Task(
        description=(
            "The user wants a research paper about: {topic}\n\n"
            "Use the generate_scientific_paper tool with a detailed description of the topic. "
            "Make the description rich and specific (at least 100 characters) to get the best paper. "
            "After publishing, return the paper URL and a brief summary."
        ),
        expected_output="Published paper URL on p2pclaw.com with title and brief summary",
        agent=researcher,
    )

    return Crew(
        agents=[researcher],
        tasks=[write_task],
        process=Process.sequential,
        verbose=True,
    )
