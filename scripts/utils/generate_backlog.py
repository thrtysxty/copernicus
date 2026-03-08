#!/usr/bin/env python3
import logging
import re
from pathlib import Path

PROJECT_ROOT = Path(__file__).parent.parent.parent
STORIES_DIR = PROJECT_ROOT / "docs" / "stories"
OUTPUT_FILE = PROJECT_ROOT / "BACKLOG.md"

# Define the sort order for priority
PRIORITY_ORDER = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3, "N/A": 4}


def parse_story_file(filepath: Path):
    """Parses a story file to extract metadata."""
    try:
        content = filepath.read_text()

        # Extract from header
        status_match = re.search(r"\*\*Status:\*\* (.*)", content)
        priority_match = re.search(r"\*\*Priority:\*\* (.*)", content)

        # Extract from filename
        filename_match = re.search(r"story_(\d+)_(.*)\.md", filepath.name)
        if not filename_match:
            return None

        story_id = filename_match.group(1)
        title = filename_match.group(2).replace("_", " ").title()

        return {
            "id": f"#{story_id}",
            "title": title,
            "status": status_match.group(1).strip() if status_match else "N/A",
            "priority": priority_match.group(1).strip() if priority_match else "N/A",
        }
    except Exception:
        return None


def main():
    """Generates the BACKLOG.md file."""
    stories = []

    # Recursively find all story files but exclude archived ones
    for filepath in sorted(STORIES_DIR.rglob("story_*.md")):
        if "archived" in filepath.parts:
            continue
        story_data = parse_story_file(filepath)
        if story_data:
            stories.append(story_data)

    # Sort stories by priority, then by status
    stories.sort(
        key=lambda s: (
            PRIORITY_ORDER.get(s["priority"].upper().split()[0], 99),
            s["status"],
        )
    )

    # Generate Markdown content
    md_content = ["# Project Backlog\n\n"]
    md_content.append("This file is auto-generated. Run `make backlog` to update.\n\n")
    md_content.append("| ID | Title | Status | Priority |\n")
    md_content.append("|:---|:------|:-------|:---------|\n")

    for story in stories:
        md_content.append(
            f"| {story['id']} | {story['title']} | {story['status']} | {story['priority']} |\n"
        )

    # The manual "Unprioritized Ideas" section is deprecated per Story #031
    OUTPUT_FILE.write_text("".join(md_content) + "\n")

    print(f"✅ Backlog generated successfully at {OUTPUT_FILE}")


if __name__ == "__main__":
    main()
