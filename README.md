# COPERNICUS IDE

**A multi-agent orchestration IDE for industrial software development.**

Claude, Gemini, and Jules work alongside you — and each other — inside a single Electron desktop application. You write stories. Agents implement them. The IDE tracks cost, quality, and velocity in real time.

---

## What It Does

COPERNICUS is a local desktop IDE built around the idea that LLM agents are engineering team members. Instead of copy-pasting into chat windows, you:

1. Write a story on the Kanban board
2. Assign it to Claude, Gemini, or Jules (or a custom workflow)
3. Watch the agent implement it, stream output to a terminal tab, and create a PR
4. Review cost, test coverage, and velocity on the CapEx dashboard

Everything runs locally except Jules (dispatches to GitHub) and whatever cloud inference providers you configure.

---

## Features

### Multi-Agent Orchestration

| Agent | Integration | Use case |
|-------|-------------|----------|
| **Claude** | Anthropic API + streaming | Chat, code review, context-aware Q&A |
| **Gemini CLI** | PTY session via `node-pty` | Local agentic coding, LSP-fed diagnostics |
| **Jules** | REST API → GitHub branch + PR | Async story implementation at scale |

- **Workflow Engine** — Visual node canvas (agent / tool / decision / trigger / flow nodes). Build multi-step pipelines and run them against live story context.
- **Parallel Review Gate** — Claude and Gemini both review a change; majority verdict gates merge.
- **Model hot-swap** — Switch models mid-conversation. Context snapshots carry the prior transcript to the new model automatically.

### Development Environment

- **Monaco Editor** — Full TypeScript LSP via `typescript-language-server`. Real-time diagnostics, go-to-definition, hover docs, signature help, completions.
- **Integrated Terminal** — Split tab terminal. Tabs for Local, Claude, Gemini, and Jules sessions. Ephemeral PTY tabs for Touch Bar commands. `node-pty` under the hood.
- **File Tree** — Workspace explorer with binary/image detection. `Ctrl+S` saves directly. Binary files blocked from the editor gracefully.
- **Command Palette** — `Cmd+P` file fuzzy search + command runner across the full workspace.
- **UI Builder Canvas** — Drag-and-resize visual component editor backed by the Monaco editor; agents can patch the component tree via structured output.

### Project Management

- **9-lane Kanban** — Planning → Storyboarding → Sprint Planning → Development → Testing → QA → Documenting → Ready to Build → Done.
- **Card spotlight** — Click a card to expand its lane; rest collapse to slim vertical strips.
- **Story drawer** — Inline markdown editor, model assignment, priority/type/epic selectors, Jules dispatch, Gemini dispatch.
- **SQLite persistence** — All story state written to SQLite with atomic rename flush. Stories also live as Markdown files in `docs/stories/` — git-trackable and diff-friendly.
- **Backlog generation** — `make backlog` rebuilds `BACKLOG.md` from frontmatter across all story files.

### CapEx Intelligence Dashboard

- **Financial** — Hours by story, CAPEX/OPEX classification, CSV export. Developer rate configured inline and persisted.
- **LLM costs** — Daily burn, cost by model/provider, cost by story. All calls logged to a `model_calls` SQLite ledger.
- **Quality** — Test run history, coverage gauge, bugs-by-assignee.
- **Velocity** — Stories completed per week, status distribution over time.

### Agent Dispatch Toolchain

```bash
make jules STORY=docs/stories/story_NNN_title.md   # Validate + dispatch to Jules
make jules-dry STORY=...                            # Dry run — print prompt size only
make jules-preflight                                # Install deps + tsc + ipc-lint
make ipc-lint                                       # 10-check IPC compliance scanner
make tsc                                            # TypeScript type check shortcut
```

`ipc-lint` checks: bare `ipcMain.handle` without `handleIpc()` wrapper, missing envelope pattern, ghost tint CSS, stale channel IDs, stray `console.log`, dead functions, and more.

### Settings

- **Auth** — Anthropic, OpenAI, Google, OpenRouter, DeepInfra, GitHub tokens via Electron `safeStorage`. OAuth flows for Google and Anthropic.
- **Models** — Active model selector across all providers. Ollama models discovered dynamically at runtime.
- **Appearance** — Phosphor color system (green / amber / white / blue), UI density, font size, animation toggle.
- **Security** — Environment variable allowlist, per-agent sandbox toggle.
- **MCP Servers** — Configuration tab for Model Context Protocol server registrations *(in progress)*.

### Visual Design

- **Phosphor color system** — One CSS variable (`--phosphor`) drives all active states, glows, borders, and accent colors. Four presets switchable at runtime with no page reload.
- **VT selection block** — Active states use solid filled rectangles (`bg-copernicus-phosphor text-[#050505] rounded-none`). No underlines, no ghost tints.
- **Slide panels** — Dual-view panels (`JulesPanel`, `ChatPanel`) translate on the X axis. `rotateY`/3D transforms are forbidden because they break native `<webview>` compositing.
- **Touch Bar** — macOS Touch Bar integration: view navigation, command tray, telemetry labels, active view highlight.

