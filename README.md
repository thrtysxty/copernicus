# Copernicus IDE

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Contributor Covenant](https://img.shields.io/badge/Contributor%20Covenant-2.1-4baaaa.svg)](CODE_OF_CONDUCT.md)

An agentic development environment where LLM agents work as peers on your engineering team.

Not a chat wrapper. Not a code-completion plugin. A full IDE with Monaco editor, integrated terminal, Kanban project management, semantic codebase search, financial telemetry, and workflow automation.

You write stories. Agents implement them. Copernicus tracks cost, quality, and velocity.

**Built with AI:** [Claude](https://anthropic.com) (Anthropic) — architecture, agent orchestration, code review. [Gemini](https://deepmind.google/technologies/gemini/) (Google) — planning, architecture, agent orchestration. [Jules](https://jules.google) (Google) — implementation across 30+ merged PRs. [Devstral Small](https://mistral.ai) (Mistral) — code review.

---

## Quick Start

```bash
# Prerequisites: Node.js 18+, Python 3.11+, Ollama (optional)

bash scripts/dev-setup.sh    # Install deps, create venv, copy config templates
make dev                     # Start backend (port 5001) + Electron IDE
make tsc                     # TypeScript type check (zero-error gate)
make lint                    # ESLint
```

Copy API keys: `cp secrets.example ~/.secrets` then edit. On first launch, the **Genesis Wizard** walks you through credential setup, repo connection, and story backlog generation.

---

## Core Loop

**Plan → Delegate → Review.** The architect writes acceptance criteria. The implementer executes. The reviewer verifies the diff, runs whatever test or lint suite the project requires (any language), and approves or requests rework — all inside the IDE.

Every LLM call is logged with model, provider, tokens, cost, and latency. The CapEx dashboard shows exactly where money went and what it produced. The Release Retrospective extracts learnings from each sprint and writes them back to project memory. The next sprint starts smarter.

---

## Features

### Code Intelligence

- **LSP-symbol-aware chunking** — function/class boundaries from `typescript-language-server` as natural chunk edges
- **768-dim embeddings** in `sqlite-vec` — no external vector store needed
- **Provider waterfall**: Ollama → Google → OpenAI. Fully offline if Ollama is running.
- **Incremental re-indexing** — chokidar watches for changes; only modified files re-embed
- **Hybrid search** — vector similarity + symbol name boosting, ranked by relevance + recency

### Multi-Provider Model Routing

- **Model Registry** — static definitions + dynamic Ollama discovery, cost data on every entry
- **Cost calculation** on every call, logged immediately
- **Model hot-swap** — switch mid-conversation with context handoff
- **Vision routing** — `supportsVision` flag gates image payloads per model

| Provider | Models | Best for |
|----------|--------|----------|
| **Anthropic** | Claude Opus · Sonnet · Haiku | Architecture, review, complex reasoning |
| **Google Gemini** | All models your key can access | Long context, multimodal, multi-file refactors |
| **Jules** | Google async coding agent | Story implementation via isolated PR |
| **OpenAI** | All models your key can access | General purpose, vision, function calling |
| **OpenRouter** | 200+ models via one key | Model variety, cost arbitrage |
| **DeepInfra** | Llama 3.3 70B · Qwen2.5 · Mistral | Cost-efficient open-weight inference |
| **Ollama** | Any model — local, self-hosted, or Ollama Cloud | Full offline, privacy, embeddings |

### Workflow Engine

Visual SVG node canvas for building multi-step agent pipelines:

| Node type | What it does |
|-----------|-------------|
| `agent` | Dispatch to any provider + model + persona |
| `tool` | Run Makefile targets, shell commands, file I/O, Kanban actions |
| `decision` | Gate on exit code, test results, or human approval |
| `trigger` | Fire on story activation, PR open, or manual button |
| `flow` | Orchestration grouping for subgraph reuse |

Context variables interpolated at runtime: `{{__storyId}}`, `{{__storyTitle}}`, `{{__lastExitCode}}`, `{{__lastOutput}}`, plus custom entries.

**Time-Travel Orchestration** — `SnapshotManager` captures git SHA and workflow state after each node. Rewind any completed node to reset downstream.

### Agent Review Panel

- **Monaco diff editor** — side-by-side or unified view, out-of-scope changes flagged
- **Inline tsc** — streams `npx tsc --noEmit` output, pass/fail shown inline
- **One-click actions** — Approve & Close, Request Rework, View PR

### Ghost Implementation

Proposed changes appear as low-opacity Monaco decorations before landing on disk. Accept or reject individual blocks or all at once.

### CapEx Dashboard

Every LLM call logged to SQLite (`model_calls` table). Five tabs: Financial, Quality, LLM, Velocity, Heatmap. Status bar shows live agent telemetry, session timer, and total CapEx.

### Security

- **SecurityManager** — analyzes file writes and shell output for dangerous patterns
- **PatternDetector** — logs alerts to `security-alerts.jsonl`
- **GitGuard** — pre-commit security audit
- **SandboxManager** — per-agent filesystem isolation via IPC

### Retrospective & Project Memory

**Release Retrospective** workflow: git log → performance analysis → human reflection → learning extraction → `project_memory` (importance-weighted, recency-decayed) → `AGENTS.md` reinforcement. The next sprint starts informed.

### Project Management

- **Kanban** — 9 lanes from Planning to Done
- **Agent Queue Scheduler** — declare story dependencies, collision guard, blocker notifications
- **Story Status Automation** — agents update status on dispatch and completion
- **Dual persistence** — SQLite for Kanban, Markdown files for git-trackable agent access

### Browser Automation

Playwright integration via IPC: `browser:launch`, `browser:navigate`, `browser:screenshot`, `browser:click`, `browser:fill`, `browser:evaluate`, `browser:close`.

### Editor & Terminal

- **Monaco Editor** — multi-file tabs, TypeScript LSP (completions, hover, go-to-definition, diagnostics)
- **Integrated Terminal** — full PTY via `node-pty`
- **Command Palette** — `Cmd+P`, fuzzy search, keyboard navigation
- **Spotlight System** — click a panel's bookmark to expand it; others collapse to vertical strips

### Settings

- **Auth** — all keys encrypted via Electron `safeStorage`. Ollama uses reachability-as-auth (no key needed)
- **Models** — active model selector, per-view defaults, live Ollama discovery
- **Personas** — custom system prompts, model affinity, role definitions
- **Templates** — workflow templates with inline Monaco editor
- **Appearance** — Phosphor color presets, UI density, CRT Mode (scanline overlay)

---

## Apple Silicon Support

Native MLX inference — zero-config, zero-cost agentic experience on M1/M2/M3/M4 Macs.

| Role | Default model |
|------|---------------|
| **coder** | `mlx-community/Qwen2.5-Coder-7B-Instruct-4bit` |
| **reviewer** | `mlx-community/DeepSeek-R1-Distill-Qwen-7B-4bit` |
| **planner** | `mlx-community/Mistral-7B-Instruct-v0.3-4bit` |

Customize in Settings → Hardware. Install MLX: `pip install mlx-lm`.

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
| Inference | Anthropic · OpenAI · Google · OpenRouter · DeepInfra · Ollama |

---

## Architecture

**IPC envelope** — Every `ipcMain.handle` uses `handleIpc()` returning `{ ok, data }` or `{ ok: false, error }`. Every renderer call uses `useIpcError()` + `unwrapIpc()`. Enforced by TypeScript types.

**Agent dispatch** — Claude runs in-process (streaming). CCR handles Python, shell, and multi-file implementation from isolated git worktrees. Jules dispatches async to GitHub; the daemon polls for completion, runs review against story ACs, and auto-merges only on explicit APPROVE.

**Semantic search** — LSP provides symbol boundaries → chunks stored in `sqlite-vec` with 768-dim embeddings → queries combine cosine similarity with symbol name boost. No external dependencies beyond an embedding provider.

**Memory system** — `project_memory` stores learnings with importance 1–10 scored against recency decay. Importance-9 entries persist indefinitely. Retrieved memories inject as system context at session start.

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
scripts/                dev-setup.sh
docs/
  help/                User guides, keyboard shortcuts, operator startup
  reference/           UX_BIBLE.md, TECHNICAL_BIBLE.md
```

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup instructions, code standards, and PR process. We enforce:

- TypeScript strict mode with `noEmit` gate
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
