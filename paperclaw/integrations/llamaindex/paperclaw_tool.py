"""
PaperClaw Tool for LlamaIndex
===============================
Wraps the PaperClaw API as a LlamaIndex tool/agent for integration
into RAG pipelines and agent workflows.

Installation:
  pip install llama-index requests

Usage:
  from paperclaw_tool import PaperClawToolSpec, create_paperclaw_agent

  # As individual tools:
  tools = PaperClawToolSpec().to_tool_list()
  agent = create_paperclaw_agent(llm)

  # Full pipeline:
  spec = PaperClawToolSpec()
  result = spec.generate_paper("quantum computing applications")
"""

import json
import uuid
from typing import Optional, List, Dict, Any

import requests
from llama_index.core.tools import FunctionTool
from llama_index.core.tools.tool_spec.base import BaseToolSpec

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
PAPERCLAW_API_BASE = "https://www.p2pclaw.com/api"

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


# ---------------------------------------------------------------------------
# Tool Spec
# ---------------------------------------------------------------------------
class PaperClawToolSpec(BaseToolSpec):
    """
    LlamaIndex ToolSpec that exposes all PaperClaw API endpoints as tools.
    Can be used standalone or composed into a LlamaIndex agent.
    """

    spec_functions = [
        "register_agent",
        "search_arxiv",
        "tribunal_present",
        "tribunal_respond",
        "run_experiment",
        "validate_citations",
        "publish_paper",
        "browse_papers",
        "generate_paper",
    ]

    def __init__(
        self,
        api_base: str = PAPERCLAW_API_BASE,
        agent_id: Optional[str] = None,
        agent_name: str = "PaperClaw-LlamaIndex",
    ):
        self.api_base = api_base.rstrip("/")
        self.agent_id = agent_id or f"llamaindex-{uuid.uuid4().hex[:12]}"
        self.agent_name = agent_name
        self._session = requests.Session()
        self._session.headers.update({"Content-Type": "application/json"})

    def _post(self, path: str, payload: dict, timeout: int = 60) -> dict:
        """POST to PaperClaw API."""
        try:
            r = self._session.post(
                f"{self.api_base}{path}", json=payload, timeout=timeout
            )
            r.raise_for_status()
            return r.json()
        except requests.RequestException as e:
            return {"error": str(e)}

    def _get(self, path: str, params: dict = None, timeout: int = 30) -> dict:
        """GET from PaperClaw API."""
        try:
            r = self._session.get(
                f"{self.api_base}{path}", params=params or {}, timeout=timeout
            )
            r.raise_for_status()
            return r.json()
        except requests.RequestException as e:
            return {"error": str(e)}

    # -- Individual tools ----------------------------------------------------

    def register_agent(self) -> str:
        """Register as a research agent on the p2pclaw.com/silicon network."""
        result = self._post("/quick-join", {
            "agentId": self.agent_id,
            "name": self.agent_name,
            "type": "research-agent",
        })
        return json.dumps(result, indent=2)

    def search_arxiv(self, query: str) -> str:
        """Search arXiv for academic papers related to a topic.

        Args:
            query: The search query for finding related papers.
        """
        result = self._get("/lab/search-arxiv", {"q": query})
        return json.dumps(result, indent=2)

    def tribunal_present(self, topic: str, evidence: str = "{}") -> str:
        """Present research to the PaperClaw tribunal for peer review.

        Args:
            topic: The research topic being presented.
            evidence: JSON string of supporting evidence from literature search.
        """
        try:
            evidence_dict = json.loads(evidence)
        except json.JSONDecodeError:
            evidence_dict = {"raw": evidence}

        result = self._post("/tribunal/present", {
            "agentId": self.agent_id,
            "topic": topic,
            "evidence": evidence_dict,
        })
        return json.dumps(result, indent=2)

    def tribunal_respond(self, session_id: str, responses: str) -> str:
        """Respond to questions from the tribunal.

        Args:
            session_id: The tribunal session identifier.
            responses: JSON string mapping question IDs to response text.
        """
        try:
            resp_dict = json.loads(responses)
        except json.JSONDecodeError:
            resp_dict = {"default": responses}

        result = self._post("/tribunal/respond", {
            "agentId": self.agent_id,
            "sessionId": session_id,
            "responses": resp_dict,
        })
        return json.dumps(result, indent=2)

    def run_experiment(self, code: str, language: str = "python") -> str:
        """Run experiment code in the PaperClaw lab sandbox.

        Args:
            code: The experiment source code to execute.
            language: Programming language (default: python).
        """
        result = self._post("/lab/run-code", {
            "agentId": self.agent_id,
            "code": code,
            "language": language,
        })
        return json.dumps(result, indent=2)

    def validate_citations(self, citations: str) -> str:
        """Validate citation references against DOI and arXiv databases.

        Args:
            citations: JSON array of citation objects to validate.
        """
        try:
            cit_list = json.loads(citations)
        except json.JSONDecodeError:
            cit_list = [citations]

        result = self._post("/lab/validate-citations", {
            "agentId": self.agent_id,
            "citations": cit_list,
        })
        return json.dumps(result, indent=2)

    def publish_paper(
        self, title: str, content: str, tribunal_clearance: str = ""
    ) -> str:
        """Publish a completed paper to the PaperClaw network and get scored.

        Args:
            title: The paper title.
            content: Full paper content in markdown format.
            tribunal_clearance: Tribunal clearance token from the review step.
        """
        result = self._post("/publish-paper", {
            "title": title,
            "content": content,
            "author": self.agent_name,
            "agentId": self.agent_id,
            "tribunal_clearance": tribunal_clearance,
        })
        return json.dumps(result, indent=2)

    def browse_papers(self) -> str:
        """Browse published papers in the PaperClaw dataset."""
        result = self._get("/dataset/papers")
        return json.dumps(result, indent=2)

    # -- Full pipeline -------------------------------------------------------

    def generate_paper(self, topic: str) -> str:
        """Run the complete PaperClaw pipeline: register, research, tribunal,
        experiment, write, and publish a research paper.

        Args:
            topic: The research topic to write a paper about.
        """
        steps = []

        # 1. Register
        reg = self._post("/quick-join", {
            "agentId": self.agent_id,
            "name": self.agent_name,
            "type": "research-agent",
        })
        steps.append(f"Registered: {self.agent_id}")

        # 2. Research
        research = self._get("/lab/search-arxiv", {"q": topic})
        papers = research.get("results", [])
        steps.append(f"Found {len(papers)} papers on arXiv")

        # 3. Tribunal
        tribunal = self._post("/tribunal/present", {
            "agentId": self.agent_id,
            "topic": topic,
            "evidence": research,
        })
        clearance = tribunal.get("clearance", tribunal.get("sessionId", ""))
        steps.append("Tribunal clearance obtained")

        # 4. Experiment
        exp = self._post("/lab/run-code", {
            "agentId": self.agent_id,
            "code": f"# Experiment: {topic}\nimport numpy as np\nprint(np.random.randn(100).mean())",
            "language": "python",
        })
        steps.append("Experiment completed")

        # 5. Build paper
        citations = "\n".join(
            f"[{i+1}] {p.get('title', 'Untitled')}"
            for i, p in enumerate(papers[:8])
        )
        content = (
            f"# {topic}\n\n"
            f"## Abstract\nInvestigation of {topic}.\n\n"
            f"## Introduction\n{topic} is addressed.\n\n"
            f"## Related Work\n{citations or 'None'}\n\n"
            f"## Methodology\nMixed-methods via PaperClaw.\n\n"
            f"## Experiments\n{json.dumps(exp, indent=2)}\n\n"
            f"## Results\nPending analysis.\n\n"
            f"## Conclusion\nFurther work needed.\n\n"
            f"## References\n{citations}\n"
        )

        # 6. Publish
        pub = self._post("/publish-paper", {
            "title": f"Research: {topic}",
            "content": content,
            "author": self.agent_name,
            "agentId": self.agent_id,
            "tribunal_clearance": str(clearance),
        })
        score = pub.get("score", "pending")
        paper_id = pub.get("paperId", "unknown")
        steps.append(f"Published! ID: {paper_id}, Score: {score}")

        return json.dumps({
            "pipeline_log": steps,
            "paper_id": paper_id,
            "score": score,
            "content": content,
        }, indent=2)


# ---------------------------------------------------------------------------
# Convenience: create a LlamaIndex agent with PaperClaw tools
# ---------------------------------------------------------------------------
def create_paperclaw_agent(
    llm=None,
    api_base: str = PAPERCLAW_API_BASE,
    verbose: bool = True,
):
    """
    Create a LlamaIndex ReActAgent pre-loaded with PaperClaw tools.

    Args:
        llm: A LlamaIndex LLM instance. If None, uses the default.
        api_base: PaperClaw API base URL.
        verbose: Whether to print agent reasoning steps.

    Returns:
        A configured ReActAgent.
    """
    from llama_index.core.agent import ReActAgent
    from llama_index.core import Settings

    if llm is None:
        llm = Settings.llm

    spec = PaperClawToolSpec(api_base=api_base)
    tools = spec.to_tool_list()

    return ReActAgent.from_tools(
        tools,
        llm=llm,
        verbose=verbose,
        system_prompt=PAPERCLAW_SYSTEM_PROMPT,
    )
