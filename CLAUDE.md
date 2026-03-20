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
- Make **any** aesthetic, styling, className, or layout change not explicitly listed in the story ACs — frozen surfaces are frozen, full stop
- Report cloud model audit findings without first verifying them by **reading the actual files** — cloud models hallucinate; never trust agent-reported results
- Commit code without first running `tsc --noEmit` — zero TypeScript errors is a hard gate

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

> **All scripts run from repo root `/Users/dadmin/Projects/agentic-platform/` — never from inside `copernicus/`.**

1. **Cloud Agent — primary implementation tool (25-turn agentic tool loop, reads/writes files directly):**
   ```bash
   python3 dev_orchestrator/cloud_agent.py <role> "<prompt>" [--worktree <branch_name>]
   ```
   **CRITICAL:** Always use `--worktree <branch_name>` when the subagent drafts or modifies code.
   Can be used for ANY task — does not require Jules or Gemini to resolve first.

   | Role | Model | Use for |
   |------|-------|---------|
   | `coder` | devstral-2:123b-cloud | Multi-file implementation, TS/React |
   | `thinker` | deepseek-v3.1:671b-cloud | Reasoning, planning, architecture |
   | `researcher` | deepseek-v3.1:671b-cloud | Investigation, analysis |
   | `architect` | nemotron-3-super:cloud | System design, schema |
   | `fast` | gpt-oss:20b-cloud | Quick lookups, one-shot questions |
   | `vision` | qwen3-vl:235b-cloud | Screenshot/image analysis |
   | `large` | mistral-large-3:675b-cloud | Complex multi-file reasoning |

2. **Jules — isolated TypeScript/React stories (async PR, zero Claude tokens):**
   ```bash
   bash scripts/jules_assign.sh docs/stories/story_NNN_*.md
   # Optional persona overlay: --as bolt|palette|sentinel
   ```
   Use for single-concern TS/React stories. Story must be `APPROVED FOR IMPLEMENTATION`.
   Stories must have `Blocks:` and `Blocked By:` headers **with colons** or validation fails.
   If files only exist on a feature branch, push the branch first so Jules can fetch it.

3. **Gemini — multi-file implementation + session management:**
   ```bash
   python3 dev_orchestrator/gemini_session_manager.py spawn --prompt-file /tmp/gemini_prompt.md --stories NNN --direct
   ```
   Always use `--direct` — prevents sub-delegation shim loop.
   Write prompt to `/tmp/gemini_prompt.md` first, then launch via osascript terminal tab.

- `scripts/claude_ollama_cli.py` **does not exist** — never call it.
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

## Repo Intelligence — Low-Token Code Awareness

Before reading full files, use these to understand structure cheaply:

```bash
# Exports/signatures only — no bodies (~5 tokens/symbol vs full file)
python3 scripts/repo_intelligence.py outline <file>

# Import chain — what does this file depend on?
python3 scripts/repo_intelligence.py imports <file> [--depth 2]

# All references to a symbol across ts,tsx,py
python3 scripts/repo_intelligence.py usages <symbol>

# What changed vs HEAD (or any ref)
python3 scripts/repo_intelligence.py changed [--base main]
```

Use `outline` before dispatching any story that touches a file you haven't read this session.
Use `imports` before editing shared utilities to understand blast radius.
Use `usages` instead of grepping manually for a symbol.

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

<!-- codebase-memory-mcp:start -->
# codebase-memory-mcp — Code Intelligence

This project is indexed by codebase-memory-mcp v0.5.4 (MIT, DeusData). Single static binary, 64-language tree-sitter, SQLite persistence at `~/.cache/codebase-memory-mcp/`, sub-millisecond queries. Project key: `Users-dadmin-Projects-agentic-platform`.

> If the MCP server is not responding, re-index: `codebase-memory-mcp cli index_repository '{"repo_path":"/Users/dadmin/Projects/agentic-platform","name":"agentic-platform"}'`

## Always Do

- **MUST run blast-radius analysis before editing any symbol.** Before modifying a function, class, or method, run `trace_call_path` (direction: `inbound`) and report direct callers and risk to the user.
- **MUST run `detect_changes` before committing** to verify changes only affect expected symbols.
- **MUST warn the user** if blast radius returns more than 5 direct callers before proceeding.
- When exploring unfamiliar code, use `search_graph` to find symbols by name/pattern — faster and more precise than grepping.
- For full context on a symbol (callers, callees, imports), use `get_code_snippet` + `trace_call_path`.

## When Debugging

1. `search_graph` — find symbols related to the error by name or pattern
2. `trace_call_path` (direction: `both`, depth: 2) — see all callers and callees
3. `get_architecture` (aspects: `["overview","hotspots"]`) — check structural context and hotspots
4. `detect_changes` — see what your branch changed vs main

## When Refactoring

- **Before editing:** `trace_call_path` (inbound, depth: 2) — find all callers
- **Before committing:** `detect_changes` to verify only expected files changed
- **For renames:** use `search_graph` to find all uses, then update manually (no rename tool — story 449 filed)
- **For extractions:** `trace_call_path` (outbound) to find all callees before moving code

## Never Do

- NEVER edit a function or class without first running `trace_call_path` (inbound) on it.
- NEVER ignore blast-radius results with more than 5 direct callers without user confirmation.
- NEVER commit without running `detect_changes` to check affected scope.

## Tool Quick Reference

| Tool | When to use |
|------|-------------|
| `search_graph` | Find symbols by name/pattern |
| `trace_call_path` | Caller/callee traversal, blast radius |
| `detect_changes` | Pre-commit scope check (git diff → symbols) |
| `query_graph` | Custom Cypher-like graph queries |
| `get_code_snippet` | Retrieve code by qualified symbol name |
| `get_architecture` | Codebase overview, hotspots, entry points |
| `search_code` | Full-text search within indexed source files |
| `index_repository` | Trigger re-index after large changes |

## Self-Check Before Finishing

Before completing any code modification task, verify:
1. `trace_call_path` (inbound) was run for all modified symbols
2. No high blast-radius warnings were ignored
3. `detect_changes` confirms changes match expected scope

## CLI

- Re-index: `codebase-memory-mcp cli index_repository '{"repo_path":"/Users/dadmin/Projects/agentic-platform","name":"agentic-platform"}'`
- Check status: `codebase-memory-mcp cli index_status '{"project":"Users-dadmin-Projects-agentic-platform"}'`
- Architecture: `codebase-memory-mcp cli get_architecture '{"project":"Users-dadmin-Projects-agentic-platform","aspects":["overview"]}'`

<!-- codebase-memory-mcp:end -->
