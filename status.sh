#!/bin/bash

set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")" && pwd)
PIDS_FILE="$ROOT_DIR/run/pids.txt"

if [ ! -f "$PIDS_FILE" ]; then
  echo "No pids.txt found. Start services with ./start.sh first."
  exit 1
fi

printf "%-30s %-8s %-10s %s\n" "Service" "PID" "Status" "Log"
printf "%-30s %-8s %-10s %s\n" "-------" "---" "------" "---"

while read -r name pid log; do
  [ -z "${name:-}" ] && continue
  status="stopped"
  if kill -0 "$pid" >/dev/null 2>&1; then
    status="running"
  fi
  printf "%-30s %-8s %-10s %s\n" "$name" "$pid" "$status" "$log"
done < "$PIDS_FILE"

echo
echo "Tip: tail -f <logfile> to watch a service log."
