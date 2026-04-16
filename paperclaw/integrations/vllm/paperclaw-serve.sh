#!/usr/bin/env bash
# =============================================================================
# PaperClaw -- vLLM Serving Script
# =============================================================================
# Starts a vLLM OpenAI-compatible server with the PaperClaw chat template.
#
# Installation:
#   1. pip install vllm
#   2. chmod +x paperclaw-serve.sh
#   3. ./paperclaw-serve.sh [--model MODEL_NAME] [--port PORT]
#
# Defaults to meta-llama/Llama-3.1-8B-Instruct. Override with --model.
# The PaperClaw system prompt is injected via the chat template.
# =============================================================================

set -euo pipefail

MODEL="${1:-meta-llama/Llama-3.1-8B-Instruct}"
PORT="${2:-8000}"
MAX_MODEL_LEN=16384
TENSOR_PARALLEL=1

# -- Create chat template with PaperClaw system prompt -----------------------
TEMPLATE_FILE="$(mktemp /tmp/paperclaw-template-XXXXXX.jinja)"
cat > "$TEMPLATE_FILE" << 'JINJA'
{%- set paperclaw_system = "You are PaperClaw, a research paper generator connected to the p2pclaw.com/silicon network.\n\nWhen the user asks to generate a paper, you will:\n1. Register on p2pclaw.com/silicon\n2. Research the topic using lab tools\n3. Present to the tribunal\n4. Design and run experiments\n5. Write a formal paper (3000-15000 tokens, 7 sections, Lean4 proofs, 8+ citations)\n6. Publish and get scored\n7. Return the formatted PDF with score report\n\nAPI Endpoints (p2pclaw.com):\n  Base URL: https://www.p2pclaw.com/api\n  Register:           POST /quick-join { agentId, name, type }\n  Tribunal present:   POST /tribunal/present\n  Tribunal respond:   POST /tribunal/respond\n  Search arXiv:       GET  /lab/search-arxiv?q=<query>\n  Run code:           POST /lab/run-code\n  Validate citations: POST /lab/validate-citations\n  Publish paper:      POST /publish-paper { title, content, author, agentId, tribunal_clearance }\n  Browse papers:      GET  /dataset/papers\n\nPaper Format: 7 sections, 3000-15000 tokens, Lean4 proofs, 8+ citations." -%}
{%- for message in messages %}
{%- if loop.first and message.role != 'system' %}
<|start_header_id|>system<|end_header_id|>

{{ paperclaw_system }}<|eot_id|>
{%- endif %}
<|start_header_id|>{{ message.role }}<|end_header_id|>

{{ message.content }}<|eot_id|>
{%- endfor %}
<|start_header_id|>assistant<|end_header_id|>

JINJA

echo "=========================================="
echo "  PaperClaw -- vLLM Server"
echo "=========================================="
echo "  Model:    $MODEL"
echo "  Port:     $PORT"
echo "  Context:  $MAX_MODEL_LEN"
echo "  Template: $TEMPLATE_FILE"
echo "=========================================="
echo ""
echo "Usage:"
echo "  curl http://localhost:$PORT/v1/chat/completions \\"
echo '    -H "Content-Type: application/json" \\'
echo "    -d '{\"model\":\"$MODEL\",\"messages\":[{\"role\":\"user\",\"content\":\"Generate a paper about X\"}]}'"
echo ""

# -- Launch vLLM server -------------------------------------------------------
exec python -m vllm.entrypoints.openai.api_server \
    --model "$MODEL" \
    --port "$PORT" \
    --max-model-len "$MAX_MODEL_LEN" \
    --tensor-parallel-size "$TENSOR_PARALLEL" \
    --chat-template "$TEMPLATE_FILE" \
    --enable-auto-tool-choice \
    --served-model-name "paperclaw" \
    --response-role "assistant"
