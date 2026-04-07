# Dead Weight Audit — April 2026

## Confirmed Dead (Safe to Delete)

### Root-Level Files
- `ollama_shim_debug.log` — 87KB debug log from Mar 5; should never be committed
- `jules.db` — Empty 0-byte file (Mar 31); orphaned artifact
- `jules_sessions.db` — Empty 0-byte file (Apr 4); orphaned artifact
- `patch_ledger.sh` — One-line sed script; never called from anywhere
- `patch_schema.sh` — One-line sed script; never called from anywhere
- `plan.md` — Story 566 planning doc; superseded by completed stories

### Dead Scripts
- `scripts/dispatch_claude_ollama.sh` — **DEAD AS OF 2026-03-30** (Ollama credits exhausted). 9 files still reference it.
- `scripts/agent_cli.py` — Imports non-existent `UnifiedAgentBridge`; dead
- `scripts/agent_console.py` — Imports non-existent `UnifiedAgentBridge`; dead
- `scripts/agent_tui.py` — Imports non-existent `UnifiedAgentBridge`; dead (94KB)
- `scripts/agent_gateway.py` — References removed `cloud_agent.py`; exits with error pointing to dead script
- `scripts/agent_context.py` — `dispatch_command()` hardcodes dead `dispatch_claude_ollama.sh`; no active callers
- `scripts/cloud_orchestrator.py` — Pre-Jules era stub; replaced by `jules_assign.sh`
- `scripts/copernicus_assign.sh` — Thin wrapper; superseded by `jules_assign.sh`
- `scripts/ollama_coder.py` — "Drop-in replacement for dispatch_claude_ollama.sh" — never called
- `scripts/ollama_tool_shim.py` — 14KB shim; never integrated into active dispatch
- `scripts/ollama_ask.sh` — Local Ollama helper; dispatch path is dead
- `scripts/setup_ollama_personas.sh` — Ollama setup; credits exhausted
- `scripts/setup_ollama_server.sh` — Docker Ollama setup; credentials exhausted
- `scripts/migrate_platform_assets.sh` — One-time asset migration (Feb 25); never called
- `scripts/backfill_episodes.py` — Obsolete API migration helper; no active references
- `scripts/retrieve_episodes.py` — Obsolete API query script; no active references
- `scripts/repo_intelligence.py` — Replaced by `generate_repo_index.py`; no callers
- `scripts/devtime_manager.py` — Last modified Mar 8; no active callers
- `scripts/workflow_manager.py` — Last modified Mar 8; no active callers
- `scripts/cloud_orchestrator.py` — Pre-Jules era; replaced
- `scripts/select_agent.py` — No callers in Makefile or dispatch flow
- `scripts/story.py` — Story templating; no active callers
- `scripts/lifecycle/post_tool_use.py` — 0 bytes (empty placeholder)
- `scripts/lifecycle/session_start.py` — 0 bytes (empty placeholder)

## Likely Dead (Needs Quick Verification)

- `requirements-stack.txt` — Root-level, 356 bytes; duplicate of `backend/requirements.txt`? Check if CI uses it.
- `gemini.md` — Still references `dispatch_claude_ollama.sh` as valid dispatch. Content is stale.
- `repo_index.json` — 87KB snapshot from Mar 15; project name still `agentic-platform`. Check if actively regenerated.
- `.agent-worktrees/` — story-571, 572, 573, 600, 601, 613, test-gemma4-local. Verify merged/closed.
- `dev_orchestrator/worktrees/` — ~40 nested worktrees from pre-Jules era (Feb-Mar). Appears abandoned.

## Stale References (Update in Place)

- `scripts/agent_context.py:57-60` — `dispatch_command()` calls dead `dispatch_claude_ollama.sh`
- `gemini.md:70-77` — "Sub-Delegation" section references dead `dispatch_claude_ollama.sh` as valid
- `repo_index.json:2` — `"project_name": "agentic-platform"` should be `"copernicus"`
- `docs/planning/agentic platform/` — Directory name has space; pre-rename artifact (contains 32+ stale model eval files)

## Gitignore Gaps

- `ollama_shim_debug.log` — Not covered; add `*_debug.log`
- `jules.db` / `jules_sessions.db` — Listed in .gitignore but still tracked; need `git rm --cached`

## Keep (And Why)

- `scripts/jules_assign.sh` — Primary story dispatch; actively used
- `scripts/jules-preflight.sh` — Jules env validation; used in Makefile
- `scripts/story-validator.sh` — Story spec validation; Makefile target
- `scripts/ipc-lint.sh` — IPC compliance checker; Makefile target
- `scripts/mcp_hub.py` — MCP coordinator (verify still active)
- `scripts/generate_repo_index.py` — Generates repo_index.json (verify if run in build)
- `copernicus/electron/ipc/stitch-handlers.ts` — Stitch MCP is active (stories 542, 543, 563)
- `AGENTS.md`, `CLAUDE.md`, `gemini.md` (structure only) — Actively enforced contracts
- `docker-compose.ollama.yml` — Keep for local Ollama testing reference

## Recommended .gitignore Additions

```
*_debug.log
jules.db
jules_sessions.db
```

## Summary

| Category | Count |
|----------|-------|
| Confirmed dead files | 30+ |
| Dead scripts | 23 |
| Stale doc directories | 2 |
| Root orphaned files | 6 |
| Worktree dirs to clean | 2 |
