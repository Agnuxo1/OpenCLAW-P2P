"""
PaperClaw component for Haystack pipelines.

Installation:
    pip install haystack-ai requests

Usage:
    from paperclaw_component import PaperClawGenerator

    # Use as a standalone component
    gen = PaperClawGenerator(author="Ada Lovelace")
    result = gen.run(description="A distributed consensus algorithm using VDFs")
    print(result["url"])   # https://www.p2pclaw.com/app/papers/paper-XXXX

    # Wire into a Pipeline
    from haystack import Pipeline
    pipeline = Pipeline()
    pipeline.add_component("paperclaw", PaperClawGenerator())
    result = pipeline.run({"paperclaw": {"description": "Your topic..."}})

Signed: Silicon: Claude Opus 4.7 / Carbon: Francisco Angulo de Lafuente / Platform: p2pclaw.com
"""

import requests
from typing import Optional
from haystack import component, default_from_dict, default_to_dict
from haystack.core.serialization import default_to_dict as _to_dict

PAPERCLAW_API = "https://www.p2pclaw.com/api/paperclaw/generate"


@component
class PaperClawGenerator:
    """Haystack component that generates and publishes a research paper via P2PCLAW.

    Input slots:
        description (str): Research idea or project description (30-4000 chars).
        author (str, optional): Author name — overrides the component-level default.

    Output slots:
        url (str): Published paper URL on p2pclaw.com.
        title (str): Generated paper title.
        word_count (int): Word count of the paper.
        pdf_url (str): Direct PDF URL.
        success (bool): Whether publication succeeded.
        error (str | None): Error message on failure.
    """

    def __init__(self, author: str = "PaperClaw-Haystack", tags: Optional[list] = None, timeout: int = 120):
        self.author = author
        self.tags = tags or []
        self.timeout = timeout

    @component.output_types(
        url=str,
        title=str,
        word_count=int,
        pdf_url=str,
        success=bool,
        error=Optional[str],
    )
    def run(self, description: str, author: Optional[str] = None):
        """Run the PaperClaw pipeline."""
        used_author = author or self.author
        if len(description.strip()) < 30:
            return {"success": False, "error": "description must be ≥ 30 chars",
                    "url": "", "title": "", "word_count": 0, "pdf_url": ""}
        try:
            resp = requests.post(
                PAPERCLAW_API,
                json={
                    "description": description.strip()[:4000],
                    "author": used_author,
                    "tags": self.tags[:10],
                    "client": "paperclaw-haystack",
                },
                timeout=self.timeout,
            )
            resp.raise_for_status()
            data = resp.json()
        except Exception as e:
            return {"success": False, "error": str(e),
                    "url": "", "title": "", "word_count": 0, "pdf_url": ""}

        if not data.get("success"):
            return {"success": False, "error": data.get("message") or data.get("error"),
                    "url": "", "title": "", "word_count": 0, "pdf_url": ""}

        url = data["url"]
        return {
            "success": True,
            "url": url,
            "title": data.get("title", "Untitled"),
            "word_count": data.get("wordCount", 0),
            "pdf_url": f"{url}#print",
            "error": None,
        }

    def to_dict(self):
        return default_to_dict(self, author=self.author, tags=self.tags, timeout=self.timeout)

    @classmethod
    def from_dict(cls, data):
        return default_from_dict(cls, data)
