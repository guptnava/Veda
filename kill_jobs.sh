#!/bin/bash

# Kill all relevant project jobs: prefer run/pids.txt, then fall back to pattern matching.

set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")" && pwd)
PIDS_FILE="$ROOT_DIR/run/pids.txt"

echo "🛑 Killing project jobs..."

if [ -f "$PIDS_FILE" ]; then
  echo "→ Using $PIDS_FILE"
  while read -r name pid log; do
    [ -z "${pid:-}" ] && continue
    if kill -0 "$pid" >/dev/null 2>&1; then
      echo "Killing $name (PID $pid)"
      kill "$pid" || true
      sleep 1
      if kill -0 "$pid" >/dev/null 2>&1; then
        echo "Force killing $name (PID $pid)"
        kill -9 "$pid" || true
      fi
    fi
  done < "$PIDS_FILE"
else
  echo "ℹ️  No $PIDS_FILE; falling back to pattern-based kill"
fi

# Safety net: pattern match common processes
echo "→ Pattern-based cleanup"
patterns=(
  "flask run"
  "smart_cache.py"
  "ai_db_intent_interface.py"
  "ai_db_langchain_interface.py"
  "ai_db_langchain_prompt_interface.py"
  "ai_db_langchain_embedding_prompt_interface.py"
  "ai_db_langchain_embedding_prompt_narrated_interface.py"
  "ai_generic_database_rag_agent.py"
  "rado.py"
  "ai_restful_embedding_prompt_interface.py"
  "node server.js"
  "vite"
  "streamlit run training_app.py"
)

for pat in "${patterns[@]}"; do
  echo "Trying to kill pattern: $pat"
  pkill -f "$pat" 2>/dev/null || true
done

echo "✅ Kill attempts complete. Use ./run/status.sh to verify."

