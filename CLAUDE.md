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

### UI Story Dispatch — Design Preservation Header

Every prompt dispatched to Gemini or Jules that touches any `.tsx`/`.jsx` file
**MUST** begin with the following block verbatim (fill in the frozen list from
the story's `## Frozen Surfaces` section):

```
DO NOT run any git commands. Do NOT git add, git commit, or git push. Leave changes uncommitted.

## DESIGN PRESERVATION — READ THIS BEFORE ANY CODE

This story modifies existing UI components. The following rules are NON-NEGOTIABLE:

1. Read the FULL current file before writing any code.
2. Every line NOT listed in the story ACs is FROZEN. Copy it exactly — no class
   changes, no reformatting, no wrapper div changes, no prop changes.
3. className strings are atomic. Never remove a class. Append only.
4. Layout structure (flex containers, padding, borders) is frozen unless an AC
   explicitly changes it.

Frozen surfaces for this story (must be preserved character-for-character):
- [list from story ## Frozen Surfaces section]

Violation of any rule above is a blocking defect. Do not proceed until you have
read every in-scope file in full.
```

### Dispatch Protocol
```bash
# Step 1 — write prompt to file
cat > /tmp/gemini_prompt.md << 'EOF'
<prompt content>
EOF

# Step 2 — write launcher script
cat > /tmp/gemini_launch.sh << 'LAUNCH'
#!/bin/zsh
cd /Users/dadmin/Projects/agentic-platform
python3 dev_orchestrator/gemini_session_manager.py spawn --prompt-file /tmp/gemini_prompt.md --stories NNN
LAUNCH
chmod +x /tmp/gemini_launch.sh

# Step 3 — open terminal tabs (one per session; slots A/B/C for parallel)
# Single:   /tmp/gemini_launch.sh   → "Gemini: Run Session" task
# Parallel B: /tmp/gemini_launch_b.sh → "Gemini: Run Session B"
# Parallel C: /tmp/gemini_launch_c.sh → "Gemini: Run Session C"
osascript << 'APPLESCRIPT'
tell application "Visual Studio Code"
  activate
end tell
delay 0.5
tell application "System Events"
  tell process "Code"
    keystroke "`" using {control down, shift down}
    delay 1.5
    keystroke "/tmp/gemini_launch.sh"
    delay 0.3
    key code 36
  end tell
end tell
APPLESCRIPT
```
A **"Gemini Session"** terminal panel opens in VS Code and **closes automatically on completion**. Claude returns tokens to the user. When the task finishes, Claude reviews `git diff HEAD~1`.
**Cost of doing Gemini's work yourself: ~$40 in wasted tokens. Cost of delegating: $0.**

> Always trigger the VS Code task on dispatch. Never run Gemini silently.
> Jules dispatch: same pattern — write `/tmp/jules_launch.sh`, trigger **"Jules: Run Session"** task.
> Parallel dispatch: write to `gemini_launch_b.sh` / `gemini_launch_c.sh`, trigger Session B / Session C tasks.

---

## Subagent Policy
**Delegate early and often — every task Claude handles directly costs tokens. Gemini orchestrates cloud models; Claude plans, delegates, and reviews.**

### Delegate Selection (in priority order)

1. **Jules — self-contained implementation stories (async PR, zero Claude tokens):**
   ```bash
   bash scripts/jules_assign.sh docs/stories/story_NNN_*.md
   # Optional persona overlay: --as bolt|palette|sentinel
   ```
   Use for TypeScript/React stories. Story must be `APPROVED FOR IMPLEMENTATION`.

2. **Gemini — multi-file implementation + cloud model orchestration (zero Claude tokens):**
   ```bash
   python3 dev_orchestrator/gemini_session_manager.py spawn "$(cat /tmp/prompt.md)" --stories NNN
   ```
   Gemini manages cloud sub-agents internally and hands results back to Claude for review.

3. **Local Ollama — quick lookups, RAG, security scans (zero cost, fast):**
   ```bash
   python3 scripts/claude_ollama_cli.py "/persona <prompt>"
   ```
   Personas: `/architect` (Gemma 3 12B), `/senior-dev` (GLM 4.7 9B), `/scribe` (Kimi), `/researcher` (DeepSeek-R1), `/sentinel` (Mistral-v0.2).

4. **Cloud Dispatch — only when Gemini is not available and local cannot handle it:**
   ```bash
   python3 dev_orchestrator/cloud_agent.py <role> "<prompt>" [--worktree <branch_name>]
   ```
   Roles: `thinker` (Kimi), `coder` (Qwen3-Coder), `vision` (Qwen3-VL), `researcher` (DeepSeek-V3), `fast` (Gemini-Flash).
   **CRITICAL:** Always use `--worktree <branch_name>` when the subagent drafts or modifies code.

- Always use the most token-efficient subagent capable of the task.

## Context Discipline — Token Efficiency

**Goal: minimize tokens Claude processes directly. Apply on every session.**

### Prompt Construction
- **Be direct:** Start with the imperative. "Summarize:" not "Could you please summarize..."
- **Use delimiters:** Separate instructions from content with `###` or `---`. No wordy transitions.
- **Limit output:** Specify length explicitly — "3-bullet list", "under 50 words", "one-line diff". Models respect hard constraints.
- **Skeletonize dispatch prompts:** Send interfaces, function signatures, and the target block — not full files. A 50-line skeleton beats a 1,000-line file in every dispatch.
- **Active scope only:** Reference only files listed in the story scope. Never attach build artifacts or files outside story scope.

### History Management
- **Checkpoint every ~15 turns:** Run `/handoff` to compress session state into a ≤200-token summary. Open a fresh session with that summary — lose the fluff, keep the engineering state.
- **Sliding window:** When re-dispatching to Gemini/Jules, include only the last 3 exchanges + a short summary of earlier context. Not the full history.
- **Strip fluff:** Before a handoff, remove "Thank you", "Got it", and other non-functional turns. Every word sent is a token charged.
- **Diff-only review:** On Gemini/Jules completion, read `git diff HEAD~1` — not full files. Claude reviews the change, not the context it already knows.

### Technical Controls (for cloud_agent.py and LLMService calls)
- **max_tokens:** Set a hard output cap on every cloud dispatch. Prevents rambling after the answer is complete.
- **stop_sequences:** Use `\n\n` or a sentinel like `[[DONE]]` to halt generation at the right point.
- **Router pattern:** Use `fast` (Gemini-Flash) or local Ollama for parsing, searching, and classifying. Reserve heavy models for planning and complex reasoning only.
- **RAG limits:** Cap local Ollama at 3–5 high-relevance snippets per query. More is diminishing return + bloat.

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

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **agentic-platform** (30871 symbols, 63402 relationships, 257 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> If any GitNexus tool warns the index is stale, run `npx gitnexus analyze` in terminal first.

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `gitnexus_impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `gitnexus_detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `gitnexus_query({query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `gitnexus_context({name: "symbolName"})`.

## When Debugging

1. `gitnexus_query({query: "<error or symptom>"})` — find execution flows related to the issue
2. `gitnexus_context({name: "<suspect function>"})` — see all callers, callees, and process participation
3. `READ gitnexus://repo/agentic-platform/process/{processName}` — trace the full execution flow step by step
4. For regressions: `gitnexus_detect_changes({scope: "compare", base_ref: "main"})` — see what your branch changed

## When Refactoring

- **Renaming**: MUST use `gitnexus_rename({symbol_name: "old", new_name: "new", dry_run: true})` first. Review the preview — graph edits are safe, text_search edits need manual review. Then run with `dry_run: false`.
- **Extracting/Splitting**: MUST run `gitnexus_context({name: "target"})` to see all incoming/outgoing refs, then `gitnexus_impact({target: "target", direction: "upstream"})` to find all external callers before moving code.
- After any refactor: run `gitnexus_detect_changes({scope: "all"})` to verify only expected files changed.

## Never Do

- NEVER edit a function, class, or method without first running `gitnexus_impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `gitnexus_rename` which understands the call graph.
- NEVER commit changes without running `gitnexus_detect_changes()` to check affected scope.

## Tools Quick Reference

| Tool | When to use | Command |
|------|-------------|---------|
| `query` | Find code by concept | `gitnexus_query({query: "auth validation"})` |
| `context` | 360-degree view of one symbol | `gitnexus_context({name: "validateUser"})` |
| `impact` | Blast radius before editing | `gitnexus_impact({target: "X", direction: "upstream"})` |
| `detect_changes` | Pre-commit scope check | `gitnexus_detect_changes({scope: "staged"})` |
| `rename` | Safe multi-file rename | `gitnexus_rename({symbol_name: "old", new_name: "new", dry_run: true})` |
| `cypher` | Custom graph queries | `gitnexus_cypher({query: "MATCH ..."})` |

## Impact Risk Levels

| Depth | Meaning | Action |
|-------|---------|--------|
| d=1 | WILL BREAK — direct callers/importers | MUST update these |
| d=2 | LIKELY AFFECTED — indirect deps | Should test |
| d=3 | MAY NEED TESTING — transitive | Test if critical path |

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/agentic-platform/context` | Codebase overview, check index freshness |
| `gitnexus://repo/agentic-platform/clusters` | All functional areas |
| `gitnexus://repo/agentic-platform/processes` | All execution flows |
| `gitnexus://repo/agentic-platform/process/{name}` | Step-by-step execution trace |

## Self-Check Before Finishing

Before completing any code modification task, verify:
1. `gitnexus_impact` was run for all modified symbols
2. No HIGH/CRITICAL risk warnings were ignored
3. `gitnexus_detect_changes()` confirms changes match expected scope
4. All d=1 (WILL BREAK) dependents were updated

## CLI

- Re-index: `npx gitnexus analyze`
- Check freshness: `npx gitnexus status`
- Generate docs: `npx gitnexus wiki`

<!-- gitnexus:end -->
