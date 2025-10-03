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
