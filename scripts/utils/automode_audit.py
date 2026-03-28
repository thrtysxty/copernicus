#!/usr/bin/env python3
import json
import os
from collections import Counter
from pathlib import Path

def main():
    log_file = Path.home() / ".claude" / "logs" / "automode-hits.jsonl"

    if not log_file.exists():
        print(f"Log file {log_file} does not exist.")
        return

    tool_counts = Counter()
    bash_commands = Counter()
    soft_deny_flags = []

    soft_deny_keywords = ["force", "rm -rf", "DROP", "reset --hard"]

    with open(log_file, 'r', encoding='utf-8') as f:
        for line_num, line in enumerate(f, 1):
            line = line.strip()
            if not line:
                continue
            try:
                data = json.loads(line)
            except json.JSONDecodeError:
                print(f"Warning: Could not decode JSON on line {line_num}")
                continue

            tool_name = data.get("tool_name", "unknown")

            # Retrieve the appropriate input field based on the tool.
            if tool_name == "Bash" or tool_name == "bash":
                input_val = data.get("command", "")
            else:
                input_val = data.get("file_path", "")

            tool_counts[tool_name] += 1

            if tool_name == "Bash" or tool_name == "bash":
                bash_commands[input_val] += 1

                # Check for soft_deny keywords
                for kw in soft_deny_keywords:
                    if kw in input_val:
                        soft_deny_flags.append({
                            "line": line_num,
                            "timestamp": data.get("timestamp"),
                            "command": input_val,
                            "keyword": kw
                        })

    print("=== Auto-Mode Audit Summary ===")
    print("\nTool Call Counts:")
    for tool, count in tool_counts.most_common():
        print(f"  {tool}: {count}")

    print("\nTop 10 Most Frequent Bash Commands:")
    for cmd, count in bash_commands.most_common(10):
        print(f"  {count}x : {cmd}")

    if soft_deny_flags:
        print("\n!!! WARNING: Soft Deny Keywords Detected !!!")
        for flag in soft_deny_flags:
            print(f"  [Line {flag['line']}] {flag['timestamp']} - Keyword '{flag['keyword']}' in: {flag['command']}")
    else:
        print("\nNo soft deny keywords detected.")

if __name__ == "__main__":
    main()
