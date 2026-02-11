#!/usr/bin/env python3
import argparse
import re
import sys
from pathlib import Path

from scripts.utils import generate_backlog

TEMPLATE = """# User Story {number}: {title}

**Status:** DRAFT
**Priority:** Medium
**Phase:** Phase X - TBD

## Narrative
**As a** [Role],
**I want to** [Action],
**So that** [Benefit].

## Context
[Link to PLAN_OF_RECORD or Architecture constraints]

## Acceptance Criteria
1.  **Criteria 1:** ...
2.  **Criteria 2:** ...

## Technical Constraints
- **Constraint 1:** ...

## Documentation Impact
- **New Files:**
- **Updated Files:**
- **Process Change:**
"""


def get_next_number(project_root: Path):
    stories_dirs = [
        project_root / "docs" / "stories",
        project_root / "docs" / "stories" / "completed",
    ]
    max_num = 0
    for s_dir in stories_dirs:
        if s_dir.exists():
            for f in s_dir.glob("story_*.md"):
                match = re.search(r"story_(\d+)_", f.name)
                if match:
                    num = int(match.group(1))
                    if num > max_num:
                        max_num = num
    return f"{max_num + 1:03d}"


def main():
    parser = argparse.ArgumentParser(description="Scaffold a new User Story")
    parser.add_argument("title", help="Title of the story (e.g., 'Profit Logic')")
    args = parser.parse_args()

    project_root = Path(__file__).parent.parent.parent
    stories_dir = project_root / "docs" / "stories"
    stories_dir.mkdir(parents=True, exist_ok=True)

    # Ensure scripts/utils is in path for generate_backlog import if run directly
    sys.path.insert(0, str(project_root))

    number = get_next_number(project_root)
    slug = args.title.lower().replace(" ", "_")
    filename = stories_dir / f"story_{number}_{slug}.md"

    with open(filename, "w") as f:
        f.write(TEMPLATE.format(number=number, title=args.title))

    print(f"✅ Created {filename}")

    # Automatically regenerate the backlog
    print("🔄 Regenerating backlog...")
    generate_backlog.main()
    print("✅ Backlog updated.")


if __name__ == "__main__":
    main()
