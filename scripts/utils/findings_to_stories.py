#!/usr/bin/env python3
"""Parse a code review markdown file and scaffold story stubs for each finding."""
import argparse
import re
import subprocess
import sys
from pathlib import Path

FINDING_PATTERNS = [
    re.compile(r'^- \[ \] (.+)'),
    re.compile(r'^\*\*(?:Finding|Issue|Bug)\*\*:\s*(.+)'),
    re.compile(r'^(?:FAIL|BUG|ISSUE):\s*(.+)'),
    re.compile(r'^\d+\.\s+.*(should|must|fix|add|remove).+', re.IGNORECASE),
]

def extract_findings(text: str) -> list[str]:
    findings = []
    for line in text.splitlines():
        line = line.strip()
        for pat in FINDING_PATTERNS:
            m = pat.match(line)
            if m:
                finding = m.group(1) if m.lastindex else line
                findings.append(finding[:120])  # truncate long lines
                break
    return findings

def main():
    parser = argparse.ArgumentParser(description='Scaffold stories from review findings')
    parser.add_argument('review_file', help='Path to markdown review file')
    parser.add_argument('--dry-run', action='store_true', help='Print without creating')
    args = parser.parse_args()

    review_path = Path(args.review_file)
    if not review_path.exists():
        print(f"Error: {review_path} not found", file=sys.stderr)
        sys.exit(1)

    text = review_path.read_text()
    findings = extract_findings(text)

    if not findings:
        print("No findings detected.")
        return

    project_root = Path(__file__).parent.parent.parent
    scaffold = project_root / 'scripts' / 'utils' / 'scaffold_story.py'

    created = 0
    for finding in findings:
        title = f"Finding: {finding}"
        if args.dry_run:
            print(f"[dry-run] Would scaffold: {title}")
        else:
            result = subprocess.run(
                [sys.executable, str(scaffold), title],
                capture_output=True, text=True
            )
            if result.returncode == 0:
                created += 1
                print(f"Created: {title}")
            else:
                print(f"Failed: {title}\n{result.stderr}")

    print(f"\n{'Would create' if args.dry_run else 'Created'} {created if not args.dry_run else len(findings)} story stubs from {len(findings)} findings.")

if __name__ == '__main__':
    main()
