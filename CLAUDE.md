# CLAUDE.md
**Project:** COPERNICUS IDE
**Stack:** Python 3.11/Flask, PostgreSQL 16, React 18/TS (Electron), Dell R210ii Core (Docker)
**Context:** Professional multi-agent orchestration platform.
**Tooling:** `claude_mcp_config.json` (Context7 + Lynkr)
**Knowledge Source:** Local Repo (Primary).

## Subagent Policy
**Always launch Sonnet subagents unless specified otherwise.**

## Tool Use Protocol
You have access to tools. To use them, output strict XML tags in your response.

1. **Write File:**
   `<write_file path="src/file.py">code here</write_file>`
2. **Execute Shell Command:**
   `<exec_command>python scripts/test.py</exec_command>`

## Common Commands
```bash
make dev             # Start Backend (5001) + COPERNICUS (3000)
make test            # Run test suite
make deploy          # Push to Dell R210ii Core and restart containers
make db-deploy       # Deploy database schema to Core
make agent           # Terminal 1: Launch Agent (with venv + MCP)
make dashboard       # Terminal 2: Launch Dashboard
```

## Architecture
- **backend/** - Core services and API handlers.
- **copernicus/** - Electron/React IDE frontend.
- **src/agentic/** - Multi-agent orchestration logic and telemetry.
- **docs/stories/** - Feature tracking and industrial pipeline.

## Agent Interaction Commands
- `/story "Title" [--type story|api|component]`: Scaffolds a new user story and optional boilerplate.
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

## IPC Error Handling Standard

Every `ipcMain.handle` registration in `copernicus/electron/main.ts` **must** use the `handleIpc()` wrapper:

```typescript
// ✅ Correct
ipcMain.handle('foo:bar', (_e, arg) => handleIpc(() => someManager.doThing(arg)))

// ❌ Wrong — raw throw arrives at renderer as unreadable Electron error string
ipcMain.handle('foo:bar', (_e, arg) => someManager.doThing(arg))
```

Every renderer component that calls IPC **must** use the `useIpcError` hook, never bare `window.ipcRenderer.invoke`:

```typescript
// ✅ Correct
const invoke = useIpcError()
const result = await invoke<MyType>('foo:bar', arg)

// ❌ Wrong — errors silently swallowed
await window.ipcRenderer.invoke('foo:bar', arg)
```

These are **non-negotiable** for all new code and all stories written going forward.

## Security & Guardrails
- **Pre-commit:** Blocks secrets and runs performance baseline audits.
- **Sentinel:** Autonomous hardening and secret detection.
