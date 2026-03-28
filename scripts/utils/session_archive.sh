#!/usr/bin/env bash
# Session Archive Hook — Story 599
# Called by Claude Code Stop hook. Copies current session JSONL to
# docs/sessions/YYYY-MM-DD/ for permanent git-tracked storage.
#
# Receives Claude Code hook JSON on stdin.

set -euo pipefail

REPO_ROOT="/Users/dadmin/Projects/copernicus"
CLAUDE_PROJECTS="$HOME/.claude/projects/-Users-dadmin-Projects-copernicus"

# Extract session_id from hook payload
SESSION_ID=$(jq -r '.session_id // empty' 2>/dev/null)
[ -z "$SESSION_ID" ] && exit 0

SRC="${CLAUDE_PROJECTS}/${SESSION_ID}.jsonl"
[ ! -f "$SRC" ] && exit 0

DEST_DIR="${REPO_ROOT}/docs/sessions/$(date +%Y-%m-%d)"
mkdir -p "$DEST_DIR"

DEST="${DEST_DIR}/session_${SESSION_ID}.jsonl"

# Skip if already archived
[ -f "$DEST" ] && exit 0

cp "$SRC" "$DEST"

# Generate transcript (human/assistant turns only)
python3 "${REPO_ROOT}/scripts/utils/session_digest.py" --transcript-only "$DEST"
