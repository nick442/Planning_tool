#!/usr/bin/env bash
# Restores the database from a nightly backup.
#
#   deploy/restore.sh                         list the available backups
#   deploy/restore.sh planning-2026-11-07.db  restore that one
#
# The current database is kept next to it as planning.db.before-restore-<time>.
# The restored database gets a new sync epoch, so every device sends it
# everything it has: changes made after the backup come back too (last write
# wins per record).
set -euo pipefail

LABEL="com.planningtool.server"
DATA_DIR="${PLANNING_DATA_DIR:-$HOME/PlanningTool}"
BACKUP_DIR="${PLANNING_BACKUP_DIR:-$DATA_DIR/backups}"
DB="$DATA_DIR/planning.db"
TARGET="$HOME/Library/LaunchAgents/$LABEL.plist"

if [[ $# -eq 0 ]]; then
  echo "Backups in $BACKUP_DIR (newest first):"
  ls -1r "$BACKUP_DIR" 2>/dev/null | grep -E '^planning-[0-9-]+\.db$' || echo "  (none yet)"
  echo
  echo "Restore one with: deploy/restore.sh <file name>"
  exit 0
fi

BACKUP="$1"
[[ -f "$BACKUP" ]] || BACKUP="$BACKUP_DIR/$1"
if [[ ! -f "$BACKUP" ]]; then
  echo "No such backup: $1" >&2
  exit 1
fi

echo "==> Stopping the service"
launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
sleep 1

if [[ -f "$DB" ]]; then
  SAVED="$DB.before-restore-$(date +%Y%m%d-%H%M%S)"
  echo "==> Keeping the current database as $SAVED"
  mv "$DB" "$SAVED"
fi
# A leftover write-ahead log must never be replayed onto the restored file.
rm -f "$DB-wal" "$DB-shm"
cp "$BACKUP" "$DB"
# A new epoch tells every device that the server's data was replaced, so they
# send everything they have (changes made after the backup come back).
sqlite3 "$DB" "insert or replace into meta (key, value) values ('epoch', lower(hex(randomblob(8))));"

echo "==> Starting the service"
launchctl bootstrap "gui/$(id -u)" "$TARGET"
sleep 2
curl -fsS "http://127.0.0.1:${PLANNING_PORT:-3000}/api/health" && echo
echo "==> Restored from $(basename "$BACKUP")."
