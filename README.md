# Copernicus IDE

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Contributor Covenant](https://img.shields.io/badge/Contributor%20Covenant-2.1-4baaaa.svg)](CODE_OF_CONDUCT.md)

An agentic development environment where LLM agents work as peers on your engineering team — not a chat wrapper, not a code-completion plugin. A full IDE with Monaco editor, integrated terminal, Kanban project management, semantic codebase search, financial telemetry, and workflow automation.

You write stories. Agents implement them. Copernicus tracks cost, quality, and velocity.

---

## What Makes This Different

Individual pieces of the agentic development puzzle exist elsewhere: episodic memory, token authority, loop controllers, behavioral contracts. Copernicus integrates all of them into a governed IDE — planning, delegation, financial accountability, verification, and retrospective learning connected rather than scattered across tools.

**AI contributors:** [Claude](https://anthropic.com) (Anthropic) — architecture, planning, code review. [Jules](https://jules.google) (Google) — implementation across 30+ merged PRs.

---

## Why Copernicus Exists

Every current LLM coding tool has the same problem: the agent gets context, makes a guess, and disappears. You have no idea what it cost, whether it broke anything, or how to route the next task.

**Plan → Delegate → Review.** The architect defines acceptance criteria. The implementer executes. The reviewer verifies the diff, runs `tsc`, and approves or requests rework — all inside the IDE.

**Every decision is accountable.** Every LLM call is logged with model, provider, tokens, cost, latency. The CapEx dashboard shows exactly where money went and what it produced.

**The system learns.** The Release Retrospective workflow extracts learnings from each sprint and writes them back to project memory. The next sprint starts smarter.

---

## Execution Channels

| Channel | How it works | What fills it |
|---------|-------------|---------------|
| **In-process streaming** | Direct API call from Electron main process | Anthropic, Google, OpenAI, OpenRouter, DeepInfra, Ollama |
| **PTY session** | Shell process with filesystem access | CCR (Claude Code Router) |
| **Async PR agent** | Fire-and-forget to remote agent; result is a GitHub branch + PR | Jules (Google) |

Any model can fill any channel. The channel is the interface; the model is a configuration choice.

### Provider Ecosystem

| Provider | Models | Cost | Best for |
|----------|--------|------|----------|
| **Anthropic** | Claude 4.6 Opus · Sonnet · Haiku | Pay-per-token | Architecture, review, complex reasoning |
| **Google Gemini** | 2.5 Pro · 2.0 Flash | Free tier + pay | Long context, multimodal, multi-file refactors |
| **Jules** | Google async coding agent | Free tier | Story implementation via isolated PR |
| **OpenAI** | GPT-4o · GPT-4 Turbo | Pay-per-token | General purpose, vision, function calling |
| **OpenRouter** | 200+ models via one key | Varies | Model variety, cost arbitrage |
| **DeepInfra** | Llama 3.3 70B · Qwen2.5 · Mistral | Low cost | Cost-efficient open-weight inference |
| **Ollama (local)** | Any model — Llama, Qwen, Gemma, DeepSeek, Phi… | Free | Full offline, privacy, embeddings |
| **Ollama (sovereign)** | Large models on remote Ollama server | Free (self-hosted) | GPU-class inference without cloud spend |

---

## Features

### Semantic Codebase Intelligence

- **LSP-symbol-aware chunking** — `typescript-language-server` provides function/class boundaries as natural chunk boundaries
- **768-dimensional embeddings** in `sqlite-vec` — same database as everything else, no external vector store
- **Embedding provider waterfall**: Ollama → Google → OpenAI. Works fully offline if Ollama is running.
- **Incremental re-indexing** — chokidar watches for file changes; only modified files are re-embedded
- **Hybrid search** — vector similarity + symbol name boosting, ranked by relevance + recency

### Multi-Provider Model Routing

- **Model Registry** — static definitions + dynamic Ollama discovery. Each entry carries cost data and capability flags.
- **Cost calculation** on every call, logged to the ledger immediately
- **Model hot-swap** — switch mid-conversation with context handoff
- **Vision routing** — `supportsVision` flag gates image payloads per model

### Workflow Engine

Visual SVG node canvas for building multi-step agent pipelines:

| Node type | What it does |
|-----------|-------------|
| `agent` | Dispatch to any provider + model + persona |
| `tool` | Run Makefile targets, shell commands, file I/O, Kanban actions |
| `decision` | Gate on exit code, test results, or human approval |
| `trigger` | Fire on story activation, PR open, or manual button |
| `flow` | Orchestration grouping for subgraph reuse |

**Context variables** interpolated at runtime: `{{__storyId}}`, `{{__storyTitle}}`, `{{__lastExitCode}}`, `{{__lastOutput}}`, plus custom entries.

**Time-Travel Orchestration** — after each node, `SnapshotManager` captures git SHA and workflow state. Rewind any completed node to reset downstream.

### Agent Review Panel

- **Monaco diff editor** — side-by-side or unified view. Out-of-scope changes flagged.
- **Inline tsc** — streams `npx tsc --noEmit` output. Pass/fail shown inline.
- **One-click actions** — Approve & Close, Request Rework, View PR

### Ghost Implementation

Proposed changes appear as low-opacity Monaco decorations before landing on disk. Accept or reject individual blocks or all at once.

### Financial Telemetry — CapEx Dashboard

Every LLM call logged to SQLite (`model_calls` table). Five dashboard tabs: Financial, Quality, LLM, Velocity, Heatmap. Status bar shows live agent telemetry, session timer, and total CapEx.

### Security Layer

- **SecurityManager** — analyses file writes and shell output for dangerous patterns
- **PatternDetector** — logs alerts to `security-alerts.jsonl`
- **GitGuard** — pre-commit security audit
- **SandboxManager** — per-agent sandboxing via IPC

### Retrospective & Project Memory

The **Release Retrospective** workflow: git log → performance analysis → human reflection → learning extraction → `project_memory` (importance-weighted, recency-decayed) → `AGENTS.md` reinforcement. The next sprint starts informed.

### Browser Automation

Playwright integration via IPC handlers: `browser:launch`, `browser:navigate`, `browser:screenshot`, `browser:click`, `browser:fill`, `browser:evaluate`, `browser:close`.

### Development Environment

- **Monaco Editor** — multi-file tabs, TypeScript LSP (completions, hover, go-to-definition, diagnostics)
- **Integrated Terminal** — full PTY via `node-pty`
- **Command Palette** — `Cmd+P`, fuzzy search, keyboard navigation
- **Spotlight System** — click a panel's bookmark to expand it; others collapse to vertical strips
- **UI Builder Canvas** — drag-and-resize visual component editor

### Project Management

- **Kanban** — 9 lanes from Planning to Done
- **Agent Queue Scheduler** — declare story dependencies, collision guard, blocker notifications
- **Story Status Automation** — agents update status on dispatch and completion
- **SQLite + Markdown dual-persistence** — stories in both DB (Kanban) and files (git-trackable, agent-readable)

### Settings

- **Auth** — all keys via Electron `safeStorage` encryption. Ollama uses reachability-as-auth (no key needed).
- **Models** — active model selector, per-view defaults, live Ollama discovery
- **Personas** — custom system prompts, model affinity, role definitions
- **Templates** — workflow templates with inline Monaco editor
- **Appearance** — Phosphor color presets, UI density, CRT Mode (scanline overlay)
- **Hardware** — macOS Touch Bar configuration

---

## Built for Apple Silicon

Copernicus ships with native MLX inference support — zero-config, zero-cost agentic experience on M1/M2/M3/M4 Macs.

| Org chart role | Default model |
|----------------|---------------|
| **coder** | `mlx-community/Qwen2.5-Coder-7B-Instruct-4bit` |
| **reviewer** | `mlx-community/DeepSeek-R1-Distill-Qwen-7B-4bit` |
| **planner** | `mlx-community/Mistral-7B-Instruct-v0.3-4bit` |

Customize models in `scripts/agent-daemon/defaults/mlx-models.yaml`. Install MLX: `pip install mlx-lm`.

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
| Orchestration | `jules_daemon.py` (poll + review + merge) |
| Inference | Anthropic · OpenAI · Google · OpenRouter · DeepInfra · Ollama |

---

## Getting Started

```bash
# Prerequisites: Node.js 18+, Python 3.11+, gh CLI (recommended), Ollama (optional)

# One-command setup
bash scripts/dev-setup.sh

# Start backend (port 5001) + IDE
make dev

# Type check
make tsc

# IPC compliance scan
make ipc-lint
```

On first launch, the **Genesis Wizard** walks you through credential setup, repo connection, and optionally synthesizes an initial epic and story backlog from your project brief.

---

## Architecture

**IPC envelope** — Every `ipcMain.handle` uses `handleIpc()` returning `{ ok: true, data }` or `{ ok: false, error }`. Every renderer call uses `useIpcError()` + `unwrapIpc()`. Enforced by `make ipc-lint` and TypeScript types.

**Agent dispatch** — Claude runs in-process (streaming). CCR handles Python, shell, and multi-file implementation from isolated git worktrees. Jules dispatches async to GitHub; `scripts/agent-daemon/index.mjs` polls for completion, runs Claude Sonnet review against story ACs, and auto-merges only on explicit APPROVE.

**Semantic search** — LSP provides symbol boundaries → chunks stored in `sqlite-vec` with 768-dim embeddings → queries combine cosine similarity with symbol name boost. No external dependencies beyond an embedding provider.

**Memory system** — `project_memory` stores learnings with importance 1–10 scored against recency decay. Importance-9 entries persist indefinitely. Retrieved memories inject as system context at session start.

**Story format** — Markdown files with structured sections (`## Blocks`, `## Acceptance Criteria`, `## Definition of Done`). SQLite Kanban syncs from disk on focus, writes atomically.

**Configuration** — All service URLs centralized in `electron/config.ts` with env-var overrides (`COPERNICUS_BACKEND_URL`, `OLLAMA_BASE_URL`, etc.). No hardcoded localhost references in production code.

---

## Project Structure

```
copernicus/
  electron/
    agents/             PTY session management
    db/                 StateLedger — model_calls, stories, project_memory…
    ipc/                13 modular handler files
    lsp/                LSP manager — JSON-RPC 2.0, symbol caching, diagnostics
    models/             ModelRegistry — 7 providers, cost tables, Ollama discovery
    security/           SecurityManager, PatternDetector, GitGuard, SandboxManager
    workflow/           WorkflowEngine, SnapshotManager, 5 node types, 5 templates
    codebase-indexer.ts sqlite-vec 768-dim embeddings, LSP-symbol chunking
    config.ts           Centralized service configuration with env-var overrides
  src/renderer/
    components/         Kanban, Editor, Terminal, Chat, Workflow (canvas + rewind),
                        Review (diff + tsc), CapEx (5-tab dashboard), Settings…
    store/              layout, session, queue, commandRegistry
    hooks/              useIpcError (enforced IPC pattern)
backend/                Flask API — devtime, orchestration, notebooklm
scripts/                jules_assign.sh, jules_daemon.py, dev-setup.sh, ipc-lint.sh…
docs/
  guides/              Engineering standards, SOPs
  help/                User guides, keyboard shortcuts, operator startup
  reference/           UX_BIBLE.md, TECHNICAL_BIBLE.md
```

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup instructions, code standards, and PR process. We enforce:

- TypeScript strict mode with `noEmit` gate
- `make ipc-lint` — catches bare `ipcMain.handle`, missing `unwrapIpc()`, stale channels
- `make tsc` — zero-error type check before merge
- PR validation CI on every push

## Security

See [SECURITY.md](SECURITY.md) for vulnerability reporting. Security features:

- All API keys encrypted via Electron `safeStorage`
- CORS origins env-configurable (no wildcards in production)
- GitGuard pre-commit hook scans for secrets
- SandboxManager per-agent filesystem isolation
- Docker Compose binds Ollama to `127.0.0.1` only

## License

[MIT](LICENSE)
