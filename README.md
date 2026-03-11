# COPERNICUS IDE

**A multi-agent orchestration IDE for industrial software development.**

Claude, Gemini, and Jules work alongside you — and each other — inside a single Electron desktop application. You write stories. Agents implement them. The IDE tracks cost, quality, and velocity in real time.

---

## What It Does

COPERNICUS is a local desktop IDE built around the idea that LLM agents are engineering team members. Instead of copy-pasting into chat windows, you:

1. Write a story on the Kanban board
2. Assign it to Claude, Gemini, or Jules (or a custom workflow)
3. Watch the agent implement it, stream output to a terminal tab, and create a PR
4. Review the diff in the built-in Review Panel, run tsc inline, approve or request rework
5. Track cost, quality, and velocity on the CapEx dashboard

Everything runs locally except Jules (dispatches to GitHub) and whatever cloud inference providers you configure.

---

## Features

### Project Onboarding — Genesis Wizard

- **Setup wizard** — First-launch wizard collects GitHub PAT (inline, no native prompt), repo URL, project name, and LLM provider credentials
- **Project scaffolding** — Creates `docs/epics/`, `docs/stories/`, `AGENTS.md`, and agent config from selected template (solo / team / enterprise)
- **LLM story synthesis** — Sends the project brief to the configured model; synthesises an epic and a full backlog of implementation stories
- **Workspace switcher** — `Repo // {name}` in the app header is a clickable button; opens a dropdown listing recent projects with last-opened dates and an "Open Folder…" OS file picker. Switching resets editor, stories, terminal, and chat.

### Multi-Agent Orchestration

| Agent | Integration | Use case |
|-------|-------------|----------|
| **Claude** | Anthropic API + streaming | Chat, code review, context-aware Q&A |
| **Gemini CLI** | PTY session via `node-pty` | Local agentic coding, LSP-fed diagnostics |
| **Jules** | REST API → GitHub branch + PR | Async story implementation at scale |

- **Workflow Engine** — Visual SVG node canvas (agent / tool / decision / trigger / flow nodes). Build multi-step pipelines and run them against live story context.
- **Time-Travel Orchestration** — After each successful workflow node, a snapshot captures the current git SHA and workflow state. Any completed node shows a `⟳ Rewind` button; rewinding calls `git checkout <sha>` and resets downstream nodes to idle.
- **Agent Queue & Dependency Scheduler** — Queue stories with explicit `blockedBy` dependencies. Collision guard warns before dispatching a story whose blockers are incomplete. Auto-notification when stories become unblocked.
- **Model hot-swap** — Switch models mid-conversation. Context snapshots carry the prior transcript to the new model automatically.
- **Persona-role telemetry** — `model_calls` records `persona_role`; `getSessionStatsByRole` and `getAllTimeStatsByRole` surface per-persona spend in the status bar overlay.

### Development Environment

- **Monaco Editor** — Full TypeScript LSP via `typescript-language-server`. Real-time diagnostics, go-to-definition, hover docs, signature help, completions. Multi-file tabs with dirty indicators and `×` close buttons.
- **Ghost Implementation** — While a Gemini session streams, proposed changes appear as low-opacity green/red Monaco decorations in the active file. Accept or reject individual blocks (or all at once) before they land on disk. Toggle via "Ghost Mode" in the editor header.
- **Integrated Terminal** — Split-tab PTY terminal. Full keyboard input wired to the underlying shell (`terminal:input` IPC → `pty.write()`). Tabs for Local, Claude, Gemini, and Jules sessions.
- **File Tree** — Workspace explorer with binary/image detection. `Ctrl+S` saves directly.
- **Command Palette** — `Cmd+P` opens a VS Code–style palette: search bar at top, 4–6 scrollable command rows, fuzzy match with character highlighting, keyboard navigation (`↑↓ Enter Esc`).
- **UI Builder Canvas** — Drag-and-resize visual component editor backed by Monaco; agents can patch the component tree via structured output.

### Agent Review Panel

Activated automatically when a Gemini or Jules session completes:

