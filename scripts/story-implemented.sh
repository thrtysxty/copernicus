#!/usr/bin/env bash
# story-implemented.sh — check if a story number already has a commit on main
#
# Usage:
#   bash scripts/story-implemented.sh 489
#   bash scripts/story-implemented.sh 489 490 521
#
# Exit 0 = not implemented (safe to dispatch)
# Exit 1 = already implemented (abort dispatch)
#
# Also called internally by jules_assign.sh.

set -euo pipefail

if [ "$#" -eq 0 ]; then
  echo "Usage: $0 <story_number> [story_number ...]"
  exit 2
fi

git fetch origin main --quiet 2>/dev/null || true

BLOCKED=0
for NUM in "$@"; do
  COMMIT=$(git log origin/main --oneline -i --grep="story.${NUM}[^0-9]" 2>/dev/null | head -1)
  if [ -n "$COMMIT" ]; then
    echo "❌ Story ${NUM} already implemented on main: $COMMIT"
    BLOCKED=1
  else
    echo "✅ Story ${NUM} — no prior commit found, safe to dispatch"
  fi
done

exit $BLOCKED
