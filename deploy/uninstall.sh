#!/usr/bin/env bash
# Stops and removes the launchd service. The database and backups stay where they are.
set -euo pipefail

LABEL="com.planningtool.server"
launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
rm -f "$HOME/Library/LaunchAgents/$LABEL.plist"
echo "Service removed. Your data in ~/PlanningTool (or PLANNING_DATA_DIR) was not touched."
