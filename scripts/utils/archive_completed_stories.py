#!/usr/bin/env python3
"""
Move COMPLETE stories from docs/stories/ to docs/stories/completed/.
Safe to run multiple times — idempotent.
Prints a summary of what was moved.
"""
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).parent.parent.parent
STORIES_DIR = PROJECT_ROOT / "docs" / "stories"
COMPLETED_DIR = STORIES_DIR / "completed"

COMPLETED_DIR.mkdir(parents=True, exist_ok=True)

moved = []
for story_file in sorted(STORIES_DIR.glob("story_*.md")):
    content = story_file.read_text()
    if "**Status:** COMPLETE" in content:
        dest = COMPLETED_DIR / story_file.name
        story_file.rename(dest)
        moved.append(story_file.name)

if moved:
    print(f"Archived {len(moved)} completed story/stories:")
    for name in moved:
        print(f"  → completed/{name}")
else:
    print("No completed stories to archive.")

sys.exit(0)
