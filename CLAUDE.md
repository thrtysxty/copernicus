# CLAUDE.md
**Project:** COPERNICUS IDE
**Stack:** Python 3.11/Flask, PostgreSQL 16, React 18/TS (Electron), Dell R210ii Core (Docker)
**Context:** Professional multi-agent orchestration platform.
**Tooling:** `claude_mcp_config.json` (Context7 + Lynkr)
**Knowledge Source:** Local Repo (Primary).

## Role Boundaries — ENFORCED

Claude's role is **Plan → Delegate → Review**. Not implement.

### What Claude DOES
- Reads and understands the codebase
- Authors stories, identifies bugs, sets AC
- Dispatches implementation to the assigned agent role (coder via `gemini` CLI, autonomous-PR via `jules_assign.sh`)
- Reviews diffs and tsc output on completion notification
- Merges or requests re-work

### What Claude MUST NOT DO
- **Dispatch any story without first running `git log origin/main --oneline --grep="story.NNN"` — if a commit exists, mark it COMPLETE and move on. This has burned tokens twice.**
- Write implementation code for any story that has a delegation path
- Implement a fix inline when a story card can be created and dispatched
- Run `gemini ... &` — use `gemini -p "$(cat /tmp/prompt.md)" --approval-mode yolo` with `run_in_background: true` instead
- Dispatch multiple overlapping stories to Gemini simultaneously if they touch the same files
- Do Gemini's implementation work because it "seems faster"
- Make **any** aesthetic, styling, className, or layout change not explicitly listed in the story ACs — frozen surfaces are frozen, full stop
- Report cloud model audit findings without first verifying them by **reading the actual files** — cloud models hallucinate; never trust agent-reported results
- Commit code without first running `tsc --noEmit` — zero TypeScript errors is a hard gate
- Skip `mcp__ide__getDiagnostics` after any file edit or merge — live LSP diagnostics are mandatory before declaring work done






## Architecture
- **backend/** - Core services and API handlers.
- **copernicus/** - Electron/React IDE frontend.
- **src/agentic/** - Multi-agent orchestration logic and telemetry.
- **docs/stories/** - Feature tracking and industrial pipeline.

## Agent Interaction Commands
- `/story "Title" [--type story|api|component]`: Scaffolds a new user story and optional boilerplate.
- `/rag "<query>"`: Shorthand for semantic search and context injection via the local index.
- `/pi_check`: Runs the Performance Baseline Audit (Raspberry Pi 3B+ constraints).
- `/audit`: Triggers the Sentinel Persona to scan staged changes for secrets.

## Performance Scope — Raspberry Pi 3B+ Rule

The `/pi_check` audit and Pi 3B+ performance baseline apply **only** to:
- `src/agentic/` — Python orchestration CLI tools
- `backend/` — Flask API handlers
- `scripts/` — CLI utilities

**Explicitly exempt** (desktop-only Electron renderer, GPU-accelerated):
- `copernicus/src/renderer/components/workflow/WorkflowCanvas.tsx`
- `copernicus/src/renderer/components/Editor/UICanvas.tsx` and `ui-builder/UIBuilderCanvas.tsx`
- `copernicus/src/renderer/components/capex/` and any reporting/charting components
- Any component using `<canvas>`, WebGL, SVG animation, or `requestAnimationFrame`

Do not apply Pi constraints (bundle size warnings, animation limits, re-render
budgets) to exempted paths. Optimize for desktop UX, not embedded performance.

## Security & Guardrails
- **Pre-commit:** Blocks secrets and runs performance baseline audits.
- **Sentinel:** Autonomous hardening and secret detection.