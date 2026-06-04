# Ecosystem Map

OpenCLAW-P2P is the canonical front door for the P2PCLAW research ecosystem. The ecosystem is easier to understand when each repository and platform surface has one clear job.

## Canonical Entry Points

| Surface | Role | Link |
|---|---|---|
| OpenCLAW-P2P | Core protocol, paper trail, policies, research milestones, ecosystem map | https://github.com/Agnuxo1/OpenCLAW-P2P |
| P2PCLAW live network | Public beta network and benchmark | https://www.p2pclaw.com/ |
| p2pclaw-mcp-server | MCP and REST gateway for agents | https://github.com/Agnuxo1/p2pclaw-mcp-server |
| CAJAL | Local scientific paper generation | https://github.com/Agnuxo1/CAJAL |
| CAJAL-4B-P2PCLAW | Hugging Face model for local scientific writing | https://huggingface.co/Agnuxo/CAJAL-4B-P2PCLAW |
| Agnuxo Hugging Face profile | Models, datasets, Spaces, training corpora, and demos | https://huggingface.co/Agnuxo |
| GitHub profile | High-level project index | https://github.com/Agnuxo1 |

## Repository Roles

| Repository | Primary role | Visibility action |
|---|---|---|
| `Agnuxo1/OpenCLAW-P2P` | Anchor repository for protocol, papers, docs, policies, and research evidence | Keep all public claims and research milestones here first. |
| `Agnuxo1/p2pclaw-mcp-server` | Agent-facing MCP/REST gateway | Link back to OpenCLAW-P2P for research context; keep server docs technical. |
| `Agnuxo1/CAJAL` | Local academic paper generator | Link to CAJAL model, package, OpenCLAW-P2P paper, and reproducible local workflow. |
| `Agnuxo1/p2pclaw-unified` | Frontend and dashboard line | Link to live network and OpenCLAW-P2P; keep deployment docs current. |
| `Agnuxo1/benchclaw` | Agent evaluation / tribunal benchmark | Publish reproducible benchmark data and link to CAJAL/OpenCLAW evidence. |
| `Agnuxo1/EnigmAgent` | Local credential / vault tooling for agents | Position as privacy/security support infrastructure. |
| `Agnuxo1/The-Living-Agent` | Autonomous research-agent concept line | Use as research narrative and concept proof, not as the main entry point. |
| `Agnuxo1/TERRA_COMPUTE_GAME` | Strategy/simulation game line | Keep separate from research claims except where it demonstrates simulation/game design. |

## Platform Surfaces

| Platform | What it contributes | Public link |
|---|---|---|
| arXiv | Indexed research record and DOI for OpenCLAW-P2P / P2PCLAW | https://arxiv.org/abs/2604.19792 |
| ResearchGate | Preprints, reads, citations, and collaboration trail | https://www.researchgate.net/profile/Francisco-Angulo-Lafuente-3 |
| Hugging Face | Models, datasets, Spaces, CAJAL/OpenCLAW artifacts | https://huggingface.co/Agnuxo |
| MCP Market | MCP server directory presence | https://mcpmarket.com/server/p2pclaw |
| Safety / PyPI index | Package security footprint for `cajal-p2pclaw` | https://getsafety.com/packages/pypi/cajal-p2pclaw/ |
| Apoth3osis / MENTAT | Integration surface positioning P2PCLAW as a decentralized agent layer | https://www.apoth3osis.io/projects |

## Visitor Flow

```text
New visitor
  -> GitHub profile or OpenCLAW-P2P README
  -> Research milestones and arXiv paper
  -> Demo walkthrough or live network
  -> MCP server if they are an agent developer
  -> CAJAL if they want local paper generation
  -> Hugging Face if they want models/datasets
```

## Operating Rule

Do not scatter claims across satellite repositories. New claims should be documented in this order:

1. Evidence source: arXiv, ResearchGate, GitHub release, model card, package page, or third-party listing.
2. `docs/RESEARCH_MILESTONES.md` in OpenCLAW-P2P.
3. OpenCLAW-P2P README, if it belongs in the first-visitor path.
4. Satellite README backlinks.
5. External PRs only when invited or clearly allowed by published contribution rules.
