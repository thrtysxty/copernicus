# Background Services Guide

Copernicus has three background services that can run independently of the IDE window:

| Service | Script | Purpose |
|---|---|---|
| **Jules Daemon** | `scripts/jules_daemon.py` | Polls Jules sessions, reviews PRs via Claude, auto-merges on APPROVE |
| **Flask Backend** | `backend/app.py` | REST API for agent dispatch, story management, model routing |
| **MCP Hub** | `scripts/mcp_hub.py` | Unified MCP server proxy for Claude Code, Cursor, and Continue.dev |

When registered as persistent services, these start automatically at login — no need to run `make dev` before working.

---

## What Are Background Services?

By default, all three services start when you run `make dev` and stop when you quit the IDE. Registering them as persistent background services means:

- Jules sessions continue to poll and merge even with the IDE closed
- The Flask backend is always reachable at `localhost:5001`
- MCP tools are available to other editors (Claude Code, Cursor) without the IDE running

---

## Manual Registration (AC2)

The quickest path — run from the terminal, no IDE required.

**macOS / Linux:**
```bash
bash scripts/install-daemon.sh
```

This registers `jules_daemon.py` as a launchd agent (macOS) or systemd user service (Linux). It starts at login and restarts automatically on failure.

To unregister:
```bash
bash scripts/install-daemon.sh --uninstall
```

**Windows:**
```powershell
powershell -ExecutionPolicy Bypass -File scripts/install-daemon.ps1
```

To unregister:
```powershell
powershell -ExecutionPolicy Bypass -File scripts/install-daemon.ps1 -Uninstall
```

---

## Settings Panel Registration (AC1)

> 📌 **Pending Story 524 merge** — The Settings → Background Services panel is being built. Once shipped, you'll be able to register and unregister services from the IDE's Settings view without touching the terminal.

On first launch of a packaged build, Copernicus offers a one-time toast prompt: _"Register Jules daemon to auto-start background sync? [Register] [Later]"_. Clicking Register runs `install-daemon.sh` / `install-daemon.ps1` automatically.

---

## Verifying Services Are Running (AC3)

**macOS (launchd):**
```bash
launchctl list | grep copernicus
# Should show: com.copernicus.jules-daemon
```

**Linux (systemd):**
```bash
systemctl --user status jules-daemon
# Should show: Active: active (running)
```

**Windows (Task Scheduler):**
```powershell
Get-ScheduledTask -TaskName CopernicusJulesDaemon
# Should show: State: Ready
```

**Logs:**

All three platforms write to `/tmp/jules-daemon.log`:
```bash
tail -f /tmp/jules-daemon.log
```

---

## MCP Hub Client Config (AC4)

> 📌 **Pending Story 527 merge** — The MCP Hub persistent service is coming soon. Once shipped:

```bash
python3 scripts/mcp_hub.py --print-config
```

Copy the output JSON into your `claude_mcp_config.json` (or equivalent for Cursor / Continue.dev). The hub exposes all registered MCP tools through a single endpoint so you don't need per-tool config in every client.

---

## Uninstalling Services (AC5)

**Jules Daemon:**
```bash
bash scripts/install-daemon.sh --uninstall    # macOS / Linux
powershell scripts/install-daemon.ps1 -Uninstall  # Windows
```

**Flask Backend persistent service:**

> 📌 Pending Story 525 — uninstall command TBD.

**MCP Hub:**

> 📌 Pending Story 527 — uninstall command TBD.
