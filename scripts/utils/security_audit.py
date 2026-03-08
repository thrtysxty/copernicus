#!/usr/bin/env python3
import logging
import sys
import re
import os
import subprocess

# Patterns for common secrets
SECRET_PATTERNS = {
    "Anthropic Key": r"sk-ant-api\d+-[a-zA-Z0-9\-_]{90,}",
    "OpenAI Key": r"sk-[a-zA-Z0-9]{48}",
    "Google API Key": r"AIza[0-9A-Za-z\-_]{35}",
    "GitHub Token": r"(ghp_|gho_|ghu_|ghs_|ghr_)[a-zA-Z0-9]{36}",
    "Generic Secret": r"(?i)(password|secret|token|apikey|private_key)\s*[:=]\s*['\"][a-zA-Z0-9]{16,}['\"]",
}


def scan_file(filepath):
    vulnerabilities = []
    try:
        with open(filepath, "r", errors="ignore") as f:
            content = f.read()
            for name, pattern in SECRET_PATTERNS.items():
                matches = re.finditer(pattern, content)
                for match in matches:
                    line_no = content.count("\n", 0, match.start()) + 1
                    vulnerabilities.append(f"[!] {name} found in {filepath}:{line_no}")
    except Exception as e:
        vulnerabilities.append(f"[ERROR] Could not read {filepath}: {str(e)}")
    return vulnerabilities


def main():
    # Only scan files changed in the last commit or currently staged
    try:
        # Check both staged and unstaged changes against HEAD
        files = subprocess.check_output(
            ["git", "diff", "--name-only", "HEAD"], text=True
        ).splitlines()
        # Also check untracked files
        untracked = subprocess.check_output(
            ["git", "ls-files", "--others", "--exclude-standard"], text=True
        ).splitlines()
        files.extend(untracked)
    except:
        files = []

    if not files:
        print("STATUS: PASSED")
        print("VULNERABILITIES: None (No changes to scan)")
        return

    all_vulnerabilities = []
    for f in files:
        if os.path.isfile(f):
            all_vulnerabilities.extend(scan_file(f))

    if all_vulnerabilities:
        print("STATUS: REJECTED")
        print("VULNERABILITIES:")
        for v in all_vulnerabilities:
            print(f"- {v}")
        sys.exit(1)
    else:
        print("STATUS: PASSED")
        print("VULNERABILITIES: None")


if __name__ == "__main__":
    main()
