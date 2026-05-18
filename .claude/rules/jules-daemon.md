---
description: Jules daemon — start on session load if active sessions exist
paths:
  - "scripts/jules_assign.sh"
  - "scripts/agent-daemon/index.mjs"
  - "docs/stories/**/*.md"
---
## Jules Daemon — Always Running During Active Sessions

At the start of any session where Jules work is in scope, check if the daemon is running:

```bash
DAEMON_PIDFILE="/tmp/jules_daemon.pid"
if [ -f "$DAEMON_PIDFILE" ] && kill -0 "$(cat $DAEMON_PIDFILE)" 2>/dev/null; then
  echo "Jules daemon running (PID $(cat $DAEMON_PIDFILE))"
else
  echo "Jules daemon NOT running — start it"
fi
```

If not running and there are active (unmerged) sessions in `jules.db`, start it:

```bash
node scripts/agent-daemon/index.mjs \
  >> /tmp/agent-daemon.log 2>&1 &
echo $! > /tmp/jules_daemon.pid
```

## What the daemon handles automatically
- **Plan approval** — via `@google/jules-sdk` when state = `awaitingPlanApproval`
- **Course correction** — via `@google/jules-sdk` `session.ask()`
- **PR review** — Claude reviews diff against story ACs + AGENTS.md patterns via Anthropic API
- **Auto-merge** — `gh pr merge --squash` on APPROVE verdict

## Key commands
```bash
node scripts/agent-daemon/index.mjs --status          # show all sessions + review state
node scripts/agent-daemon/index.mjs --once            # single loop cycle (for manual check)
cat /tmp/agent-daemon.log                             # live daemon output
```

## jules_assign.sh already auto-starts the daemon
The dispatch script starts the daemon automatically after each session is registered.
The daemon is idempotent — safe to start multiple times (PID file prevents duplicates).
