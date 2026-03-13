#!/usr/bin/env python3
import argparse
import re
import sys
from pathlib import Path

# Add project root to sys.path to handle imports when run as a script
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))

from scripts.utils import generate_backlog

STORY_TEMPLATE = """# User Story {number}: {title}

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

## Test Cases
*Note: Tests must be written before implementation (RED phase).*
- [ ] Test Case 1: ...
- [ ] Test Case 2: ...

## IPC Channels Used
- [ ] List any new or modified IPC channels here

## DB Schema Changes
- [ ] None / describe ALTER TABLE migrations required

## Files in Scope
- list files

## Blocks
- None

## Blocked By
- None

## Technical Constraints
- **Constraint 1:** ...

## Definition of Done
- [ ] Tests written (RED phase) before implementation
- [ ] All tests pass (GREEN phase)
- [ ] All acceptance criteria met
- [ ] No type check errors (`npx tsc --noEmit`)

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


def scaffold_file(template_path: Path, target_path: Path, feature_name: str):
    if not template_path.exists():
        print(f"⚠️  Template not found: {template_path}")
        return

    target_path.parent.mkdir(parents=True, exist_ok=True)

    with open(template_path, "r") as f:
        content = f.read()

    # Simple camel case conversion for component names
    pascal_name = "".join(x.capitalize() for x in feature_name.split("_"))

    formatted_content = content.format(
        feature_name=pascal_name
        if target_path.suffix in [".tsx", ".jsx"]
        else feature_name
    )

    with open(target_path, "w") as f:
        f.write(formatted_content)

    print(f"✅ Created {target_path}")


def main():
    parser = argparse.ArgumentParser(
        description="Scaffold a new User Story and boilerplate"
    )
    parser.add_argument("title", help="Title of the story (e.g., 'Profit Logic')")
    parser.add_argument(
        "--type",
        choices=["story", "api", "component"],
        default="story",
        help="Type of feature to scaffold",
    )
    parser.add_argument("--epic", help="Epic ID or Title to link to", default="TBD")
    args = parser.parse_args()

    project_root = Path(__file__).parent.parent.parent
    stories_dir = project_root / "docs" / "stories"
    stories_dir.mkdir(parents=True, exist_ok=True)

    # Ensure scripts/utils is in path for generate_backlog import if run directly
    sys.path.insert(0, str(project_root))

    number = get_next_number(project_root)
    slug = args.title.lower().replace(" ", "_")
    filename = stories_dir / f"story_{number}_{slug}.md"

    # Create the story file
    with open(filename, "w") as f:
        f.write(STORY_TEMPLATE.format(number=number, title=args.title))

    # Update Epic in the file if provided
    if args.epic != "TBD":
        with open(filename, "r") as f:
            content = f.read()
        content = content.replace("Phase X - TBD", f"Epic: {args.epic}")
        with open(filename, "w") as f:
            f.write(content)
    print(f"✅ Created {filename}")

    templates_dir = project_root / "docs" / "templates"

    # Scaffold additional files if type is 'api'
    if args.type == "api":
        feature_name = slug
        # Route
        scaffold_file(
            templates_dir / "api_route_template.py",
            project_root / "backend" / "routes" / f"{feature_name}.py",
            feature_name,
        )
        # Test
        scaffold_file(
            templates_dir / "test_file_template.py",
            project_root / "tests" / "routes" / f"test_{feature_name}.py",
            feature_name,
        )

    # Scaffold additional files if type is 'component'
    elif args.type == "component":
        feature_name = slug
        pascal_name = "".join(x.capitalize() for x in feature_name.split("_"))
        # Component
        scaffold_file(
            templates_dir / "component_template.tsx",
            project_root
            / "copernicus"
            / "src"
            / "renderer"
            / "components"
            / f"{pascal_name}.tsx",
            feature_name,
        )

    # Automatically regenerate the backlog
    print("🔄 Regenerating backlog...")
    generate_backlog.main()
    print("✅ Backlog updated.")


if __name__ == "__main__":
    main()