- **Changed files list** — Left column lists every modified file; clicking shows a Monaco diff editor (added lines green, removed lines red)
- **Out-of-scope badge** — Files outside the story's declared scope flagged with `⚠ Out of scope`
- **Inline tsc** — "Run tsc" streams `npx tsc --noEmit` output into a log pane; pass/fail shown with green `✓` or red `✗ N errors`
- **Review actions** — Approve & Close (marks stories COMPLETE), Request Rework (inline note field), View PR (Jules sessions)
- **Semantic Diff Summary** — A `ReviewSummaryCard` appears in the chat thread with one-click shortcuts to "View Diff →", "Run tsc →", and "Approve →"
- **Activity bar badge** — Review icon shows a dot when a review is pending

### Project Management

- **9-lane Kanban** — Planning → Storyboarding → Sprint Planning → Development → Testing → QA → Documenting → Ready to Build → Done
- **Story Status Automation** — `gemini_session_manager.py` writes story status files on spawn (`IN PROGRESS`) and completion (`REVIEW`); layout store reacts to `stories:status-changed` push events
- **Card spotlight** — Click a card to expand its lane; rest collapse to slim vertical strips
- **Story drawer** — Inline markdown editor, model assignment, priority/type/epic selectors, Jules dispatch, Gemini dispatch with collision guard
- **SQLite persistence** — All story state written to SQLite. Stories also live as Markdown files in `docs/stories/` — git-trackable and diff-friendly
- **Queue Panel** — "Queue" subtab in the Planner: ordered dependency list, drag-to-reorder, unblock notifications, dispatch guard on out-of-order execution

### Panel Layout & Spotlight System

- **Spotlight** — Clicking the explorer, editor, or chat bookmark strip expands that pane to fill the layout and collapses the others to `w-10` vertical strips with rotated labels
- **Chat header chevron** — Collapses/expands the chat panel with a rotating `›` chevron
- **Explorer header** — Correct button set (new file, new folder, refresh, collapse all) with spotlight integration
- **Designer constraint** — Designer view only activates for UI-extension files (`.ui.tsx`, `.screen.tsx`, `.page.tsx`); other files fall back to code view

### IDE Completeness Panels

| Panel | Access | Key capability |
|-------|--------|----------------|
| **Git** | Activity bar | Stage/unstage, commit, branch checkout, new branch, GitHub PR list |
| **Codebase Search** | Activity bar | ripgrep text search + semantic vector search |
| **Diagnostics** | Activity bar | Streaming `npx tsc --noEmit`, parsed error list with file/line/col; error count badge on activity bar icon |
| **Review** | Activity bar | Monaco diff viewer, tsc runner, approve/rework actions |

### Technical Debt Heatmap

New "Heatmap" tab in the CapEx dashboard:

- File grid covering the workspace — each cell is one `.ts/.tsx/.py` file
- Three toggleable signal overlays: **Errors** (red, from tsc/LSP), **Churn** (orange, from `review_sessions.changed_files`), **Token Cost** (purple, from `model_calls`)
- Overlays stack additively; hover tooltip shows error count, churn count, and cost
- Clicking a cell opens the file in the editor

### Image Upload to Chat

- Drag-and-drop or paste (`Cmd+V`) images (PNG, JPG, WEBP, GIF, max 10MB) into the chat input
- Thumbnail preview with `×` dismiss before sending
- Vision model routing: Anthropic multipart `content` blocks / OpenAI-compat `image_url` format
- Non-vision models show an inline warning with model suggestions
- Sent images render as thumbnails in chat history with a lightbox on click

### Status Bar & Telemetry

- **Tooltips** — Every status bar item has a delayed tooltip on hover
- **Session timer** — HH:MM:SS display with ▶ / ⏸ / ■ controls. ■ ends the session and activates the CapEx gate overlay (editor and designer views blur with "Session ended" message)
- **Agent Telemetry Overlay** — Clicking the agent block opens a slide-up panel with three tabs: Activity (live per-agent tokens/cost), Session (by persona role from ledger), All-Time (cumulative by role)
- **StatusBarOverlay** — Reusable anchor-positioned overlay component; slide-up animation, Escape/outside-click dismiss

### Settings

