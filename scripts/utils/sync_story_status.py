#!/usr/bin/env python3
"""
Auto-mark stories COMPLETE when their implementation commit is detected in git log.
Tool-agnostic — fires for Jules, CCR, manual, or any other dispatch path.
Called from post-commit hook after every commit.
"""
import re
import subprocess
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
STORIES_DIR = PROJECT_ROOT / "docs" / "stories"


def get_recent_commits(n=100):
    result = subprocess.run(
        ['git', 'log', '--oneline', f'-{n}'],
        capture_output=True, text=True, cwd=PROJECT_ROOT
    )
    return result.stdout


def get_story_number(path):
    # Capture full story ID including optional letter suffix (e.g. 652b, 643)
    m = re.search(r'story_(\d+[a-z]*)', path.name)
    return m.group(1) if m else None


def mark_complete(path):
    content = path.read_text()
    if '**Status:** COMPLETE' in content:
        return False
    new_content = re.sub(
        r'^\*\*Status:\*\*.*',
        '**Status:** COMPLETE',
        content, count=1, flags=re.MULTILINE
    )
    if new_content != content:
        path.write_text(new_content)
        return True
    return False


def run():
    commits = get_recent_commits()
    marked = []

    for story_file in sorted(STORIES_DIR.glob("story_*.md")):
        content = story_file.read_text()
        if '**Status:** COMPLETE' in content:
            continue

        num = get_story_number(story_file)
        if not num:
            continue

        # Match only implementation commits: feat(...) or fix(...) prefixed
        # Exclude chore/docs/refactor/dispatch-prep commits — they don't mean the story is done
        # Strip leading zeros from numeric part; require exact story-id boundary (no suffix digits/letters)
        numeric_part = re.match(r'^(\d+)', num)
        stripped = str(int(numeric_part.group(1))) if numeric_part else num
        # letter suffix (e.g. 'b' in '652b') must also match exactly
        letter_suffix = num[len(stripped):]  # '' or 'b' etc.
        escaped_suffix = re.escape(letter_suffix)
        pattern = rf'^[0-9a-f]+ (?:feat|fix)\([^)]*story[.\-_]0*{stripped}{escaped_suffix}(?![\da-z])[^)]*\)'
        if re.search(pattern, commits, re.IGNORECASE | re.MULTILINE):
            if mark_complete(story_file):
                marked.append((num, story_file.name))
                print(f"  ✓ auto-marked COMPLETE: story_{num}")

    if marked:
        subprocess.run(
            ['python3', str(PROJECT_ROOT / 'scripts/utils/archive_completed_stories.py')],
            cwd=PROJECT_ROOT
        )
        subprocess.run(
            ['python3', str(PROJECT_ROOT / 'scripts/utils/generate_backlog.py')],
            cwd=PROJECT_ROOT
        )
        subprocess.run(
            ['git', 'add', 'docs/stories/completed/', 'BACKLOG.md'],
            cwd=PROJECT_ROOT
        )

    return len(marked)


if __name__ == '__main__':
    run()
