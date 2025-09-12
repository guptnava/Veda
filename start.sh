#!/bin/bash

set -euo pipefail

echo "🚀 Starting all services in background (with per-service logs)..."

# Helper function to wait until a port is ready
wait_for_port() {
  local host=$1
  local port=$2
  echo "⏳ Waiting for $host:$port to be ready..."
  until nc -z $host $port; do
    sleep 1
  done
  echo "✅ $host:$port is up!"
}

ROOT_DIR=$(cd "$(dirname "$0")" && pwd)
RUN_DIR="$ROOT_DIR/run"
mkdir -p "$RUN_DIR"
PIDS_FILE="$RUN_DIR/pids.txt"
echo -n > "$PIDS_FILE"

timestamp() { date +"%Y%m%d-%H%M%S"; }

log_and_pid() {
  local name="$1"; shift
  local dir="$1"; shift
  local cmd=("$@")
  mkdir -p "$dir"
  local log="$dir/${name}_$(timestamp).log"
  echo "▶ $name -> $log"
  # Start in a new session when possible so group kill works reliably
  if command -v setsid >/dev/null 2>&1; then
    (cd "$dir" && setsid nohup "${cmd[@]}" > "$log" 2>&1 & echo "$!" > "$RUN_DIR/${name}.pid")
  else
    (cd "$dir" && nohup "${cmd[@]}" > "$log" 2>&1 & echo "$!" > "$RUN_DIR/${name}.pid")
  fi
  local pid
  pid=$(cat "$RUN_DIR/${name}.pid")
  echo "$name $pid $log" >> "$PIDS_FILE"
}

# Start Flask API
echo "🔌 Starting Flask APIs..."

# Activate venv if available
if [ -d "$ROOT_DIR/api/venv" ]; then
  # shellcheck source=/dev/null
  source "$ROOT_DIR/api/venv/bin/activate"
fi

log_and_pid "flask-db-intent-5012" "$ROOT_DIR/api/database_NoLLM_agent" env FLASK_APP=ai_db_intent_interface.py FLASK_RUN_PORT=5012 FLASK_RUN_HOST=0.0.0.0 FLASK_RUN_NO_RELOAD=1 flask run --no-reload
log_and_pid "flask-db-intent-nomodel-5011" "$ROOT_DIR/api/database_NoLLM_agent" env FLASK_APP=ai_db_intent_embeded_nomodel_interface.py FLASK_RUN_PORT=5011 FLASK_RUN_HOST=0.0.0.0 FLASK_RUN_NO_RELOAD=1 flask run --no-reload

log_and_pid "flask-db-langchain-5013" "$ROOT_DIR/api/database_LLM_agent" env FLASK_APP=ai_db_langchain_interface.py FLASK_RUN_PORT=5013 FLASK_RUN_HOST=0.0.0.0 FLASK_RUN_NO_RELOAD=1 flask run --no-reload
log_and_pid "flask-db-langchain-prompt-5014" "$ROOT_DIR/api/database_LLM_agent" env FLASK_APP=ai_db_langchain_prompt_interface.py FLASK_RUN_PORT=5014 FLASK_RUN_HOST=0.0.0.0 FLASK_RUN_NO_RELOAD=1 flask run --no-reload
log_and_pid "flask-db-langchain-embed-5004" "$ROOT_DIR/api/database_LLM_agent" env FLASK_APP=ai_db_langchain_embedding_prompt_interface.py FLASK_RUN_PORT=5004 FLASK_RUN_HOST=0.0.0.0 FLASK_RUN_NO_RELOAD=1 flask run --no-reload
log_and_pid "flask-db-langchain-embed-narr-5009" "$ROOT_DIR/api/database_LLM_agent" env FLASK_APP=ai_db_langchain_embedding_prompt_narrated_interface.py FLASK_RUN_PORT=5009 FLASK_RUN_HOST=0.0.0.0 FLASK_RUN_NO_RELOAD=1 flask run --no-reload

