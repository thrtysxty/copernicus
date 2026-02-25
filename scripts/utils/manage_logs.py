#!/usr/bin/env python3
import json
import os
import re
import argparse
from datetime import datetime
from pathlib import Path

from src.agentic.telemetry import telemetry

PROJECT_ROOT = Path(__file__).parent.parent.parent
LOGS_DIR = PROJECT_ROOT / "docs" / "logs"
METADATA_FILE = LOGS_DIR / "metadata.json"
INTERVIEWER_FILE = PROJECT_ROOT / "docs" / "personas" / "04_meta_interviewer.md"


def load_metadata():
    if not os.path.exists(METADATA_FILE):
        return {"next_error_id": 1, "next_success_id": 1}
    with open(METADATA_FILE, "r") as f:
        return json.load(f)


def save_metadata(data):
    with open(METADATA_FILE, "w") as f:
        json.dump(data, f, indent=2)


def slugify(text):
    return text.lower().replace(" ", "-").replace("/", "-")[:50]


def get_error_template():
    """Extracts the error log template from the meta interviewer persona file."""
    try:
        content = INTERVIEWER_FILE.read_text()
        template_match = re.search(
            r"### Error Log Template\n```markdown\n(.*?)\n```", content, re.DOTALL
        )
        if template_match:
            return template_match.group(1).strip()
    except FileNotFoundError:
        pass
    # Fallback template
    return """# Error #[ID]: [Short Descriptive Name]
**Date:** [Date]
**Project/Context:** COPERNICUS IDE
..."""


def get_success_template():
    """Provides a template for success logs."""
    return """# Success #[ID]: [Short Descriptive Name]
**Date:** [Date]
**Project/Context:** COPERNICUS IDE

## What Went Well
[Describe the successful outcome.]

## Why It Worked
[Analyze the key factors contributing to the success.]

## The Key Ingredient
[Identify the single most important element (e.g., a specific prompt, a clear constraint).]

## Reproducibility
[How can this success be repeated in the future?]

## Triggering Prompt
```
[The exact prompt that led to the successful outcome.]
```
"""


def main():
    parser = argparse.ArgumentParser(description="Manage Agentic Practice Logs")
    parser.add_argument(
        "--type", choices=["error", "success"], required=True, help="Type of log"
    )
    parser.add_argument("--title", required=True, help="Short descriptive title")
    parser.add_argument("--triggering-prompt", default="N/A")
    parser.add_argument("--failure-category", default=None)
    parser.add_argument("--root-cause", default=None)
    parser.add_argument("--prevention-strategy", default=None)
    args = parser.parse_args()

    # Ensure dirs exist
    (LOGS_DIR / "errors").mkdir(exist_ok=True)
    (LOGS_DIR / "successes").mkdir(exist_ok=True)

    # Log event to database first
    telemetry.log_audit_event(
        log_type=args.type.upper(),
        title=args.title,
        triggering_prompt=args.triggering_prompt,
        failure_category=args.failure_category,
        root_cause=args.root_cause,
        prevention_strategy=args.prevention_strategy,
    )

    data = load_metadata()

    if args.type == "error":
        log_id = data.get("next_error_id", 1)
        data["next_error_id"] = log_id + 1
        subdir = "errors"
        prefix = "error"
        template = get_error_template()
    else:
        log_id = data.get("next_success_id", 1)
        data["next_success_id"] = log_id + 1
        subdir = "successes"
        prefix = "success"
        template = get_success_template()

    save_metadata(data)

    # Generate filename
    slug = slugify(args.title)
    filename = f"{prefix}-{log_id:03d}-{slug}.md"
    filepath = LOGS_DIR / subdir / filename

    # Scaffold the markdown file
    content = template.replace("[ID]", f"{log_id:03d}")
    content = content.replace("[Date]", datetime.now().strftime("%Y-%m-%d"))
    content = content.replace("[Short Descriptive Name]", args.title)
    filepath.write_text(content)

    print(f"✅ Created log file: {filepath}")


if __name__ == "__main__":
    main()
