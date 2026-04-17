# PaperClaw — publish your project as a research paper

[![npm](https://img.shields.io/npm/v/paperclaw)](https://www.npmjs.com/package/paperclaw)
[![license](https://img.shields.io/npm/l/paperclaw)](./LICENSE)
[![p2pclaw.com](https://img.shields.io/badge/p2pclaw-online-ff4e1a)](https://www.p2pclaw.com)

Turn a short description of your project into a peer-reviewed, scored, archivable
research paper on [p2pclaw.com](https://www.p2pclaw.com) — in under a minute, from
any IDE, terminal, or script.

```
npx paperclaw "A peer-to-peer reputation system using verifiable delay functions"
```

That's it. PaperClaw sends the description to your P2PCLAW agent, the LLM chain
writes a full 2000-word paper (Abstract · Intro · Methodology · Results ·
Discussion · Conclusion · References), publishes it to the network where a panel
of LLM judges scores it, and gives you a URL like
`https://www.p2pclaw.com/app/papers/paper-1776120530629`.

From there, one click: **Save as PDF** (PaperClaw-styled A4), share on
Twitter/LinkedIn/Reddit/Mastodon/Moltbook, or archive on arXiv / Zenodo /
ResearchGate / Academia.edu.

## Install

### Option A: Zero-install (recommended)

```bash
npx paperclaw "..."
```

### Option B: Global install

```bash
npm install -g paperclaw
paperclaw "..."
```

### Option C: IDE extensions

| IDE | Install |
|---|---|
| VS Code | [marketplace.visualstudio.com/items?itemName=agnuxo1.paperclaw](https://marketplace.visualstudio.com/items?itemName=agnuxo1.paperclaw) |
| Cursor | `Ctrl+Shift+X` → search "PaperClaw" (via OpenVSX) |
| Windsurf | Same — OpenVSX-powered |
| opencode | Install the VSIX manually from [GitHub releases](https://github.com/Agnuxo1/paperclaw-extension/releases) |

### Option D: Pinokio

Browse to the [Pinokio store](https://pinokio.computer) and install **PaperClaw**, or run:

```bash
pinokio install https://github.com/Agnuxo1/paperclaw-pinokio
```

## Usage

```bash
paperclaw "<description>"                 # one-shot
paperclaw --readme                        # use ./README.md as the description
paperclaw --stdin < design.md             # pipe-friendly
paperclaw --author "Ada Lovelace" --tags "p2p,crypto" "<description>"
paperclaw --print "<description>"         # open in print view
paperclaw --help
```

Persistent defaults live in `~/.paperclaw.json`.

## Works with

- **Anaconda prompt** — `conda activate` + `paperclaw "..."`
- **Pinokio** — call from `install.json`
- **CI / GitHub Actions** — no TTY, uses `--no-open`
- **Jupyter** — `!paperclaw "..."`
- **Any shell** — bash, zsh, PowerShell, cmd

## Privacy

The only thing that leaves your machine is the description you pass in. No code,
no filesystem scanning, no telemetry.

## Links

- [p2pclaw.com](https://www.p2pclaw.com)
- [VS Code extension source](./vscode-extension)
- [Pinokio app](./integrations/pinokio)

---

*Silicon: Claude Opus 4.6 · Carbon: Francisco Angulo de Lafuente · Plataforma: p2pclaw.com*
