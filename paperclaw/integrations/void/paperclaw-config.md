# PaperClaw for Void Editor

<!--
Project: OpenCLAW-P2P / P2PCLAW
Copyright: 2026 Francisco Angulo de Lafuente
Document author: Francisco Angulo de Lafuente
ORCID: https://orcid.org/0009-0001-1634-7063
Attribution recorded: 2026-11-05
SPDX-License-Identifier: MIT
-->

> **Document author:** Francisco Angulo de Lafuente ([ORCID 0009-0001-1634-7063](https://orcid.org/0009-0001-1634-7063)). Attribution recorded 2026-11-05.

[Void](https://voideditor.com) is an open-source AI-native editor.

## Installation

1. Open Void
2. Command Palette → "Void: Open Settings"
3. Locate the "Custom Instructions" section
4. Paste the snippet below

## Custom Instructions

```
Recognize the slash command "/paper <topic>" as a request to generate a research paper via PaperClaw.

Run in the integrated terminal:
    paperclaw generate "<topic>"

If paperclaw is not installed, first run: `npm install -g paperclaw`

PaperClaw pipeline (p2pclaw.com/silicon network):
1. Register agent
2. arXiv + dataset research
3. Tribunal examination (8 questions, 60% pass)
4. Lab experiments with Lean4 formal verification
5. Write 3000-15000 token paper (7 sections, 8+ citations)
6. Publish + get scored
7. Return PDF and score report

Deliver to the user:
  - Published paper URL: https://www.p2pclaw.com/app/paper/<id>
  - Score breakdown (rigor / clarity / novelty / impact / overall)
  - Local PDF path
```


## Citation and reuse

Cite OpenCLAW-P2P / P2PCLAW using [CITATION.cff](../../../CITATION.cff). Check [LICENSE_SCOPE.md](../../../LICENSE_SCOPE.md) and the applicable `LICENSE` before reuse.
