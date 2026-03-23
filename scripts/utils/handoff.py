#!/usr/bin/env python3
import os
import sys
from datetime import datetime
from pathlib import Path


def main():
    notes = " ".join(sys.argv[1:])
    if not notes:
        print("Usage: /handoff {NOTES}")
        sys.exit(1)

    project_root = Path(__file__).resolve().parent.parent.parent
    project_name = project_root.name

    plugin_data_env = os.environ.get("CLAUDE_PLUGIN_DATA")
    if plugin_data_env:
        handoff_dir = Path(plugin_data_env) / "handoff"
    else:
        handoff_dir = Path.home() / ".claude" / "projects" / project_name / "handoff"

    handoff_dir.mkdir(parents=True, exist_ok=True)
    
    timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    filepath = handoff_dir / f"handoff_{timestamp}.md"
    
    content = f"""# Context Handoff Signal
**Date:** {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}

## Focus
{notes}
"""
    filepath.write_text(content)

    print("\n" + "=" * 60)
    print("👋 CONTEXT HANDOFF SIGNAL")
    print("=" * 60)
    print(f"FOCUS: {notes}")
    print("=" * 60)
    print("\nRECOMMENDATION: Run /compact or /clear now to reset context.")
    print("The next session should focus strictly on the notes above.\n")


if __name__ == "__main__":
    main()
