agentic-platform SDK — Consumer Project Guide
═══════════════════════════════════════════════

## What You Copy Once (bootstrap)

From agentic-platform, copy these into your new project:

  scripts/lifecycle/pre_tool_use.py       ← customize block list
  scripts/lifecycle/post_tool_use.py      ← customize log target
  scripts/lifecycle/session_start.py      ← customize project name
  scripts/lifecycle/subagent_start.py     ← usually unchanged
  scripts/lifecycle/subagent_stop.py      ← usually unchanged
  scripts/lifecycle/user_prompt_submit.py ← usually unchanged

These are OWNED by the consumer project after copying.
Changes to agentic-platform's versions do not propagate automatically.

## What You Use In-Place (shared DB path)

  ~/.copernicus/devtime.db   — CapEx session ledger
                         Written by: DevTimeManager (TUI), log_session.py (CLI)
                         Read by: log_session.py --report, any SQL client

## What You Do NOT Copy

  src/agentic/telemetry.py   — import from agentic-platform if needed,
                                or replicate the ~50-line class; it has no
                                external dependencies
  scripts/agent_tui.py       — run from agentic-platform directly; don't fork

## New Project Bootstrap Checklist

  [ ] Copy lifecycle scripts → scripts/lifecycle/
  [ ] Customize pre_tool_use.py block list for your project
  [ ] Add .claude/hooks entries in settings pointing to scripts/lifecycle/
  [ ] Confirm ~/.copernicus/devtime.db exists (run TUI once to create it)
  [ ] Confirm first CORE session entry exists before writing CORE code
