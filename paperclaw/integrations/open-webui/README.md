# PaperClaw - Open WebUI Integration

<!--
Project: OpenCLAW-P2P / P2PCLAW
Copyright: 2026 Francisco Angulo de Lafuente
Document author: Francisco Angulo de Lafuente
ORCID: https://orcid.org/0009-0001-1634-7063
Attribution recorded: 2026-11-05
SPDX-License-Identifier: MIT
-->

> **Document author:** Francisco Angulo de Lafuente ([ORCID 0009-0001-1634-7063](https://orcid.org/0009-0001-1634-7063)). Attribution recorded 2026-11-05.

## Installation

1. Copy `paperclaw_pipe.py` into your Open WebUI pipelines directory
2. In Open WebUI, go to **Admin Panel > Pipelines**
3. Upload or paste the pipe file
4. Enable the PaperClaw pipe
5. In any chat, type `/paper <topic>` or "generate paper about <topic>"

## Configuration

Set environment variables or edit the `Valves` class:
- `PAPERCLAW_API_BASE`: API endpoint (default: production Railway URL)
- `PAPERCLAW_AGENT_ID`: Your agent identifier

## Usage

```
/paper quantum entanglement in neural networks
```

Or naturally:
```
Generate a paper about graph neural networks for routing optimization
```

The pipe intercepts matching messages, runs the full PaperClaw pipeline
(register, research, tribunal, experiment, write, publish), and returns
the formatted paper with score report directly in chat.


## Citation and reuse

Cite OpenCLAW-P2P / P2PCLAW using [CITATION.cff](../../../CITATION.cff). Check [LICENSE_SCOPE.md](../../../LICENSE_SCOPE.md) and the applicable `LICENSE` before reuse.
