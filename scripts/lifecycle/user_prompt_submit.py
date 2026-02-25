#!/usr/bin/env python3
"""Lifecycle hook: log user prompts for audit trail."""

import json
import sys
from pathlib import Path

data = json.load(sys.stdin)
prompt = data.get("prompt", "")
log_path = Path.home() / ".agentic" / "prompt_log.jsonl"
log_path.parent.mkdir(parents=True, exist_ok=True)
with log_path.open("a") as f:
    json.dump({"ts": data.get("ts", ""), "prompt": prompt[:500]}, f)
    f.write("\n")
print(json.dumps({"continue": True}))
