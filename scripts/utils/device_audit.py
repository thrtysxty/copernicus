#!/usr/bin/env python3
import logging
logger = logging.getLogger(__name__)
import ast
import os
import sys

VIOLATIONS = []


class PiConstraintVisitor(ast.NodeVisitor):
    def __init__(self, filename, source_lines):
        self.filename = filename
        self.source_lines = source_lines

    def is_exempt(self, lineno):
        if lineno < 1 or lineno > len(self.source_lines):
            return False
        return "# nosec" in self.source_lines[lineno - 1]

    def visit_Import(self, node):
        if not self.is_exempt(node.lineno):
            for alias in node.names:
                if alias.name == "pandas":
                    VIOLATIONS.append(
                        f"{self.filename}:{node.lineno} - ⚠️  High Memory: Pandas imported. Ensure chunksize is used."
                    )
        self.generic_visit(node)

    def visit_Call(self, node):
        if not self.is_exempt(node.lineno):
            # Check for list() on large ranges or queries
            if isinstance(node.func, ast.Name) and node.func.id == "list":
                VIOLATIONS.append(
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
    except Exception:
        logger.error("Unexpected error", exc_info=True)  # Skip non-python or unparseable files


def main():
    print("🍓 Running Raspberry Pi 3B+ Constraint Check...")

    # Walk src/ and scripts/
    for root, _, files in os.walk("."):
        if "venv" in root or ".git" in root:
            continue
        for file in files:
            if file.endswith(".py"):
                check_file(os.path.join(root, file))

    if VIOLATIONS:
        print(f"\n❌ Found {len(VIOLATIONS)} potential constraints violations:")
        for v in VIOLATIONS:
            print(v)
        sys.exit(1)
    else:
        print("✅ No obvious Pi constraints violated.")


if __name__ == "__main__":
    main()
