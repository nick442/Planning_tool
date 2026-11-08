#!/usr/bin/env bash
# Installs (or reinstalls) the Planning Tool server as a launchd service on macOS.
#
#   deploy/install.sh              build, install and start the service
#   deploy/install.sh --dry-run    only print the service file it would install
#
# Settings (environment variables, all optional):
#   PLANNING_DATA_DIR     where the database lives      (default ~/PlanningTool)
#   PLANNING_BACKUP_DIR   where nightly copies go        (default $PLANNING_DATA_DIR/backups)
#   PLANNING_PORT         local port                     (default 3000)
#   PLANNING_TOKEN        access token for devices       (default: kept from the
#                         installed service, else a new random one)
set -euo pipefail

LABEL="com.planningtool.server"
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TEMPLATE="$REPO/deploy/$LABEL.plist"
AGENTS="$HOME/Library/LaunchAgents"
TARGET="$AGENTS/$LABEL.plist"
DRY_RUN=false
[[ "${1:-}" == "--dry-run" ]] && DRY_RUN=true

DATA_DIR="${PLANNING_DATA_DIR:-$HOME/PlanningTool}"
BACKUP_DIR="${PLANNING_BACKUP_DIR:-$DATA_DIR/backups}"
PORT="${PLANNING_PORT:-3000}"
LOG="$HOME/Library/Logs/planning-tool.log"

NODE="$(command -v node || true)"
if [[ -z "$NODE" ]]; then
  echo "Node.js not found. Install Node 22 first (e.g. 'brew install node@22')." >&2
  exit 1
fi
NODE_MAJOR="$("$NODE" -p 'process.versions.node.split(".")[0]')"
if (( NODE_MAJOR < 22 )); then
  echo "Node $NODE_MAJOR found at $NODE, but 22 or newer is needed." >&2
  exit 1
fi

# Keep the existing token on reinstall, so devices stay signed in.
TOKEN="${PLANNING_TOKEN:-}"
if [[ -z "$TOKEN" && -f "$TARGET" ]]; then
  TOKEN="$(/usr/libexec/PlistBuddy -c 'Print :EnvironmentVariables:PLANNING_TOKEN' "$TARGET" 2>/dev/null || true)"
fi
NEW_TOKEN=false
if [[ -z "$TOKEN" ]]; then
  TOKEN="$(openssl rand -hex 24)"
  NEW_TOKEN=true
fi

# Escape a value for XML, then for use as a sed replacement. Done with sed
# rather than bash substitutions, which differ between macOS's bash 3.2 and
# newer versions.
escape() {
  printf '%s' "$1" \
    | sed -e 's/&/\&amp;/g' -e 's/</\&lt;/g' -e 's/>/\&gt;/g' \
    | sed -e 's/[\/|\\]/\\&/g' -e 's/&/\\&/g'
}

render() {
  sed \
    -e "s|@NODE@|$(escape "$NODE")|g" \
    -e "s|@REPO@|$(escape "$REPO")|g" \
    -e "s|@PORT@|$(escape "$PORT")|g" \
    -e "s|@DATA_DIR@|$(escape "$DATA_DIR")|g" \
    -e "s|@BACKUP_DIR@|$(escape "$BACKUP_DIR")|g" \
    -e "s|@TOKEN@|$(escape "$TOKEN")|g" \
    -e "s|@LOG@|$(escape "$LOG")|g" \
    "$TEMPLATE"
}

if $DRY_RUN; then
  render
  exit 0
fi

echo "==> Building ($REPO)"
cd "$REPO"
corepack enable >/dev/null 2>&1 || true
if ! command -v pnpm >/dev/null; then
  echo "pnpm not found. Install it with 'brew install pnpm' (or 'corepack enable')." >&2
  exit 1
fi
pnpm install --frozen-lockfile
pnpm build

echo "==> Installing $TARGET"
mkdir -p "$AGENTS" "$DATA_DIR" "$BACKUP_DIR" "$(dirname "$LOG")"
render > "$TARGET.tmp"
plutil -lint "$TARGET.tmp" >/dev/null
mv "$TARGET.tmp" "$TARGET"
chmod 600 "$TARGET" # it contains the access token

echo "==> (Re)starting the service"
launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$TARGET"
launchctl enable "gui/$(id -u)/$LABEL"

for _ in $(seq 1 20); do
  if curl -fsS "http://127.0.0.1:$PORT/api/health" >/dev/null 2>&1; then break; fi
  sleep 0.5
done
if ! curl -fsS "http://127.0.0.1:$PORT/api/health"; then
  echo
  echo "The server did not answer. Check the log: tail -n 50 $LOG" >&2
  exit 1
fi
echo

echo "==> Done. The server runs on http://127.0.0.1:$PORT and starts at every login."
echo "    Database: $DATA_DIR/planning.db"
echo "    Backups:  $BACKUP_DIR (nightly, keeping 30)"
echo "    Log:      $LOG"
if $NEW_TOKEN; then
  echo
  echo "    New access token (enter it once on each device, under Sync):"
  echo "    $TOKEN"
fi
echo
echo "    Next: 'tailscale serve --bg $PORT' to reach it over HTTPS (see deploy/README.md)."
