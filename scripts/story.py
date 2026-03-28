#!/usr/bin/env python3
"""
story.py — canonical story file operations.

Commands:
  path   <NNN>                   Print the path to story NNN (searches active + completed)
  status <NNN>                   Print the current Status line value
  status <NNN> "<new status>"    Update the Status line in-place
  note   <NNN> "<text>"          Append a Correction Note block to the story
  list   [--status <value>]      List story paths, optionally filtered by status

Exit codes:
  0  success
  1  story not found or bad arguments
"""

import sys
import re
import shutil
from pathlib import Path

SEARCH_DIRS = [
    Path("docs/stories"),
    Path("docs/stories/completed"),
]

STATUS_PATTERN = re.compile(r"^\*\*Status:\*\*\s*(.+)$", re.MULTILINE)


def find_story(number: str) -> Path | None:
    for d in SEARCH_DIRS:
        if not d.exists():
            continue
        matches = sorted(d.glob(f"story_{number}_*.md"))
        if matches:
            return matches[0]
    return None


def cmd_path(number: str) -> int:
    p = find_story(number)
    if not p:
        print(f"story.py: story {number} not found", file=sys.stderr)
        return 1
    print(p)
    return 0


def cmd_status_get(number: str) -> int:
    p = find_story(number)
    if not p:
        print(f"story.py: story {number} not found", file=sys.stderr)
        return 1
    content = p.read_text()
    m = STATUS_PATTERN.search(content)
    if not m:
        print(f"story.py: no Status line in {p}", file=sys.stderr)
        return 1
    print(m.group(1).strip())
    return 0


def cmd_status_set(number: str, new_status: str) -> int:
    p = find_story(number)
    if not p:
        print(f"story.py: story {number} not found", file=sys.stderr)
        return 1
    content = p.read_text()
    if not STATUS_PATTERN.search(content):
        print(f"story.py: no Status line in {p}", file=sys.stderr)
        return 1
    updated = STATUS_PATTERN.sub(f"**Status:** {new_status}", content, count=1)
    _atomic_write(p, updated)
    return 0


def cmd_note(number: str, text: str) -> int:
    p = find_story(number)
    if not p:
        print(f"story.py: story {number} not found", file=sys.stderr)
        return 1
    content = p.read_text()
    # Count existing correction notes to number them
    existing = len(re.findall(r"^## Correction Note", content, re.MULTILINE))
    label = f"## Correction Note {existing + 1}" if existing else "## Correction Note"
    block = f"\n{label}\n{text.strip()}\n"
    _atomic_write(p, content.rstrip() + "\n" + block)
    return 0


def cmd_list(status_filter: str | None) -> int:
    found = []
    for d in SEARCH_DIRS:
        if not d.exists():
            continue
        for p in sorted(d.glob("story_*.md")):
            if status_filter is not None:
                content = p.read_text()
                m = STATUS_PATTERN.search(content)
                if not m or m.group(1).strip() != status_filter:
                    continue
            found.append(str(p))
    if not found:
        return 1
    print("\n".join(found))
    return 0


def _atomic_write(path: Path, content: str) -> None:
    tmp = path.with_suffix(".tmp")
    try:
        tmp.write_text(content, encoding="utf-8")
        shutil.move(str(tmp), str(path))
    finally:
        if tmp.exists():
            tmp.unlink()


def main() -> int:
    args = sys.argv[1:]
    if not args:
        print(__doc__)
        return 1

    cmd = args[0]

    if cmd == "path":
        if len(args) < 2:
            print("usage: story.py path <NNN>", file=sys.stderr)
            return 1
        return cmd_path(args[1])

    if cmd == "status":
        if len(args) < 2:
            print("usage: story.py status <NNN> [new status]", file=sys.stderr)
            return 1
        if len(args) == 2:
            return cmd_status_get(args[1])
        return cmd_status_set(args[1], args[2])

    if cmd == "note":
        if len(args) < 3:
            print("usage: story.py note <NNN> <text>", file=sys.stderr)
            return 1
        return cmd_note(args[1], args[2])

    if cmd == "list":
        status_filter = None
        if "--status" in args:
            idx = args.index("--status")
            if idx + 1 >= len(args):
                print("usage: story.py list [--status <value>]", file=sys.stderr)
                return 1
            status_filter = args[idx + 1]
        return cmd_list(status_filter)

    print(f"story.py: unknown command '{cmd}'", file=sys.stderr)
    return 1


if __name__ == "__main__":
    sys.exit(main())
