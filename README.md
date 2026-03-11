# COPERNICUS IDE

**An agentic development environment where Claude, Gemini, and Jules work as peers on your engineering team.**

Not a chat wrapper. Not a code-completion plugin. A full IDE — Monaco editor, integrated PTY terminal, Kanban project management, semantic codebase search, financial telemetry, workflow automation — built from the ground up for the reality that LLM agents are now capable engineering contributors when given structure, context, and accountability.

You write stories. Agents implement them. Copernicus tracks cost, quality, and velocity — and learns from every sprint.

---

## Why Copernicus Exists

Every current LLM coding tool has the same problem: the agent gets context from you, makes a guess, and disappears. You have no idea what it cost, whether it broke anything, or how to route the next task to a better model.

Copernicus solves this with three principles:

**Plan → Delegate → Review.** The architect (you, or Claude) defines acceptance criteria. The implementer (Gemini, Jules, or a workflow) executes. The reviewer verifies the diff, runs tsc, and approves or requests rework — all inside the IDE.

**Every decision is accountable.** Every LLM call is logged with model, provider, tokens, cost, latency, and the panel that triggered it. The CapEx dashboard shows you exactly where money went and what it produced.

**The system learns.** The Release Retrospective workflow extracts learnings from each sprint — what worked, what failed, what routing decisions to reinforce — and writes them back to `AGENTS.md` and the project memory table. The next sprint starts smarter.

---

## Agent Roster

### Orchestration Agents

| Agent | How it runs | Primary use |
|-------|-------------|-------------|
| **Claude** | Anthropic streaming API, in-process | Architecture, review, chat, context Q&A |
| **Gemini CLI** | PTY session via `node-pty`, `--direct` mode | Multi-file implementation, LSP-fed diagnostics, parallel sprints |
| **Jules** | REST API → GitHub branch + PR (async) | Story implementation at scale, PR creation |

### Inference Providers

Any workflow node, chat panel, or agent persona can be routed to any of these:

| Provider | Models | Notes |
|----------|--------|-------|
| **Anthropic** | Claude 3.5 Sonnet, Claude 3 Opus, Claude 3 Sonnet | Vision support on all claude-3 variants |
| **OpenAI** | GPT-4o, GPT-4 Turbo, GPT-3.5 Turbo | Vision support on GPT-4o |
| **Google** | Gemini 1.5 Pro, Gemini 1.5 Flash | Vision support on both |
| **OpenRouter** | Gemini Pro, Mistral 7B, + any model on the OpenRouter catalogue | Single key, 200+ models |
| **DeepInfra** | Llama 2 70B, + hosted open-source models | Cost-efficient open-weight inference |
| **Ollama** | Any locally installed model — `qwen3-embedding:0.6b`, Gemma, Mistral, DeepSeek… | Zero cloud cost, fully offline |

Agents are not hardcoded to roles. Any node in the workflow engine can be wired to any provider + model + persona combination. The routing is yours to define.

---

## Features

### Semantic Codebase Intelligence

Copernicus indexes your entire workspace and keeps it current:

- **LSP-symbol-aware chunking** — `typescript-language-server` provides function and class boundaries; the indexer uses these as natural chunk boundaries rather than arbitrary character splits. Falls back to 1000-char chunks with 200-char overlap for non-TypeScript files.
- **768-dimensional embeddings** stored in `sqlite-vec` virtual tables — the same database as everything else, no external vector store
- **Embedding provider waterfall**: Ollama (`qwen3-embedding:0.6b`) → Google (`text-embedding-004`) → OpenAI (`text-embedding-3-small`). Uses whatever you have configured. Works fully offline if Ollama is running.
- **Incremental re-indexing** — chokidar watches for file changes; only modified files are re-chunked and re-embedded
- **Hybrid search** — vector similarity + symbol name boosting; results ranked by relevance + recency
- **Status bar indicator** — live indexing progress (`Indexing [ollama]… 47/312`) visible in the footer

### Multi-Provider Model Routing

