# COPERNICUS IDE

A multi-agent orchestration IDE built on Electron/React, designed for industrial software development with Claude, Gemini, and Jules as first-class collaborators.

---

## Features

### Multi-Agent Orchestration

- **Claude integration** — Chat panel with full conversation history, model hot-swap, and context snapshots across model switches
- **Gemini CLI** — Spawn Gemini as a PTY agent from the terminal pane; send prompts programmatically
- **Jules** — Dispatch stories to Jules via the Kanban board (`→ Jules` button on approved stories); session status, PR links, and retry in the Jules panel
- **Workflow Engine** — Visual node-based workflow canvas with agent, tool, decision, trigger, and flow nodes; run against real story context
- **Parallel Review Gate** — Multi-agent review with Claude + Gemini verdicts before merge

### Development Environment

- **Monaco Editor** — Full-featured code editor with TypeScript LSP (via `typescript-language-server`), real-time diagnostics, go-to-definition, hover docs, and completions
- **File Tree** — Workspace file explorer with binary/image detection and Ctrl+S save
- **Integrated Terminal** — Split terminal with tabs for Local, Claude, Gemini, and Jules sessions; ephemeral PTY tabs for Touch Bar commands
- **Command Palette** — `Cmd+P` file search + command runner across the full workspace

### Project Management (Kanban)

- **9-lane swimlane board** — Planning → Storyboarding → Sprint Planning → Development → Testing → QA → Documenting → Ready to Build → Done
- **Card spotlight** — Click a card to expand its lane and collapse the rest to slim strips; click a strip to restore the full board
- **Story drawer** — Inline story detail panel with markdown body, model assignment, status transitions, and Jules dispatch
- **SQLite persistence** — All story state written to SQLite with atomic file sync; stories co-exist as Markdown files in `docs/stories/`
- **Backlog generation** — `make backlog` regenerates `BACKLOG.md` from story frontmatter

### Agent Dispatch Toolchain

- **`make jules STORY=<path>`** — Validates story, injects full AGENTS.md context, dispatches to Jules CLI with a structured 5-step DoD
- **`make ipc-lint`** — 10-check IPC compliance scanner (bare handlers, envelope pattern, ghost tint CSS, stale IDs, console.logs, dead functions, etc.)
- **`make tsc`** — TypeScript compile check shortcut
- **`make jules-dry`** — Dry-run mode: validates story and prints prompt size without dispatching
- **`make jules-preflight`** — Jules Initial Setup command: installs deps, runs tsc baseline, runs ipc-lint

### CapEx Intelligence Dashboard

- **Financial tab** — Hours by story with CAPEX/OPEX classification and CSV export
- **LLM tab** — Daily cost burn, cost by model/provider, cost by story context
- **Quality tab** — Test run history, coverage gauge, bugs-by-assignee chart
- **Velocity tab** — Stories completed per week, status distribution
- Developer rate configurable inline; persisted to settings

### Settings

- **Auth** — Anthropic, Google, OpenRouter, DeepInfra, GitHub tokens via Electron `safeStorage`; OAuth flows for Google and Anthropic
- **Appearance** — Phosphor color system (green/amber/white/blue), UI density, font size, animation toggle
- **Models** — Active model selector across all providers; Ollama dynamic discovery
- **Security** — Environment variable allowlist, per-agent sandbox toggle

### Visual Design

- **Phosphor color system** — Single CSS `var(--phosphor)` drives all active states, glows, and accent colors; four presets switchable at runtime
- **VT terminal selection block** — Active states use solid filled rectangles (`bg-copernicus-phosphor text-[#050505] rounded-none`), not underlines or ghost tints
- **FlippablePanel** — Two modes: `flip` (rotateY card turn) for text back faces, `slide` (translateX) for webview back faces
- **Touch Bar** — macOS Touch Bar with view navigation, command tray, telemetry labels, and active view highlighting

### Infrastructure

- **Dell R210ii Core** — Ollama inference server (Docker) for local LLM inference
- **Flask backend** — Python 3.11 API for devtime tracking, story scaffolding, and agent orchestration
- **SQLite state ledger** — Model call ledger, devtime sessions, jules sessions, context snapshots, project memory
- **Playwright automation** — Browser launch/navigate/screenshot/click/fill/evaluate via IPC for agent browser tasks

---

## Development

```bash
make dev          # Start backend (port 5001) + Copernicus IDE (Electron)
make test         # Run backend pytest suite
make test-e2e     # Run Playwright E2E tests
make backlog      # Regenerate BACKLOG.md from story files
make ipc-lint     # Run IPC compliance check (10 rules)
make tsc          # TypeScript type check
make deploy       # Deploy to Dell R210ii Core
```

## Stack

| Layer | Technology |
|-------|-----------|
| IDE frontend | Electron 33, React 18, TypeScript, Vite, Tailwind CSS |
| Editor | Monaco Editor, typescript-language-server (LSP) |
| State | Zustand + persist middleware, SQLite (better-sqlite3) |
| Animations | Framer Motion |
| Charts | Recharts |
| Backend | Python 3.11, Flask |
| Inference | Anthropic, OpenAI, Google, OpenRouter, DeepInfra, Ollama |
| Automation | Playwright Core, node-pty |
| Logging | electron-log |
| Infrastructure | Docker, Dell R210ii, PostgreSQL 16 |

## Project Structure

```
copernicus/         Electron IDE (main process + renderer)
  electron/         Main process: IPC handlers, managers, workflow engine
  src/renderer/     React renderer: components, store, hooks
backend/            Flask API
src/agentic/        Multi-agent orchestration logic
docs/
  stories/          Feature stories (APPROVED FOR IMPLEMENTATION / COMPLETE)
  reference/        UX_BIBLE.md, TECHNICAL_BIBLE.md
scripts/            CLI utilities, agent dispatch scripts
```
