---
name: careful
description: Invoke before touching production systems, shared infrastructure, the R620, or any destructive operation. Activates session-scoped blocks on force-push, DROP TABLE, rm -rf, kubectl delete, and git reset --hard for the duration of this session.
---

# /careful — Destructive Operation Guard

Activating guard mode now:

```bash
touch 
```

**Active blocks for this session:**
- `git push --force` / `git push -f`
- `DROP TABLE` / `DROP DATABASE`
- `rm -rf`
- `kubectl delete`
- `git reset --hard`

Guard is enforced via a global PreToolUse hook (`~/.claude/hooks/careful-block.sh`) that checks for the sentinel file above. To deactivate: `rm 

To bypass a specific block intentionally, explicitly state why before running the command and Claude will ask for confirmation first.
