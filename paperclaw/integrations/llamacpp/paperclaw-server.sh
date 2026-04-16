#!/usr/bin/env bash
# =============================================================================
# PaperClaw -- llama.cpp Server Launcher
# =============================================================================
# Starts a llama.cpp server with the PaperClaw system prompt pre-loaded and
# a GBNF grammar file for structured paper output.
#
# Installation:
#   1. Build llama.cpp:  cd llama.cpp && make -j
#   2. Download a GGUF model (e.g., llama-3.1-8b-instruct.Q5_K_M.gguf)
#   3. chmod +x paperclaw-server.sh
#   4. ./paperclaw-server.sh --model /path/to/model.gguf
#
# Options:
#   --model PATH    Path to GGUF model (required)
#   --port  PORT    Server port (default: 8080)
#   --ctx   SIZE    Context size (default: 16384)
#   --gpu   LAYERS  GPU layers to offload (default: 99)
# =============================================================================

set -euo pipefail

# -- Defaults ----------------------------------------------------------------
MODEL=""
PORT=8080
CTX=16384
GPU_LAYERS=99
LLAMACPP_DIR="${LLAMACPP_DIR:-./llama.cpp}"

# -- Parse arguments ---------------------------------------------------------
while [[ $# -gt 0 ]]; do
    case "$1" in
        --model)  MODEL="$2";      shift 2 ;;
        --port)   PORT="$2";       shift 2 ;;
        --ctx)    CTX="$2";        shift 2 ;;
        --gpu)    GPU_LAYERS="$2"; shift 2 ;;
        *)        echo "Unknown option: $1"; exit 1 ;;
    esac
done

if [[ -z "$MODEL" ]]; then
    echo "ERROR: --model is required."
    echo "Usage: $0 --model /path/to/model.gguf [--port 8080] [--ctx 16384] [--gpu 99]"
    exit 1
fi

# -- PaperClaw system prompt -------------------------------------------------
SYSTEM_PROMPT='You are PaperClaw, a research paper generator connected to the p2pclaw.com/silicon network.

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

Paper sections: Abstract, Introduction, Related Work, Methodology, Experiments, Results, Conclusion.
Minimum 3000 tokens, 8+ citations, Lean4 proofs where applicable.'

# -- Create grammar file for structured output --------------------------------
GRAMMAR_FILE="$(mktemp /tmp/paperclaw-grammar-XXXXXX.gbnf)"
cat > "$GRAMMAR_FILE" << 'GRAMMAR'
# PaperClaw structured paper output grammar (GBNF)
# Ensures the model produces well-formed JSON paper objects

root      ::= paper
paper     ::= "{" ws
              "\"title\":" ws string "," ws
              "\"abstract\":" ws string "," ws
              "\"sections\":" ws sections "," ws
              "\"citations\":" ws citations "," ws
              "\"lean4_proofs\":" ws string
              ws "}"

sections  ::= "[" ws section ("," ws section)* ws "]"
section   ::= "{" ws
              "\"heading\":" ws string "," ws
              "\"content\":" ws string
              ws "}"

citations ::= "[" ws citation ("," ws citation)* ws "]"
citation  ::= "{" ws
              "\"id\":" ws number "," ws
              "\"title\":" ws string "," ws
              "\"authors\":" ws string "," ws
              "\"year\":" ws number "," ws
              "\"source\":" ws string
              ws "}"

string    ::= "\"" ([^"\\] | "\\" .)* "\""
number    ::= [0-9]+
ws        ::= [ \t\n]*
GRAMMAR

echo "=========================================="
echo "  PaperClaw -- llama.cpp Server"
echo "=========================================="
echo "  Model:   $MODEL"
echo "  Port:    $PORT"
echo "  Context: $CTX"
echo "  GPU:     $GPU_LAYERS layers"
echo "  Grammar: $GRAMMAR_FILE"
echo "=========================================="
echo ""
echo "Usage:"
echo "  curl http://localhost:$PORT/v1/chat/completions \\"
echo '    -H "Content-Type: application/json" \\'
echo "    -d '{\"messages\":[{\"role\":\"user\",\"content\":\"Generate a paper about X\"}]}'"
echo ""

# -- Launch server ------------------------------------------------------------
exec "${LLAMACPP_DIR}/llama-server" \
    --model "$MODEL" \
    --port "$PORT" \
    --ctx-size "$CTX" \
    --n-gpu-layers "$GPU_LAYERS" \
    --system-prompt-file <(echo "$SYSTEM_PROMPT") \
    --grammar-file "$GRAMMAR_FILE" \
    --threads "$(nproc 2>/dev/null || echo 4)" \
    --parallel 4 \
    --cont-batching \
    --log-disable