Seven provider types, unified interface:

```
anthropic | openai | google | openrouter | deepinfra | ollama | ollama-cloud
```

- **Model Registry** — static definitions for Claude, GPT-4, Gemini, Llama, Mistral + dynamic Ollama discovery at runtime. Each model entry carries `inputCostPer1M`, `outputCostPer1M`, and `supportsVision` flags.
- **Cost calculation** — `calculateCost(modelId, tokensIn, tokensOut)` on every call, logged immediately to the ledger
- **Model hot-swap** — switch models mid-conversation. A context snapshot carries the prior transcript to the new model; the first call after switch prepends `[CONTEXT HANDOFF]` so the new model has full continuity.
- **Vision routing** — `chat:send` checks `supportsVision` before including image payloads; non-vision models return an inline warning with model suggestions
- **Ollama reachability** — `AuthManager.getAuthStatus()` pings `localhost:11434` to check daemon status; Ollama shows as connected/disconnected in the providers list without needing a key

### Workflow Engine

A visual SVG node canvas for building multi-step agent pipelines:

**Five node types:**
- `agent` — dispatches to any provider + model + persona with a templated system prompt and task
- `tool` — runs Makefile targets, shell commands, file reads/writes, Kanban actions
- `decision` — gates on exit code, test pass/fail, or human approval (blocks until you click)
- `trigger` — fires on story activation, PR open, or manual button
- `flow` — orchestration grouping for subgraph reuse

**Context variables** interpolated at runtime across all node prompts: `{{__storyId}}`, `{{__storyTitle}}`, `{{__lastExitCode}}`, `{{__lastOutput}}`, plus any custom context bag entries.

**Five built-in templates:**

| Template | What it does |
|----------|--------------|
| **Jules PR Manager** | Watch Jules session → fetch diff → Claude review → post PR comment → flag for architect approval |
| **Story Implementation Pipeline** | Architect designs → Implementer codes → Test gate → Commit → Reviewer verifies |
| **Code Review Gate** | PR trigger → Reviewer agent → Human approval gate → Merge or request revisions |
| **Hotfix Pipeline** | Implementer → Test suite → Exit-code gate → Commit or escalate to architect |
| **Release Retrospective** | Git log + model call metrics → performance analysis → user reflection (human node) → learning extraction → `project_memory` write (importance 9) → `AGENTS.md` reinforcement |

**Time-Travel Orchestration** — after each successful node, `SnapshotManager` captures the current git SHA and workflow state. Completed nodes show a `⟳ Rewind` button; rewinding calls `git checkout <sha>` and resets downstream nodes to idle. A detached HEAD warning banner guides the next step.

### Agent Review Panel

The review loop closes inside the IDE — no more `git diff HEAD~1` in a separate terminal:

- **Monaco diff editor** — side-by-side or unified view. Added lines green, removed lines red. Files outside the story's declared scope flagged `⚠ Out of scope`.
- **Inline tsc** — "Run tsc" streams `npx tsc --noEmit` output into a log pane below the diff. Pass: green `✓`. Fail: red `✗ N errors` with the first five errors shown inline.
- **One-click actions** — Approve & Close (marks stories COMPLETE, clears pending review), Request Rework (opens inline note field, story stays REVIEW), View PR (Jules sessions only)
- **Chat integration** — a `ReviewSummaryCard` appears in the chat thread on session completion with pill shortcuts to "View Diff →", "Run tsc →", and "Approve →"
- **Activity bar badge** — Review icon shows a phosphor dot when a review is pending

### Ghost Implementation

While an agent session streams, proposed changes appear as low-opacity Monaco decorations before they land on disk:

- Added lines: `rgba(74, 222, 128, 0.15)` with a left border accent
- Removed lines: `rgba(239, 68, 68, 0.15)` with strikethrough
- Accept or reject individual blocks or all at once; keyboard shortcuts `Cmd+Shift+A` / `Cmd+Shift+R`
- Toggle via "Ghost Mode" in the editor header — off by default for distraction-free work

