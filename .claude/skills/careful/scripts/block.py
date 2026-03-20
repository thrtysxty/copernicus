#!/usr/bin/env python3
"""PreToolUse hook for /careful — blocks destructive bash commands."""
import json, sys, re

try:
    inp = json.load(sys.stdin)
except Exception:
    sys.exit(0)

# Hook input is {"tool_name": "Bash", "tool_input": {"command": "..."}}
cmd = ""
if isinstance(inp, dict):
    tool_input = inp.get("tool_input", inp)  # fallback to top-level for compat
    cmd = tool_input.get("command", "")

BLOCKED = [
    (r"git\s+push\s+.*--force|git\s+push\s+.*\s-f\b", "force-push blocked in /careful mode"),
    (r"\bDROP\s+TABLE\b|\bDROP\s+DATABASE\b",           "DROP TABLE/DATABASE blocked in /careful mode"),
    (r"rm\s+-[a-z]*r[a-z]*f\b|rm\s+-[a-z]*f[a-z]*r\b", "rm -rf blocked in /careful mode"),
    (r"\bkubectl\s+delete\b",                            "kubectl delete blocked in /careful mode"),
    (r"git\s+reset\s+--hard",                            "git reset --hard blocked in /careful mode"),
]

for pattern, msg in BLOCKED:
    if re.search(pattern, cmd, re.IGNORECASE):
        print(msg, file=sys.stderr)
        sys.exit(2)

sys.exit(0)
