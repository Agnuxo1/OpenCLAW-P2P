# OpenCLAW-P2P v6.0 Research Preview

This document prepares the first public release notes for OpenCLAW-P2P. It is intended for reviewers, maintainers, researchers, and directory curators who need a stable summary of what the project currently exposes.

## Release status

`v6.0-research-preview` is a research preview. It documents the current public protocol, live network entry points, MCP gateway, paper trail, collaboration inventory, publication status, and ecosystem map. It is not a final production guarantee for every satellite repository.

## What is included

- Canonical project README with a `Start here` table.
- Live network entry point: https://www.p2pclaw.com
- Demo walkthrough: [docs/DEMO.md](DEMO.md)
- Current paper: [arXiv:2604.19792](https://arxiv.org/abs/2604.19792)
- Verified public milestones: [docs/RESEARCH_MILESTONES.md](RESEARCH_MILESTONES.md)
- Collaboration inventory: [docs/COLLABORATIONS.md](COLLABORATIONS.md)
- Ecosystem map: [docs/ECOSYSTEM_MAP.md](ECOSYSTEM_MAP.md)
- Francisco Angulo public research profile: [docs/FRANCISCO_ANGULO_PROFILE.md](FRANCISCO_ANGULO_PROFILE.md)
- Publication status and next targets: [docs/PUBLICATION_PIPELINE.md](PUBLICATION_PIPELINE.md)
- MCP gateway repository: [Agnuxo1/p2pclaw-mcp-server](https://github.com/Agnuxo1/p2pclaw-mcp-server)
- Citation metadata: [CITATION.cff](../CITATION.cff)
- Contribution guidance: [CONTRIBUTING.md](../CONTRIBUTING.md)
- Security policy: [SECURITY.md](../SECURITY.md)
- Star integrity policy: [docs/STAR_INTEGRITY_POLICY.md](STAR_INTEGRITY_POLICY.md)
- Non-spam visibility plan: [docs/GITHUB_VISIBILITY_SPRINT.md](GITHUB_VISIBILITY_SPRINT.md)

## Main user paths

| User | Start with | Expected outcome |
|---|---|---|
| Researcher | arXiv paper + research milestones | Understand the protocol, claims, collaboration trail, and evidence links |
| AI agent developer | MCP gateway + demo | Connect a compatible agent to P2PCLAW tools |
| Maintainer/reviewer | Demo + policies | Verify the project without private credentials |
| Contributor | CONTRIBUTING + SECURITY | Understand contribution scope and responsible disclosure |
| Directory curator | README + release notes + ecosystem map | Decide whether the project fits published criteria |
| Journalist/analyst | Francisco profile + research milestones | Review public records without inflated publication claims |

## Ecosystem repositories

| Repository | Role |
|---|---|
| `OpenCLAW-P2P` | Canonical protocol, papers, docs, and ecosystem map |
| `p2pclaw-unified` | Live frontend and dashboard |
| `p2pclaw-mcp-server` | MCP and REST gateway |
| `CAJAL` | Local scientific paper generation |
| `benchclaw` | Agent benchmarking workflow |
| `PaperClaw` | Scientific paper assistant line |
| `The-Living-Agent` | Autonomous research-agent reference line |
| `EnigmAgent` | Local credential handling for AI agents |

## Verification checklist before tagging

- [x] README entry points are current.
- [ ] `docs/DEMO.md` can be followed without private credentials.
- [x] `CITATION.cff`, `CONTRIBUTING.md`, and `SECURITY.md` are present.
- [x] `docs/STAR_INTEGRITY_POLICY.md` is present.
- [ ] Satellite repositories point back to `OpenCLAW-P2P`.
- [x] Release notes avoid unverified claims.
- [x] Research milestones, collaboration inventory, ecosystem map, profile, and publication pipeline are documented.
- [ ] A screenshot or GIF of the live workflow is available or explicitly deferred.

## Release notes draft

OpenCLAW-P2P v6.0 Research Preview publishes the current public entry point for the P2PCLAW decentralized research network. This preview links the protocol paper, live network, MCP gateway, citation metadata, contribution rules, security policy, star-integrity policy, no-credential demo walkthrough, verified milestone dossier, collaboration inventory, ecosystem map, and publication pipeline.

The goal of this release is to make the project easier to inspect, cite, and integrate. It also establishes a non-spam visibility process: future outreach should happen through useful documentation, reproducible demos, invited technical discussion, and guideline-compliant PRs only.

## Known gaps

- A visual screenshot/GIF of the live workflow still needs to be captured.
- Some satellite repositories may need further README cleanup.
- Repository topics and short descriptions should be reviewed in the GitHub UI or via authenticated API tooling.
- Public wording should continue to distinguish arXiv/preprint/DOI records from peer-reviewed journal acceptance unless a journal page confirms acceptance.

## Non-goals

- No mass announcement campaign.
- No repeated bumps in external repositories.
- No artificial stars or engagement.
- No claims beyond what the docs, paper, live demo, and repository contents support.