---

## Current Work

The following stories are approved and in active development (agent-assigned or in review):

| # | Story | Status | Assigned |
|---|-------|--------|----------|
| 183 | Chat Panel — Tools Back Face (5 tabs) | In flight | Jules |
| 184 | Command Center — Live Agent & System Dashboard | In flight | Jules |
| 185 | Designer View — Canvas as Unified Graphic Surface | In flight | Jules |
| 189 | LSP → Monaco & ChatPanel Context Wiring | In flight | Jules |
| 195 | Gemini CLI PTY Agent — Spawn, Send, Receive | **Complete** | Claude Code |

Recent completions this sprint: #177 Renderer Bug Sweep, #178 IPC Compliance & Dead Code, #176 LSP Integration, #175 IPC Envelope Fix, #192 electron-log Cleanup.

---

## Roadmap

Stories are sequenced in `BACKLOG.md`. The next wave:

### Near-term (sprint)
- **#181** Quick Tour — First-launch guided walkthrough with interactive step overlay
- **#186** Kanban card — workflow assignment and Run button (trigger a workflow from a card)
- **#187** Jules PR Manager — workflow template for the full Jules dispatch → review → merge loop
- **#188** Copernicus Guide persona — GUIDE tab and tour integration (onboarding chat agent)
- **#191** Context Snapshots & Project Memory — DB tables and cross-session memory wiring

### Medium-term
- **#190** MCP Server Configuration — manage MCP server registrations from Settings
- **#193** Accessibility pass — keyboard navigation and ARIA labels across all panels
- **#194** Flask Backend — API scaffold and core routes for devtime, story, and agent orchestration

### Longer horizon
- Native diff viewer in Monaco for PR review
- Multi-workspace support (open multiple project roots)
- Agent-to-agent messaging (Claude delegates subtasks to Gemini or Jules)
- Offline-first packaging with bundled Ollama model

---

## Stack

| Layer | Technology |
|-------|------------|
| IDE shell | Electron 33, Vite 5 |
| Renderer | React 18, TypeScript 5, Tailwind CSS |
| Editor | Monaco Editor, `typescript-language-server` |
| State | Zustand + persist, SQLite (`better-sqlite3`) |
| Animations | Framer Motion |
| Charts | Recharts |
| Terminal | `node-pty`, `xterm.js` |
| Automation | Playwright Core |
| Backend | Python 3.11, Flask |
| Inference | Anthropic, OpenAI, Google, OpenRouter, DeepInfra, Ollama |
| Infrastructure | Docker, Dell R210ii (local inference), PostgreSQL 16 |

---

## Getting Started

```bash
# Prerequisites: Node 20+, Python 3.11+, npm

# Install dependencies
cd copernicus && npm install

# Start backend (port 5001) + IDE
make dev

# Type check
make tsc

# Run Playwright E2E tests
make test-e2e

# Regenerate BACKLOG.md
make backlog
```

On first launch, a setup wizard guides you through credential configuration (Anthropic, Google OAuth, GitHub token).

---

## Project Structure

```
copernicus/
  electron/           Main process — IPC handlers, agent managers, workflow engine
    agents/           GeminiAgent, (future: ClaudeAgent)
    workflow/         WorkflowEngine, node types, templates
    managers/         Auth, Models, Stories, LSP, Jules, GitHub, Devtime…
  src/renderer/       React renderer
    components/       All UI: Kanban, Editor, Terminal, Chat, Workflow, CapEx…
    store/            Zustand layout store
    hooks/            useIpcError (enforced IPC pattern)
backend/              Flask API — devtime, story scaffolding, orchestration
src/agentic/          Python multi-agent orchestration logic
docs/
  stories/            Feature stories (Markdown + frontmatter)
  reference/          UX_BIBLE.md, TECHNICAL_BIBLE.md
scripts/              jules_assign.sh, ipc-lint.sh, generate_backlog.py…
```

---

## Architecture Notes

**IPC contract** — Every `ipcMain.handle` is wrapped in a `handleIpc()` helper that returns `{ ok: true, data }` or `{ ok: false, error }`. Every renderer call goes through the `useIpcError` hook. This is enforced by `make ipc-lint` and TypeScript types.

**Agent dispatch** — Claude (streaming, in-process), Gemini (PTY session, local), Jules (REST API → GitHub async). All three surface in the terminal tab strip and report to the model call ledger.

**Story format** — Stories are Markdown files with YAML-style frontmatter (`Status`, `Priority`, `Epic`, `Blocked By`, `Blocks`). The SQLite Kanban syncs from disk on focus and writes back atomically. Stories are the unit of work for both humans and agents.

**Governance** — `docs/reference/UX_BIBLE.md` and `TECHNICAL_BIBLE.md` define binding constraints for all contributors (human and agent). Agents are instructed to read both before implementing any story.