### Financial Telemetry — CapEx Dashboard

Every LLM call is logged to a SQLite ledger (`model_calls` table):

```
session_id  panel_id  model_id  provider  persona_role
tokens_in   tokens_out  cost_usd  latency_ms  reasoning
workflow_run_id  parent_call_id  created_at
```

Five dashboard tabs:

| Tab | What you see |
|-----|--------------|
| **Financial** | CAPEX/OPEX hours, weekly velocity, session count, developer rate |
| **Quality** | Test coverage %, pass/fail trends, bugs by assignee |
| **LLM** | Daily burn curve, cost by model, cost by story (top 50) |
| **Velocity** | Stories completed per week, status distribution over time |
| **Heatmap** | Technical debt map — files coloured by error density (red), agent churn (orange), token cost (purple). Toggle overlays independently. Click a cell to open the file. |

**Status bar** surfaces a live slice: agent telemetry block (tokens + cost per agent), session HH:MM:SS timer (▶ ⏸ ■), and total CapEx — all with hover tooltips.

**Agent Telemetry Overlay** — clicking the telemetry block opens a slide-up panel with three tabs: Activity (live per-agent), Session (by persona role from ledger), All-Time (cumulative by role across all sessions).

### Security Layer

Four-component security architecture:

- **SecurityManager** — analyses file writes and shell output for dangerous patterns; fires alert events to the renderer
- **PatternDetector** — logs security alerts to `~/.copernicus/logs/security-alerts.jsonl`
- **GitGuard** — pre-commit hook runs `scripts/utils/security_audit.py` before allowing any commit through Copernicus
- **SandboxManager** — per-agent sandboxing toggle via IPC; configurable from Settings → Security

Environment variable allowlist controlled from Settings → Security; agents can only read env vars you explicitly permit.

### Retrospective & Project Memory

The **Release Retrospective** workflow template runs at the end of each sprint:

1. Reads git log since last tag and `model_calls` sprint metrics
2. Analyses performance trends and build error logs
3. Pauses at a **Human Approval** node — you reflect on sprint successes and failures
4. A **Learning Extractor** agent (Claude) formats findings as structured `[RETROSPECTIVE vX.X.X]` rules
5. Rules written to `project_memory` with `importance: 9` — high enough to be retrieved on every session start
6. **AGENTS.md Updater** appends routing reinforcements directly to the repo's agent convention file

`project_memory` table uses an **importance × recency decay** scoring function. High-importance memories survive indefinitely; low-importance ones decay naturally. Retrieved memories are injected at session start so agents begin informed.

### Playwright Browser Automation

A full browser automation layer, surfaced as IPC handlers and usable from workflow nodes:

```
browser:launch    → Chromium (headless or headed), lazy-loaded on first use
browser:navigate  → URL navigation with 15-second timeout
browser:screenshot → Full-page or selector screenshot as base64
browser:click     → Element interaction
browser:fill      → Form input
browser:evaluate  → Arbitrary JavaScript in page context
browser:close     → Session cleanup
```

`devtime:run-playwright` spawns `npx playwright test`, parses output to `{ title, status, duration }[]`, and returns structured results for the Quality dashboard. Canvas screenshots render inline via `canvas:render` push.

### Development Environment

- **Monaco Editor** — Multi-file tabs with dirty indicators, `×` close, horizontal scroll. TypeScript LSP: completions, hover docs, go-to-definition, signature help, real-time diagnostics. `Ctrl+S` saves directly.
- **Integrated Terminal** — Full PTY via `node-pty`; keyboard input wired (`terminal:input` → `pty.write()`). Ephemeral tabs for Touch Bar commands.
- **Command Palette** — `Cmd+P`: VS Code style, fuzzy search, 4–6 visible rows, `↑↓ Enter Esc` navigation, default commands registered at mount.
- **Spotlight System** — Clicking any panel's bookmark strip expands it to fill the layout; others collapse to `w-10` vertical strips with rotated labels. Explorer / Editor / Chat spotlight modes.
- **UI Builder Canvas** — Drag-and-resize visual component editor; agents patch the component tree via structured output.

