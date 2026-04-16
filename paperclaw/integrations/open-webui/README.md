# PaperClaw - Open WebUI Integration

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
