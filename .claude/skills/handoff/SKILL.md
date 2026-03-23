---
name: handoff
description: Prints a context handoff summary to the log.
---

Execute the python script `scripts/utils/handoff.py`.

Pass any arguments provided with the slash command directly to the script.

Data written to `${CLAUDE_PLUGIN_DATA}/handoff/` — this path persists across `/plugin update` and Claude Code restarts.

## Verification
- [ ] Verified: running `/handoff` after the update still produces a log entry in the expected location
