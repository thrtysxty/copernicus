---
description: Jules daemon — start on session load if active sessions exist
paths:
  - "scripts/jules_assign.sh"
  - "scripts/jules_daemon.py"
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
nohup python3 /Users/dadmin/Projects/copernicus/scripts/jules_daemon.py \
  >> /tmp/jules_daemon.log 2>&1 &
echo $! > /tmp/jules_daemon.pid
```

## What the daemon handles automatically
- **Plan approval** — `POST /v1alpha/sessions/{id}:approvePlan` when state = `AWAITING_PLAN_APPROVAL`
- **Course correction** — `POST /v1alpha/sessions/{id}:sendMessage` to steer Jules mid-task
- **PR review** — Claude (claude-sonnet-4-6) reviews diff against story ACs + AGENTS.md patterns
- **Auto-merge** — `gh pr merge --squash` on APPROVE verdict

## Key commands
```bash
python3 scripts/jules_daemon.py --status          # show all sessions + review state
python3 scripts/jules_daemon.py --once            # single poll cycle (for manual check)
python3 scripts/jules_daemon.py --skip-review     # emergency bypass
cat /tmp/jules_daemon.log                         # live daemon output
```

## jules_assign.sh already auto-starts the daemon
The dispatch script starts the daemon automatically after each session is registered.
The daemon is idempotent — safe to start multiple times (PID file prevents duplicates).
