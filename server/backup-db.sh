#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DB_PATH="${1:-$SCRIPT_DIR/dining.db}"
BACKUP_PATH="${DB_PATH}.bak"

if [ ! -f "$DB_PATH" ]; then
  echo "Error: database not found at $DB_PATH" >&2
  exit 1
fi

sqlite3 "$DB_PATH" ".backup '$BACKUP_PATH'"
echo "Backed up $DB_PATH -> $BACKUP_PATH"
