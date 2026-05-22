#!/usr/bin/env bash
set -e
cd /Users/dadmin/Projects/copernicus

echo "=== Pushing 2 commits to origin/main ==="
git push origin main

echo ""
echo "=== Dispatching Jules stories 729, 730, 732 ==="
bash scripts/jules_assign.sh docs/stories/story_729_fix_active_indicator_underline.md
bash scripts/jules_assign.sh docs/stories/story_730_remove_console_logs.md
bash scripts/jules_assign.sh docs/stories/story_732_fix_terminal_send_regression.md

echo ""
echo "DONE — stories 729/730/732 dispatched to Jules"
echo "Story 731 (backend Flask route tests) goes to qwopus queue"
