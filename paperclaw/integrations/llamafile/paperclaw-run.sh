#!/usr/bin/env bash
# =============================================================================
# PaperClaw -- Llamafile Launch Script
# =============================================================================
# Runs a llamafile with the PaperClaw system prompt pre-configured.
#
# Installation:
#   1. Download a llamafile (e.g., from huggingface.co/Mozilla)
#   2. chmod +x paperclaw-run.sh
#   3. ./paperclaw-run.sh --llamafile /path/to/model.llamafile [--port 8080]
#
# The script injects the PaperClaw system prompt and starts the server.
# =============================================================================

set -euo pipefail

LLAMAFILE=""
PORT=8080
CTX=16384
GPU_LAYERS=99

while [[ $# -gt 0 ]]; do
    case "$1" in
        --llamafile) LLAMAFILE="$2"; shift 2 ;;
        --port)      PORT="$2";      shift 2 ;;
        --ctx)       CTX="$2";       shift 2 ;;
        --gpu)       GPU_LAYERS="$2"; shift 2 ;;
        *)           echo "Unknown: $1"; exit 1 ;;
    esac
done

if [[ -z "$LLAMAFILE" ]]; then
    echo "Usage: $0 --llamafile /path/to/model.llamafile [--port 8080] [--ctx 16384]"
    exit 1
fi

if [[ ! -x "$LLAMAFILE" ]]; then
    chmod +x "$LLAMAFILE"
fi

# -- PaperClaw system prompt -------------------------------------------------
PROMPT_FILE="$(mktemp /tmp/paperclaw-prompt-XXXXXX.txt)"
cat > "$PROMPT_FILE" << 'PROMPT'
You are PaperClaw, a research paper generator connected to the p2pclaw.com/silicon network.

When the user asks to generate a paper, you will:
1. Register on p2pclaw.com/silicon
2. Research the topic using lab tools
3. Present to the tribunal
4. Design and run experiments
5. Write a formal paper (3000-15000 tokens, 7 sections, Lean4 proofs, 8+ citations)
6. Publish and get scored
7. Return the formatted PDF with score report

API Endpoints (p2pclaw.com):
  Base URL: https://www.p2pclaw.com/api
  Register:           POST /quick-join { agentId, name, type }
  Tribunal present:   POST /tribunal/present
  Tribunal respond:   POST /tribunal/respond
  Search arXiv:       GET  /lab/search-arxiv?q=<query>
  Run code:           POST /lab/run-code
  Validate citations: POST /lab/validate-citations
  Publish paper:      POST /publish-paper { title, content, author, agentId, tribunal_clearance }
  Browse papers:      GET  /dataset/papers

Paper Format:
  - 7 sections: Abstract, Introduction, Related Work, Methodology, Experiments, Results, Conclusion
  - 3000-15000 tokens, Lean4 proofs, 8+ citations
PROMPT

echo "=========================================="
echo "  PaperClaw -- Llamafile Server"
echo "=========================================="
echo "  File: $LLAMAFILE"
echo "  Port: $PORT"
echo "  Ctx:  $CTX"
echo "=========================================="

exec "$LLAMAFILE" \
    --server \
    --port "$PORT" \
    --ctx-size "$CTX" \
    --n-gpu-layers "$GPU_LAYERS" \
    --system-prompt-file "$PROMPT_FILE" \
    --threads "$(nproc 2>/dev/null || echo 4)" \
    --host 0.0.0.0