log_and_pid "flask-rest-rado-5005" "$ROOT_DIR/api/restful_LLM_agent" env FLASK_APP=rado.py FLASK_RUN_PORT=5005 FLASK_RUN_HOST=0.0.0.0 FLASK_RUN_NO_RELOAD=1 flask run --no-reload
log_and_pid "flask-rest-embed-5006" "$ROOT_DIR/api/restful_LLM_agent" env FLASK_APP=ai_restful_embedding_prompt_interface.py FLASK_RUN_PORT=5006 FLASK_RUN_HOST=0.0.0.0 FLASK_RUN_NO_RELOAD=1 flask run --no-reload

log_and_pid "flask-generic-rag-5010" "$ROOT_DIR/api/database_generic_rag_LLM_agent" env FLASK_APP=ai_generic_database_rag_agent.py FLASK_RUN_PORT=5010 FLASK_RUN_HOST=0.0.0.0 FLASK_RUN_NO_RELOAD=1 flask run --no-reload

log_and_pid "flask-table-ops-5015" "$ROOT_DIR/api/table_ops_service" env FLASK_APP=smart_cache.py FLASK_RUN_PORT=5015 FLASK_RUN_HOST=0.0.0.0 FLASK_RUN_NO_RELOAD=1 flask run --no-reload

echo "🖥️ Starting Node.js backend..."
log_and_pid "node-server-3000" "$ROOT_DIR/server" node server.js

echo "🌐 Starting Vite frontend..."
log_and_pid "vite-frontend-5173" "$ROOT_DIR/client" npm run dev

#start streamlit training aplication
echo "📚 Starting Training application..."
log_and_pid "streamlit-training-8501" "$ROOT_DIR/api/Training" streamlit run training_app.py --server.address 0.0.0.0


# Build index after service ready (best-effort)
wait_for_port 0.0.0.0 5011 || true
curl -s -X POST http://0.0.0.0:5011/build_index >/dev/null 2>&1 || true

echo "💾 PIDs recorded in $PIDS_FILE"

# Generate stop script (PID + process-group aware)
STOP_SCRIPT="$RUN_DIR/stop.sh"
cat > "$STOP_SCRIPT" << 'EOS'
#!/bin/bash
set -euo pipefail
ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)
RUN_DIR="$ROOT_DIR/run"
PIDS_FILE="$RUN_DIR/pids.txt"

stop_pid() {
  local name="$1"; shift
  local pid="$1"
  [ -z "${pid:-}" ] && return 0
  if kill -0 "$pid" >/dev/null 2>&1; then
    local pgid
    pgid=$(ps -o pgid= -p "$pid" 2>/dev/null | tr -d ' ' || echo "")
    if [ -n "$pgid" ]; then
      echo "Killing $name (PID $pid, PGID $pgid)"
      kill -TERM -"$pgid" || true
    else
      echo "Killing $name (PID $pid)"
      kill -TERM "$pid" || true
    fi
    sleep 1
    if kill -0 "$pid" >/dev/null 2>&1; then
      if [ -n "${pgid:-}" ]; then
        echo "Force killing $name (PGID $pgid)"
        kill -KILL -"$pgid" || true
      else
        echo "Force killing $name (PID $pid)"
        kill -KILL "$pid" || true
      fi
    fi
  else
    echo "$name (PID $pid) is not running"
  fi
}

echo "🛑 Stopping services..."

# Prefer precise .pid files, fall back to pids.txt
shopt -s nullglob
PID_FILES=("$RUN_DIR"/*.pid)
if [ "${#PID_FILES[@]}" -gt 0 ]; then
  for file in "${PID_FILES[@]}"; do
    name="$(basename "$file" .pid)"
    pid="$(cat "$file" 2>/dev/null || echo)"
    stop_pid "$name" "$pid"
  done
else
  if [ ! -f "$PIDS_FILE" ]; then
    echo "No PID files or pids.txt found under $RUN_DIR"
    exit 1
  fi
  echo "Using $PIDS_FILE"
  while read -r name pid log; do
    [ -z "${name:-}" ] && continue
    stop_pid "$name" "$pid"
  done < "$PIDS_FILE"
fi

echo "✅ All done."
EOS
chmod +x "$STOP_SCRIPT"

echo "✅ All services launched. Use $STOP_SCRIPT to stop them."
echo "📜 Logs written under each service directory with timestamped filenames."
