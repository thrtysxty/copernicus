#!/usr/bin/env python3
"""
PreToolUse Hook - File Integrity Monitor

This script is called before any tool execution.
It validates 'write_file' operations to prevent:
1. Lazy coding placeholders (e.g., "// ... existing code")
2. Massive file truncation (>40% size reduction)
"""

import os
import re


def validate_write_safety(file_path, new_content):
    # 1. Check for Lazy Placeholders
    lazy_patterns = [
        r"//\s*\.\.\.",  # // ...
        r"#\s*\.\.\.",  # # ...
        r"/\*\s*\.\.\.\s*\*/",  # /* ... */
        r"<!--\s*\.\.\.\s*-->",  # <!-- ... -->
        r"existing code",
        r"rest of the code",
    ]

    for pattern in lazy_patterns:
        if re.search(pattern, new_content, re.IGNORECASE):
            return (
                False,
                f"Rejected: Detected lazy placeholder '{pattern}'. You MUST provide the FULL file content.",
            )

    # 2. Check for Massive Deletion (Safety Threshold)
    if os.path.exists(file_path):
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            existing_content = f.read()

        # Allow small files to fluctuate, but protect large files (>200 chars)
        if len(existing_content) > 200:
            ratio = len(new_content) / len(existing_content)
            if ratio < 0.6:  # New file is less than 60% of original size
                return (
                    False,
                    f"Rejected: Suspicious file truncation detected (Size: {len(existing_content)} -> {len(new_content)}). If this is intentional, delete the file first.",
                )

    return True, ""


# Note: This module is intended to be imported by the ToolExecutor or AgentBridge,
# or run as a standalone script if the architecture supports hook scripts.
# For this implementation, we will integrate the logic into the AgentBridge/ToolExecutor flow.