- **Auth** — Anthropic, OpenAI, Google, OpenRouter, DeepInfra, GitHub tokens via Electron `safeStorage`
- **Models** — Active model selector with `supportsVision` flag; Ollama models discovered dynamically
- **Providers** — Correct icon set per provider, drag-to-reorder priority tiles, embedding provider priority list
- **Personas** — View, disable, or create custom personas with name, description, system prompt, model affinity, and role; persisted to DB
- **Templates** — All system workflow/prompt templates listed with name and type; click to open inline Monaco editor; Save / Reset to Default per template; user overrides stored in `template_overrides` table
- **Appearance** — Phosphor color system (green / amber / white / blue), UI density, CRT Mode toggle
- **CRT Mode** — Optional scanline + vignette overlay (`pointer-events: none`). Idle: 15% opacity scanlines. Agent running: 30% + edge glow. 3+ agents: subtle flicker animation. Off by default.
- **Hardware** — Touch Bar configuration (enable/disable, telemetry mode, 3 command slots with scrollable tray)

### Visual Design

- **Phosphor color system** — One CSS variable (`--phosphor`) drives all active states, glows, borders, and accent colors
- **VT selection block** — Active states use solid filled rectangles. No underlines, no ghost tints
- **Slide panels** — Dual-view panels translate on the X axis. `rotateY`/3D transforms forbidden (break native `<webview>` compositing)
- **Touch Bar** — macOS Touch Bar: view navigation, command tray, telemetry labels

---

## Stack

| Layer | Technology |
|-------|------------|
| IDE shell | Electron 33, Vite 5 |
| Renderer | React 18, TypeScript 5, Tailwind CSS |
| Editor | Monaco Editor, `typescript-language-server` |
| State | Zustand + persist, SQLite (`better-sqlite3`) |
| Terminal | `node-pty`, `xterm.js` |
| Charts | Recharts |
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

On first launch, the Genesis Wizard guides you through credential configuration and project setup.

---

## Agent Dispatch Toolchain

```bash
make jules STORY=docs/stories/story_NNN_title.md   # Validate + dispatch to Jules
make jules-dry STORY=...                            # Dry run — print prompt size only
make jules-preflight                                # Install deps + tsc + ipc-lint
make ipc-lint                                       # 10-check IPC compliance scanner
make tsc                                            # TypeScript type check shortcut
```

`ipc-lint` checks: bare `ipcMain.handle` without `handleIpc()` wrapper, missing envelope pattern, stale channel IDs, stray `console.log`, dead functions, and more.

---

## Project Structure

```
copernicus/
  electron/           Main process — IPC handlers, agent managers, workflow engine
    agents/           GeminiAgent
    workflow/         WorkflowEngine, SnapshotManager, node types, templates
    ipc/              Modular IPC handler files (app, git, search, diagnostics, chat…)
    managers/         Auth, Models, Stories, LSP, Jules, GitHub, Devtime…
    db/               StateLedger (model_calls, review_sessions, dispatch_queue…)
  src/renderer/       React renderer
    components/       All UI: Kanban, Editor, Terminal, Chat, Workflow, Review,
                      Git, Search, Diagnostics, CapEx, Settings, effects…
    store/            Zustand stores (layout, session, queue, commandRegistry)
    hooks/            useIpcError (enforced IPC pattern)
backend/              Flask API — devtime, story scaffolding, orchestration
src/agentic/          Python multi-agent orchestration logic
dev_orchestrator/     gemini_session_manager.py — spawn, monitor, status
docs/
  stories/            Active feature stories (Markdown + frontmatter)
  stories/completed/  Archived completed stories
  reference/          UX_BIBLE.md, TECHNICAL_BIBLE.md
scripts/              jules_assign.sh, ipc-lint.sh, generate_backlog.py…
```

---

## Architecture Notes

**IPC contract** — Every `ipcMain.handle` is wrapped in `handleIpc()` returning `{ ok: true, data }` or `{ ok: false, error }`. Every renderer call goes through `useIpcError()` + `unwrapIpc()`. Enforced by `make ipc-lint` and TypeScript types.

**Agent dispatch** — Claude (streaming, in-process), Gemini (PTY session via `gemini_session_manager.py --direct`), Jules (REST API → GitHub async). All three surface in the terminal tab strip and report to the model call ledger.

**Story format** — Stories are Markdown files with YAML-style frontmatter (`Status`, `Priority`, `Epic`, `Blocked By`, `Blocks`). The SQLite Kanban syncs from disk on focus and writes back atomically. Stories are the unit of work for both humans and agents.

**Governance** — `docs/reference/UX_BIBLE.md` and `TECHNICAL_BIBLE.md` define binding constraints for all contributors (human and agent). Agents are instructed to read both before implementing any story.
