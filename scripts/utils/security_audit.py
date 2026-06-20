#!/usr/bin/env python3
"""Security audit script for Copernicus.

Supports two modes:
  1. Git-change scan (default): scans files changed since HEAD + untracked files.
  2. Directory scan: scans an arbitrary directory tree recursively.

Also provides a standalone HMAC-SHA256 webhook payload verifier.
"""
import sys
import re
import os
import argparse
import hmac
import hashlib
import subprocess
from pathlib import Path

# Patterns for common secrets
SECRET_PATTERNS = {
    "Anthropic Key": r"sk-ant-api\d+-[a-zA-Z0-9\-_]{90,}",
    "OpenAI Key": r"sk-[a-zA-Z0-9]{48}",
    "Google API Key": r"AIza[0-9A-Za-z\-_]{35}",
    "GitHub Token": r"(ghp_|gho_|ghu_|ghs_|ghr_)[a-zA-Z0-9]{36}",
    "AWS Access Key ID": r"AKIA[0-9A-Z]{16}",
    "AWS Secret Access Key": r"['\"\s](?:aws)?_?(?:secret)?_?(?:access)?_?key['\"\s]*[:=]['\"\s]*[a-zA-Z0-9/+=]{40}['\"\s]",
    "Slack Token": r"xox[baprs]-[0-9]{10,13}-[0-9]{10,13}[a-zA-Z0-9-]*",
    "Discord Token": r"[MN][A-Za-z\d]{23}\.[\w-]{6}\.[\w-]{27}",
    "Generic Secret": r"(?i)(password|secret|token|apikey|private_key)\s*[:=]\s*['\"][a-zA-Z0-9]{16,}['\"]",
}

# Pre-compile patterns for performance
COMPILED_PATTERNS = {
    name: re.compile(pattern) for name, pattern in SECRET_PATTERNS.items()
}

# Files / directories to skip during directory scans
SKIP_PATTERNS = {
    re.compile(r"node_modules"),
    re.compile(r"\.git"),
    re.compile(r"__pycache__"),
    re.compile(r"\.cache"),
    re.compile(r"\.egg-info"),
    re.compile(r"\.pyc$"),
    re.compile(r"\.png$", re.I),
    re.compile(r"\.jpg$", re.I),
    re.compile(r"\.jpeg$", re.I),
    re.compile(r"\.gif$", re.I),
    re.compile(r"\.ico$", re.I),
    re.compile(r"\.woff2?$", re.I),
    re.compile(r"\.ttf$", re.I),
    re.compile(r"\.otf$", re.I),
    re.compile(r"\.db$", re.I),
}


def should_skip(path: str) -> bool:
    """Return True if the given path should be skipped during scanning."""
    for pattern in SKIP_PATTERNS:
        if pattern.search(path):
            return True
    return False


def verify_hmac_signature(payload: bytes, signature: str, secret: str) -> bool:
    """Verify HMAC-SHA256 signature for webhook payloads.

    Args:
        payload: raw request body bytes.
        signature: expected signature string (hex digest or "sha256=<hex>").
        secret: shared secret key.

    Returns:
        True if signature is valid, False otherwise.
    """
    if signature.startswith("sha256="):
        signature = signature[len("sha256="):]
    try:
        expected = hmac.new(
            secret.encode("utf-8"), payload, hashlib.sha256
        ).hexdigest()
        return hmac.compare_digest(expected, signature)
    except (TypeError, ValueError):
        return False


def verify_webhook_secret(payload: bytes, signature_header: str, secret: str) -> bool:
    """High-level webhook secret validation wrapper.

    Args:
        payload: raw request body bytes.
        signature_header: value of the X-Signature or similar header.
        secret: shared secret key.

    Returns:
        True if the webhook payload is authentic, False otherwise.
    """
    if not signature_header or not secret:
        return False
    return verify_hmac_signature(payload, signature_header, secret)


def scan_file(filepath: str) -> list[str]:
    """Scan a single file for secret patterns.

    Returns a list of vulnerability strings.
    """
    vulnerabilities = []
    try:
        with open(filepath, "r", errors="ignore") as f:
            content = f.read()
            for name, pattern in COMPILED_PATTERNS.items():
                matches = pattern.finditer(content)
                for match in matches:
                    line_no = content.count("\n", 0, match.start()) + 1
                    vulnerabilities.append(f"[!] {name} found in {filepath}:{line_no}")
    except Exception as e:
        vulnerabilities.append(f"[ERROR] Could not read {filepath}: {str(e)}")
    return vulnerabilities


def get_changed_files() -> list[str]:
    """Return list of files changed since HEAD plus untracked files."""
    files: list[str] = []
    try:
        # Check both staged and unstaged changes against HEAD
        diff_files = subprocess.check_output(
            ["git", "diff", "--name-only", "HEAD"], text=True
        ).splitlines()
        files.extend(diff_files)
        # Also check untracked files
        untracked = subprocess.check_output(
            ["git", "ls-files", "--others", "--exclude-standard"], text=True
        ).splitlines()
        files.extend(untracked)
    except subprocess.CalledProcessError:
        # Not a git repo or git command failed; return empty list
        pass
    return files


def scan_directory(directory: str) -> list[str]:
    """Recursively scan a directory for secrets.

    Returns a list of vulnerability strings.
    """
    vulnerabilities: list[str] = []
    root = Path(directory).resolve()
    if not root.exists() or not root.is_dir():
        return [f"[ERROR] Directory not found or not a directory: {directory}"]

    for filepath in root.rglob("*"):
        if filepath.is_file():
            rel = str(filepath.relative_to(root))
            if should_skip(rel):
                continue
            vulnerabilities.extend(scan_file(str(filepath)))
    return vulnerabilities


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Security audit: scan files for leaked secrets."
    )
    parser.add_argument(
        "--directory",
        type=str,
        default=None,
        help="Scan an arbitrary directory recursively instead of git-changed files.",
    )
    args = parser.parse_args()

    all_vulnerabilities: list[str] = []

    if args.directory:
        target = args.directory
        all_vulnerabilities = scan_directory(target)
    else:
        files = get_changed_files()
        if not files:
            print("STATUS: PASSED")
            print("VULNERABILITIES: None (No changes to scan)")
            return 0

        target = "git-changed files"
        for f in files:
            if os.path.isfile(f) and not should_skip(f):
                all_vulnerabilities.extend(scan_file(f))

    if all_vulnerabilities:
        print("STATUS: REJECTED")
        print(f"TARGET: {target}")
        print("VULNERABILITIES:")
        for v in all_vulnerabilities:
            print(f"  - {v}")
        print(f"\nSUMMARY: {len(all_vulnerabilities)} potential secret(s) found.")
        return 1
    else:
        print("STATUS: PASSED")
        print(f"TARGET: {target}")
        print("VULNERABILITIES: None")
        print("\nSUMMARY: No potential secrets detected.")
        return 0


if __name__ == "__main__":
    sys.exit(main())
