#!/usr/bin/env python3
import logging
logger = logging.getLogger(__name__)
import ast
import os
import sys
from concurrent.futures import ThreadPoolExecutor

class PiConstraintVisitor(ast.NodeVisitor):
    def __init__(self, filename, source_lines):
        self.filename = filename
        self.source_lines = source_lines
        self.violations = []

    def is_exempt(self, lineno):
        if lineno < 1 or lineno > len(self.source_lines):
            return False
        return "# nosec" in self.source_lines[lineno - 1]

    def visit_Import(self, node):
        if not self.is_exempt(node.lineno):
            for alias in node.names:
                if alias.name == "pandas":
                    self.violations.append(
                        f"{self.filename}:{node.lineno} - ⚠️  High Memory: Pandas imported. Ensure chunksize is used."
                    )
        self.generic_visit(node)

    def visit_Call(self, node):
        if not self.is_exempt(node.lineno):
            # Check for list() on large ranges or queries
            if isinstance(node.func, ast.Name) and node.func.id == "list":
                self.violations.append(
                    f"{self.filename}:{node.lineno} - ℹ️  Memory Warning: Explicit list() conversion. Prefer generators."
                )
        self.generic_visit(node)


def check_file(filepath):
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            source = f.read()
            tree = ast.parse(source, filename=filepath)
            source_lines = source.splitlines()
        visitor = PiConstraintVisitor(filepath, source_lines)
        visitor.visit(tree)
        return visitor.violations
    except Exception:
        logger.error("Unexpected error", exc_info=True)  # Skip non-python or unparseable files
        return []


def main():
    print("🍓 Running Raspberry Pi 3B+ Constraint Check...")

    files_to_check = []
    # Walk src/ and scripts/
    for root, _, files in os.walk("."):
        if "venv" in root or ".git" in root:
            continue
        for file in files:
            if file.endswith(".py"):
                files_to_check.append(os.path.join(root, file))

    all_violations = []
    with ThreadPoolExecutor() as executor:
        results = executor.map(check_file, files_to_check)
        for violations in results:
            all_violations.extend(violations)

    if all_violations:
        print(f"\n❌ Found {len(all_violations)} potential constraints violations:")
        for v in all_violations:
            print(v)
        sys.exit(1)
    else:
        print("✅ No obvious Pi constraints violated.")


if __name__ == "__main__":
    main()