### Project Management

- **Kanban** — 9 lanes: Planning → Storyboarding → Sprint Planning → Development → Testing → QA → Documenting → Ready to Build → Done
- **Agent Queue Scheduler** — Declare story dependencies. Collision guard warns before out-of-order dispatch. Notification fires when blockers clear.
- **Story Status Automation** — `gemini_session_manager.py` writes status files on spawn (`IN PROGRESS`) and completion (`REVIEW`); Kanban reacts to `stories:status-changed` push events
- **SQLite + Markdown dual-persistence** — stories live in both SQLite (Kanban) and `docs/stories/*.md` (git-trackable, diffable, agent-readable)

### IDE Completeness Panels

| Panel | Key capability |
|-------|---------------|
| **Git** | Stage/unstage files, commit, branch list, checkout, new branch, GitHub PR list |
| **Codebase Search** | ripgrep text search + semantic vector search in one panel |
| **Diagnostics** | Streaming `npx tsc --noEmit`, parsed `file(line,col): error TS…` format, error count badge on activity bar |
| **Review** | Monaco diff viewer, inline tsc, approve/rework |

### Settings

- **Auth** — All keys via Electron `safeStorage` encryption. Providers: Anthropic, OpenAI, Google, OpenRouter, DeepInfra, GitHub, Jules. Ollama uses reachability-as-auth (no key — if the daemon answers, it's connected).
- **Models** — Active model selector. Ollama models discovered live. Default model per view (chat vs workflow node vs agent).
- **Providers** — Correct icon set, drag-to-reorder priority tiles, embedding provider priority list.
- **Personas** — View, disable, or create custom personas with name, description, system prompt, model affinity, and role. Persisted to DB.
- **Templates** — All system workflow templates listed; click to open inline Monaco editor; Save / Reset to Default; user overrides in `template_overrides` table.
- **Appearance** — Phosphor color presets (green / amber / white / blue), UI density, **CRT Mode** (scanline + vignette overlay, intensity scales with agent load — off by default).
- **Hardware** — macOS Touch Bar configuration: view navigation buttons, command tray slots, telemetry display mode (Story+Timer or Branch+Cost).

---

## Stack

| Layer | Technology |
|-------|------------|
| IDE shell | Electron 33, Vite 5 |
| Renderer | React 18, TypeScript 5, Tailwind CSS |
| Editor | Monaco Editor, `typescript-language-server` (JSON-RPC 2.0) |
| State | Zustand + persist middleware |
| Database | SQLite (`better-sqlite3`), `sqlite-vec` for vector search |
| Terminal | `node-pty`, `xterm.js` |
| Browser automation | `playwright-core` |
| Charts | Recharts |
| Backend | Python 3.11, Flask |
| Orchestration | `gemini_session_manager.py` (spawn, monitor, tail) |
| Inference | Anthropic · OpenAI · Google · OpenRouter · DeepInfra · Ollama (local) |
| Infrastructure | Docker, PostgreSQL 16 |

---

## Getting Started

```bash
# Prerequisites: Node 20+, Python 3.11+, npm, Ollama (optional but recommended)

# Install dependencies
cd copernicus && npm install

# Start backend (port 5001) + IDE
make dev

# Type check
make tsc

# Run Playwright tests
make test-e2e

# Regenerate backlog from story frontmatter
make backlog
```

On first launch, the **Genesis Wizard** walks you through credential setup, repo connection, and optionally synthesises an initial epic and story backlog from your project brief.

---

## Agent Dispatch Toolchain

```bash
# Dispatch a story to Jules (validates story format first)
make jules STORY=docs/stories/story_NNN_title.md

# Dry run — print prompt size without dispatching
make jules-dry STORY=...

# Full preflight: install deps + tsc + ipc-lint
make jules-preflight

# 10-point IPC compliance scan
make ipc-lint

# TypeScript check shortcut
make tsc

# Gemini dispatch (via session manager)
python3 dev_orchestrator/gemini_session_manager.py spawn \
  --prompt-file /tmp/prompt.md --stories 346 --direct
```

`ipc-lint` catches: bare `ipcMain.handle` without `handleIpc()` wrapper, renderer calls without `useIpcError()`, missing `unwrapIpc()`, stale channel IDs, stray `console.log`, ghost tint CSS, and more.

---

## Project Structure

```
copernicus/
  electron/
    agents/             GeminiAgent (PTY session management)
    db/                 StateLedger — model_calls, review_sessions,
                        dispatch_queue, project_memory, context_snapshots…
    ipc/                13 modular handler files (app, git, search,
                        diagnostics, chat, workflow, security, terminal…)
    lsp/                LSP manager — JSON-RPC 2.0, symbol caching,
                        diagnostics cache
    models/             ModelRegistry — 7 providers, cost tables,
                        dynamic Ollama discovery
    security/           SecurityManager, PatternDetector, GitGuard,
                        SandboxManager
    workflow/           WorkflowEngine, SnapshotManager, 5 node types,
                        5 built-in templates, state machine
    codebase-indexer.ts sqlite-vec 768-dim embeddings, LSP-symbol chunking,
                        chokidar file watcher
    touch-bar.ts        macOS Touch Bar integration
  src/renderer/
    components/         Kanban, Editor (Monaco + tabs + ghost mode),
                        Terminal, Chat (image upload, lightbox),
                        Workflow (canvas + rewind), Review (diff + tsc),
                        Git, Search, Diagnostics, CapEx (5-tab dashboard),
                        Settings, Planning (queue + scheduler),
                        effects (CRTOverlay)…
    store/              layout, session, queue, commandRegistry
    hooks/              useIpcError (enforced IPC pattern)
backend/                Flask API — devtime, story scaffolding, orchestration
src/agentic/            Python multi-agent orchestration logic
dev_orchestrator/       gemini_session_manager.py — spawn, list, tail, kill
docs/
  stories/              Active stories (Markdown + frontmatter)
  stories/completed/    267 archived completed stories
  reference/            UX_BIBLE.md, TECHNICAL_BIBLE.md
scripts/                jules_assign.sh, ipc-lint.sh, generate_backlog.py,
                        security_audit.py…
```

---

## Architecture Notes

**IPC envelope** — Every `ipcMain.handle` uses `handleIpc()` returning `{ ok: true, data }` or `{ ok: false, error }`. Every renderer call uses `useIpcError()` + `unwrapIpc()`. Enforced by `make ipc-lint` and TypeScript types. No exceptions.

**Agent dispatch** — Claude runs in-process (streaming). Gemini runs as a PTY session via `gemini_session_manager.py --direct` (suppresses sub-delegation footer). Jules dispatches async to GitHub and polls for PR completion. All three log to `model_calls` and surface in the terminal tab strip.

**Semantic search architecture** — LSP provides symbol boundaries → chunks stored in `sqlite-vec` with 768-dim embeddings → queries combine cosine similarity with symbol name boost → results returned as `{ file, line, col, symbol, score }[]`. No external dependencies beyond an embedding provider.

**Memory system** — `project_memory` stores learnings with `importance` 1–10 scored against recency decay. Session start retrieves top memories above threshold and injects them as system context. The retrospective pipeline writes importance-9 entries that persist indefinitely.

**Story format** — Markdown files with structured sections (`## Blocks`, `## Blocked By`, `## Acceptance Criteria`, `## Definition of Done`). SQLite Kanban syncs from disk on focus, writes atomically. `gemini_session_manager.py` reads these directly — they are the agent's source of truth.

**Governance** — `docs/reference/UX_BIBLE.md` and `TECHNICAL_BIBLE.md` define binding constraints. `AGENTS.md` at repo root is read automatically by Jules and updated by the Retrospective workflow. All three documents are the law; the retrospective pipeline keeps them current.
