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
- Dispatches implementation to Gemini via `gemini_session_manager.py`
- Reviews diffs and tsc output on completion notification
- Merges or requests re-work

### What Claude MUST NOT DO
- Write implementation code for any story that has a delegation path
- Implement a fix inline when a story card can be created and dispatched
- Run `gemini ... &` — use `gemini_session_manager.py spawn` instead
- Dispatch multiple overlapping stories to Gemini simultaneously if they touch the same files
- Do Gemini's implementation work because it "seems faster"

### Dispatch Protocol
```bash
# ALWAYS use the session manager — never bare gemini spawn
python3 dev_orchestrator/gemini_session_manager.py spawn "$(cat /tmp/prompt.md)" --stories NNN
# run_in_background: true on the Bash tool — no & needed
```
Claude returns tokens to the user. When the task notification fires, Claude reviews.
**Cost of doing Gemini's work yourself: ~$40 in wasted tokens. Cost of delegating: $0.**

---

## Subagent Policy
**Always launch Sonnet subagents unless specified otherwise. Use the local Ollama RAG bridge for repository research to preserve tokens.**
- Use `scripts/claude_ollama_cli.py "/persona <prompt>"` to route to local Ollama personas:
  - `/architect` (Gemma 3 12B): High-intel local architectural decisions.
  - `/senior-dev` (GLM 4.7 9B): Strong local coding and logic.
  - `/scribe` (Kimi Cloud): Documentation/Summarization.
  - `/researcher` (DeepSeek-R1 Local): Reasoning/Bug tracing.
  - `/sentinel` (Mistral-v0.2): Fast local security audits.
- **High-Intel / Experimental Drafting:** Use `dev_orchestrator/cloud_agent.py` — the canonical cloud dispatch tool — to delegate planning, complex coding, or vision tasks to high-parameter cloud models.
  - `python3 dev_orchestrator/cloud_agent.py <role> "<prompt>" [--worktree <branch_name>]`
  - Roles available: `thinker` (Kimi), `coder` (Qwen3-Coder), `vision` (Qwen3-VL), `researcher` (DeepSeek-V3), `fast` (Gemini-Flash).
  - Full model registry: `dev_orchestrator/models.json` (14 cloud models with `:cloud` suffix).
  - **CRITICAL:** ALWAYS use `--worktree <branch_name>` when the subagent needs to draft or modify code, to ensure its workspace is safely isolated from the main branch.

## Tool Use Protocol
You have access to tools. To use them, output strict XML tags in your response.

1. **Write File:**
   `<write_file path="src/file.py">code here</write_file>`
2. **Execute Shell Command:**
   `<exec_command>python scripts/test.py</exec_command>`
3. **Local RAG & Research (Subagent):**
   - `<exec_command>python3 scripts/claude_ollama_cli.py "/persona <prompt>"</exec_command>`
4. **Development Orchestrator (Cloud Dispatch):**
   `<exec_command>python3 dev_orchestrator/cloud_agent.py coder "Refactor IPC" --worktree feature-refactor</exec_command>`

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
- `/research "<query>"`: Directs the agent to call `python3 scripts/claude_ollama_cli.py "/senior-dev <query>"` for local RAG.
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

## IPC Error Handling Standard

There is exactly **one canonical version** of `handleIpc` (located in `copernicus/electron/main.ts` or a shared utility). Do NOT create a second implementation.

Every `ipcMain.handle` registration in `copernicus/electron/main.ts` **must** use the `handleIpc()` wrapper:

```typescript
// ✅ Correct
ipcMain.handle('foo:bar', (_e, arg) => handleIpc(() => someManager.doThing(arg)))

// ❌ Wrong — raw throw arrives at renderer as unreadable Electron error string
ipcMain.handle('foo:bar', (_e, arg) => someManager.doThing(arg))
```

Every renderer component that calls IPC **must** use the `useIpcError` hook, never bare `window.ipcRenderer.invoke`, and must unwrap data using `unwrapIpc`:

```typescript
// ✅ Correct
import { unwrapIpc } from '../../types/ipc'
const invoke = useIpcError()
const result = await invoke<MyType>('foo:bar', arg)
const data = unwrapIpc<MyType>(result)

// ❌ Wrong — errors silently swallowed or fragile manual unwrapping
await window.ipcRenderer.invoke('foo:bar', arg)
const badData = (result as any)?.data ?? result
```

These are **non-negotiable** for all new code and all stories written going forward.

## Security & Guardrails
- **Pre-commit:** Blocks secrets and runs performance baseline audits.
- **Sentinel:** Autonomous hardening and secret detection.
