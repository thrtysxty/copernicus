---
name: log_success
description: Creates a new success log entry.
---

Execute the python script `scripts/utils/manage_logs.py`.

Pass any arguments provided with the slash command directly to the script.

Data written to `${CLAUDE_PLUGIN_DATA}/logs/` — this path persists across `/plugin update` and Claude Code restarts.

## Verification
- [ ] Verified: running `/log_success` after the update still produces a log entry in the expected location
