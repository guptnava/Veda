#!/bin/bash

# Collect all .log files from the repo into a single archive folder at project root
# and clear them from their original locations by moving them.
#
# Usage: bash collect_logs.sh
# Result: logs_archive/<timestamp>/ contains the moved logs preserving relative paths.

set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")" && pwd)
TS=$(date +"%Y%m%d-%H%M%S")
ARCHIVE_DIR="$ROOT_DIR/logs_archive/$TS"

echo "📦 Collecting logs into $ARCHIVE_DIR ..."
mkdir -p "$ARCHIVE_DIR"

# Find all .log files, excluding archive, node_modules and .git (Bash 3 compatible)
COUNT=0
while IFS= read -r -d '' f; do
  rel="${f#$ROOT_DIR/}"
  dest="$ARCHIVE_DIR/$rel"
  mkdir -p "$(dirname "$dest")"
  # Move (not copy) to both centralize and clear originals
  mv "$f" "$dest"
  echo "→ $rel"
  COUNT=$((COUNT+1))
done < <(find "$ROOT_DIR" -type f -name "*.log" \
  -not -path "$ROOT_DIR/logs_archive/*" \
  -not -path "$ROOT_DIR/node_modules/*" \
  -not -path "$ROOT_DIR/.git/*" -print0)

if [ "$COUNT" -eq 0 ]; then
  echo "ℹ️  No .log files found."
  exit 0
fi

echo "✅ Moved $COUNT log file(s) to $ARCHIVE_DIR"
echo "Tip: tar -C logs_archive -czf logs_$TS.tgz $TS to compress the archive."
