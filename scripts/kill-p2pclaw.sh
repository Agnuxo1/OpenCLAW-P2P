#!/usr/bin/env bash
# kill-p2pclaw.sh — Stop all running P2PCLAW server processes
# Usage: bash scripts/kill-p2pclaw.sh

set -euo pipefail

MATCH="p2pclaw-mcp-server"
KILLED=0

echo "[kill-p2pclaw] Searching for P2PCLAW processes..."

# Find node processes whose command line contains the project path
while IFS= read -r pid; do
  CMD=$(cat /proc/"$pid"/cmdline 2>/dev/null | tr '\0' ' ' || true)
  if [[ "$CMD" == *"$MATCH"* ]]; then
    echo "[kill-p2pclaw] Killing PID $pid: $CMD"
    kill "$pid" 2>/dev/null && KILLED=$((KILLED + 1)) || echo "[kill-p2pclaw] WARNING: Could not kill PID $pid (already gone?)"
  fi
done < <(pgrep -x node 2>/dev/null || true)

if [[ $KILLED -eq 0 ]]; then
  echo "[kill-p2pclaw] No P2PCLAW processes found."
else
  echo "[kill-p2pclaw] Killed $KILLED process(es). Ports 3000–3099 should now be free."
fi
