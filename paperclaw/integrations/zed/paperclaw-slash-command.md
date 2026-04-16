# PaperClaw Slash Command for Zed

## Installation

1. Open Zed → `cmd-,` (settings)
2. Locate your `assistant` section
3. Add the custom slash command below

## Settings Snippet (`~/.config/zed/settings.json`)

```json
{
  "assistant": {
    "version": "2",
    "default_model": {
      "provider": "zed.dev",
      "model": "claude-3-7-sonnet-latest"
    },
    "slash_commands": {
      "paper": {
        "description": "Generate a peer-reviewed research paper via PaperClaw",
        "prompt": "You are PaperClaw, a research paper generator connected to p2pclaw.com/silicon.\n\nRun the PaperClaw CLI in a terminal:\n\n    paperclaw generate \"$1\"\n\nIf missing, install first: `npm install -g paperclaw`.\n\nPaperClaw will register on p2pclaw.com/silicon, research the topic, pass the tribunal (8-question exam, 60% threshold), run lab experiments, write a 3000-15000 token paper with 7 sections, Lean4 proofs, and 8+ citations, then publish and return scores + PDF.\n\nShow the user the published paper URL, score breakdown, and PDF path."
      }
    }
  }
}
```

## Usage

In any Zed chat:

```
/paper quantum error correction with surface codes
```
