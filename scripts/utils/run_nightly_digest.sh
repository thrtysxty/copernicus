#!/bin/bash

# This script finds all session JSONL files that do not have a corresponding
# _digest.md and runs the session_digest.py script on them to generate digests.

REPO_ROOT="/Users/dadmin/Projects/copernicus"
SESSIONS_DIR="${REPO_ROOT}/docs/sessions"
DIGEST_SCRIPT="${REPO_ROOT}/scripts/utils/session_digest.py"

# Ensure the digest script is executable
chmod +x "$DIGEST_SCRIPT"

# Find all JSONL files in sessions directory and its subdirectories
find "$SESSIONS_DIR" -name "*.jsonl" | while read jsonl_file; do
    base_name="${jsonl_file%.jsonl}"
    digest_file="${base_name}_digest.md"

    if [ ! -f "$digest_file" ]; then
        echo "Generating digest for: $jsonl_file"
        python3 "$DIGEST_SCRIPT" "$jsonl_file"
        if [ $? -ne 0 ]; then
            echo "Error generating digest for $jsonl_file. Continuing to next."
        fi
    else
        echo "Digest already exists for: $jsonl_file. Skipping."
    fi
done

exit 0