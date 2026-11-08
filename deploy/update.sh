#!/usr/bin/env bash
# Pulls the latest code, rebuilds and restarts the service. Data is untouched.
set -euo pipefail

LABEL="com.planningtool.server"
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO"

echo "==> Updating $REPO"
git pull --ff-only
pnpm install --frozen-lockfile
pnpm build

echo "==> Restarting the service"
launchctl kickstart -k "gui/$(id -u)/$LABEL"
sleep 2
curl -fsS "http://127.0.0.1:${PLANNING_PORT:-3000}/api/health" && echo
echo "==> Done. Open devices will offer to reload into the new version."
