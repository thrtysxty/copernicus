# Epic 004: ATLAS IDE — Agentic Terminal & Language Architecture Suite

**Status:** APPROVED FOR IMPLEMENTATION
**Priority:** CRITICAL
**Phase:** Phase 5 — Multi-Agent Orchestration Platform
**Target Repo:** `agentic-platform`
**Authored By:** /architect
**Date:** 2026-02-23

---

## Executive Summary

ATLAS is a custom Electron-based IDE purpose-built for multi-agent AI development workflows. It provides three real, embedded PTY terminal panes — one each for Claude Code CLI, GeminiCLI, and Jules — alongside a dedicated planning chat panel and a shared agent orchestration layer. CapEx time tracking is automatic and integral to the session lifecycle.

ATLAS does NOT fork VSCode. It uses **Electron + Monaco Editor** (the MIT-licensed engine VSCode is built on), giving us full control over the shell without inheriting 1M+ lines of upstream maintenance. The three agent CLIs run as first-class native processes inside real PTY terminals — they keep their native interfaces, keyboard shortcuts, and output rendering. ATLAS is the window that holds them together.

---

## Architectural Decision Record

### Why NOT a VSCode Fork

| Approach | Build Time | Maintenance | Control | Risk |
| :--- | :---: | :---: | :---: | :---: |
| **VSCode Fork (VSCodium base)** | 3+ months | High (upstream drift) | Full | High |
| **VSCode Extension Pack** | 2-3 weeks | Low | Limited | Low |
| **Electron + Monaco (ATLAS)** | 4-6 weeks | Low | Full | Medium |
| **Extend Python TUI (Story 076)** | 1-2 weeks | Low | Limited (no real PTY) | Low |

**Decision:** Electron + Monaco. It uses the same Monaco editor engine as VSCode, produces a distributable `.dmg`/`.deb`/`.exe`, runs native PTY terminals via `node-pty`, and requires no upstream merge strategy. Every line of code is ours.

### Why NOT Extend the Python TUI

Story 076's Python/Textual TUI remains valid for lightweight local model interactions. ATLAS supersedes it only for multi-agent workflows. Both can coexist. The TUI becomes ATLAS's fallback for headless/SSH environments.

### Technology Stack

| Layer | Technology | Rationale |
| :--- | :--- | :--- |
| Shell | Electron 33+ | macOS/Linux/Windows distribution |
| Editor | Monaco Editor (npm package) | MIT-licensed VSCode engine, no fork required |
| Terminal emulation | `xterm.js` + `node-pty` | Industry standard for embedded real PTY |
| UI Framework | React 18 + TypeScript | Component model for complex panel layout |
| Styling | Tailwind CSS | Fast, token-based design system |
| IPC | Electron contextBridge | Secure main↔renderer communication |
| CapEx tracking | SQLite via `better-sqlite3` | Reuse `devtime/schema.sql` from HPH repo |
| Planning chat | Anthropic SDK + Google Generative AI SDK | Direct API, not through CLI shells |
| State management | Zustand | Lightweight, no Redux boilerplate |
| Build | Electron Forge + Vite | Modern build toolchain |
| Tests | Vitest + Playwright | Unit + E2E |

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│  ATLAS IDE Window (Electron BrowserWindow)                          │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  Menu Bar: File | View | Agents | Tools | Help              │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌──────────────────┐  ┌────────────────────────────────────────┐  │
│  │  SIDEBAR         │  │  MAIN PANEL (tab or split view)        │  │
│  │  ─────────────   │  │                                        │  │
│  │  📁 File Tree    │  │  [Chat] [Claude] [Gemini] [Jules] [+]  │  │
│  │  🔍 Search       │  │  ─────────────────────────────────     │  │
│  │  📋 Stories      │  │  ┌─────────────────────────────────┐  │  │
│  │  📊 CapEx Log    │  │  │ Active Panel Content:           │  │  │
│  │  🤖 Agents       │  │  │  - Chat: Planning chat stream   │  │  │
│  └──────────────────┘  │  │  - Claude: xterm.js PTY         │  │  │
│                        │  │  - Gemini: xterm.js PTY         │  │  │
│                        │  │  - Jules: xterm.js PTY          │  │  │
│                        │  └─────────────────────────────────┘  │  │
│                        └────────────────────────────────────────┘  │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  STATUS BAR: 📁 ~/Projects/pims | 🌿 main | ⏱ 1h23m        │   │
│  │              🤖 Claude: 12.5k/200k | ⚡CapEx: $6,142 total  │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘

POPOUT: Telemetry Panel (separate BrowserWindow, always-on-top)
┌─────────────────────────────────────────────────────────────┐
│  AGENT TELEMETRY                          [⚙] [─] [×]       │
│  ─────────────────────────────────────────────────────────  │
│  ▼ Claude Code Session (active, 1h23m)                      │
│    ├── Tool: Read files/inventory.py     ✅ 0.3s             │
│    ├── Tool: Edit backend/routes/...     ✅ 1.2s             │
│    └── Tool: Bash ruff check             🔄 running...       │
│  ▼ Jules Task #3 (queued)                                    │
│    └── Implement Story 117 webhook                          │
│  ─ Gemini (idle)                                            │
│                                                             │
│  Tokens: Claude 12.5k in / 3.2k out | Cost: $0.042         │
└─────────────────────────────────────────────────────────────┘
```

---

## Slash Command Registry (Shared Across All Panels)

The following slash commands work identically in the Chat panel and are broadcast as keystrokes to the active agent terminal:

| Command | Target | Action |
| :--- | :--- | :--- |
| `/architect [args]` | Chat/Claude/Gemini | Switch to Architect persona |
| `/senior [args]` | Chat/Claude/Gemini | Switch to Senior Dev persona |
| `/junior [args]` | Chat/Claude/Gemini | Switch to Junior Dev persona |
| `/product [args]` | Chat/Claude | Switch to Product Owner persona |
| `/story "Title"` | Claude | Scaffold new story file |
| `/delegate agent=jules task="..."` | Interop | Send task to Jules terminal |
| `/forward agent=gemini` | Interop | Copy last output to Gemini input |
| `/capex` | CapEx | Show current session stats |
| `/report month=YYYY-MM` | CapEx | Print CapEx report |
| `/plan` | Claude | Enter Claude Code plan mode |
| `/clear` | Active panel | Clear current terminal/chat |

---

## CapEx Tracking Integration

On workspace open, ATLAS auto-starts a dev session using the devtime SQLite schema (imported from HPH's `scripts/devtime/schema.sql`). The session is associated with the active git repo's current story (detected from `.devtime_active` lockfile or inferred from the most recently modified story file).

**Auto-detection logic:**
1. Check for active HPH `devtime.db` in the project directory
2. Read current git branch and most-recently-modified `docs/dev/stories/*.md`
3. Infer entity: if story file contains "PIMS" → `entity=PIMS`, else `entity=HPH`
4. Start session timer; display in status bar
5. On ATLAS quit: modal prompts "Describe today's work:" (one field), writes to DB

**Status bar display:**
```
⏱ 1h23m  |  CapEx: $6,142 total (PIMS / eol_webhook)
```

---

## Story 077: Foundation — Electron + Monaco Scaffold

**Status:** READY FOR IMPLEMENTATION
**Estimate:** L (4-8 hours)
**Blocking:** All other stories

### Narrative
As a Developer, I want an Electron application that launches with Monaco editor and a basic three-tab terminal panel, so that I have a working scaffold for all subsequent features.

### Acceptance Criteria

1. **Repo scaffold** at project root:
   ```
   atlas/
   ├── package.json           (Electron Forge config)
   ├── electron.vite.config.ts
   ├── src/
   │   ├── main/
   │   │   ├── index.ts       (Electron main process)
   │   │   ├── pty.ts         (node-pty PTY management)
   │   │   ├── ipc.ts         (IPC channel definitions)
   │   │   └── devtime.ts     (SQLite devtime manager)
   │   ├── renderer/
   │   │   ├── index.html
   │   │   ├── main.tsx       (React entry)
   │   │   ├── App.tsx        (root layout)
   │   │   ├── components/
   │   │   │   ├── Sidebar.tsx
   │   │   │   ├── TabBar.tsx
   │   │   │   ├── TerminalPane.tsx    (xterm.js wrapper)
   │   │   │   ├── ChatPanel.tsx      (planning chat)
   │   │   │   ├── StatusBar.tsx
   │   │   │   └── TelemetryPopout.tsx
   │   │   └── store/
   │   │       ├── agents.ts          (Zustand: agent state)
   │   │       ├── capex.ts           (Zustand: CapEx session)
   │   │       └── workspace.ts       (Zustand: working dir, git)
   │   └── preload/
   │       └── index.ts       (contextBridge API)
   ├── resources/
   │   └── devtime_schema.sql (copy of HPH devtime schema)
   └── forge.config.ts
   ```

2. **Three terminal tabs** launch on startup:
   - Tab 1: "Claude" — runs `claude` binary (auto-detected from PATH)
   - Tab 2: "Gemini" — runs `gemini` binary
   - Tab 3: "Jules" — runs `jules` or `jules-cli` binary
   - Each tab shows a "CLI not found" message with install instructions if binary is missing
   - Terminals use `xterm.js` v5+ with full PTY (resize, color, mouse support)

3. **Monaco editor sidebar** renders the currently selected file from the file tree.

4. **Status bar** shows: working directory, git branch (via child_process `git rev-parse --abbrev-ref HEAD`).

5. **App launches** on macOS with `npm start` and exits cleanly with Cmd+Q.

### Key Dependencies

```json
{
  "electron": "^33.0.0",
  "electron-forge": "^7.0.0",
  "@electron-forge/plugin-vite": "latest",
  "react": "^18.0.0",
  "react-dom": "^18.0.0",
  "@monaco-editor/react": "^4.6.0",
  "xterm": "^5.3.0",
  "xterm-addon-fit": "^0.8.0",
  "xterm-addon-web-links": "^0.9.0",
  "node-pty": "^1.0.0",
  "better-sqlite3": "^9.0.0",
  "zustand": "^4.5.0",
  "tailwindcss": "^3.4.0",
  "@anthropic-ai/sdk": "^0.24.0",
  "@google/generative-ai": "^0.12.0"
}
```

### PTY Management (`src/main/pty.ts`)

```typescript
// Each agent terminal is a separate PTY process
interface AgentPty {
  id: 'claude' | 'gemini' | 'jules';
  pty: IPty;
  cols: number;
  rows: number;
}
```

IPC channels:
- `pty:create` → Main spawns PTY, returns id
- `pty:data` → Main→Renderer: terminal output
- `pty:write` → Renderer→Main: user keystrokes
- `pty:resize` → Renderer→Main: terminal resize
- `pty:kill` → Renderer→Main: terminate process

### Definition of Done

- [ ] `npm start` launches ATLAS with three terminal tabs
- [ ] Each terminal renders a real shell (bash/zsh fallback if CLI not found)
- [ ] Terminals are independently scrollable and resizable
- [ ] Monaco editor opens when a file is clicked in the sidebar
- [ ] Status bar shows working directory and git branch
- [ ] App quits cleanly; no zombie node-pty processes

---

## Story 078: Shared Slash Command Registry

**Status:** READY FOR IMPLEMENTATION
**Estimate:** M (2-4 hours)
**Blocked by:** Story 077

### Narrative
As a Developer, I want slash commands typed in the Chat panel to be automatically dispatched to the correct agent terminal, so that I can control all three CLIs from a single input without switching focus.

### Acceptance Criteria

1. **Command registry** at `src/renderer/commands/registry.ts`:
   ```typescript
   interface SlashCommand {
     name: string;           // e.g., 'architect'
     target: AgentTarget;    // 'claude' | 'gemini' | 'jules' | 'chat' | 'all'
     description: string;
     handler?: (args: string) => void;  // local handler (optional)
     // If no handler: command is written as text to the target terminal PTY
   }
   ```

2. **Autocomplete dropdown** appears when typing `/` in any input field, showing all registered commands with descriptions. Arrow keys navigate, Enter selects, Escape dismisses.

3. **Command routing:**
   - `/architect`, `/senior`, `/junior`, `/product` → writes to active terminal's PTY input as text (the target CLI handles interpretation)
   - `/delegate agent=jules task="..."` → focuses Jules tab, writes task text to Jules PTY input
   - `/forward agent=gemini` → copies last agent response to clipboard AND types it into Gemini PTY input
   - `/capex` → opens CapEx sidebar panel (local handler)
   - `/plan` → focuses Claude tab, writes `/plan` to Claude PTY

4. **Commands work in** Chat panel input, status bar quick-input (`Ctrl+P`), and each terminal's overlay input (`Ctrl+Shift+P`).

5. **Command file** at `src/renderer/commands/commands.ts` — all commands defined here, no hardcoding elsewhere.

### Definition of Done

- [ ] `/` in Chat panel shows autocomplete with all commands
- [ ] `/architect read the story and plan` writes that text into Claude's PTY
- [ ] `/delegate agent=jules task="implement webhook"` focuses Jules tab and writes
- [ ] `/forward agent=gemini` pastes Claude's last output into Gemini's input
- [ ] `/capex` opens the CapEx panel
- [ ] Unknown commands show an error inline

---

## Story 079: Planning Chat Panel

**Status:** READY FOR IMPLEMENTATION
**Estimate:** L (4-8 hours)
**Blocked by:** Story 077, 078

### Narrative
As a Developer, I want a dedicated chat panel that communicates directly with Claude or Gemini APIs (not through their CLI tools), so that I can do planning and architecture work without polluting my coding agent's context window.

### Acceptance Criteria

1. **Chat panel** is the first tab ("Chat") with a vertical scroll stream:
   - User messages: right-aligned, slate background
   - Assistant messages: left-aligned, collapsible for long responses
   - Markdown rendering with syntax highlighting
   - Inline file references: `@filename.py` auto-attaches file content

2. **Model selector** in the chat toolbar:
   - `claude-sonnet-4-6` (default)
   - `claude-opus-4-6`
   - `gemini-2.0-flash` (fast/free)
   - `gemini-2.0-pro`
   - Model selector persists to `~/.atlas/preferences.json`

3. **Authentication** is fully delegated to `AuthManager` (Story 085):
   - Chat Panel calls `AuthManager.getToken(provider)` for every API request
   - Supports all methods: existing CLI OAuth files, env vars, PKCE browser flow, manual key
   - No auth logic in Chat Panel itself — it only knows "give me a token"
   - See Story 085 for the full credential priority ladder and security constraints

4. **Context injection:**
   - `@file path/to/file` attaches file content to the current message
   - `@story story_077` attaches the story file content
   - `@git-diff` attaches `git diff HEAD` output
   - All `@` references shown as chips in the input area

5. **Token display** per message:
   - `↑ 4,532 tokens | ↓ 1,205 tokens | 💰 $0.008` shown below each assistant message
   - Session total in status bar

6. **Conversation persistence:**
   - SQLite table: `chat_sessions(id, model, created_at)`, `chat_messages(id, session_id, role, content, tokens_in, tokens_out, cost_usd, created_at)`
   - `/save` exports session to Markdown
   - `/clear` starts a new session (old session archived, not deleted)

### Implementation Notes

```typescript
// src/main/chat.ts — runs in main process (has access to API keys)
async function* streamChat(
  messages: Message[],
  model: string,
  apiKey: string
): AsyncGenerator<string> {
  // Use Anthropic SDK streaming for claude-* models
  // Use Google SDK streaming for gemini-* models
}
```

IPC: `chat:stream` — Main→Renderer: streaming token chunks

### Definition of Done

- [ ] Chat panel renders with model selector
- [ ] Claude and Gemini messages stream with token counts
- [ ] `@file` and `@story` context injection works
- [ ] Conversation persists across app restarts
- [ ] `/save` exports to Markdown

---

## Story 080: CapEx Tracker Integration

**Status:** READY FOR IMPLEMENTATION
**Estimate:** M (2-4 hours)
**Blocked by:** Story 077
**Note:** This story is Preliminary Project Stage for PIMS — NOT capitalizable itself.

### Narrative
As a Developer, I want CapEx time tracking to start automatically when ATLAS opens and close automatically when I quit, so that I never forget to log development hours and every PIMS session is captured for ASC 350-40 compliance.

### Acceptance Criteria

1. **On workspace open**, ATLAS shows a one-time modal (if no active session):
   ```
   ┌────────────────────────────────────┐
   │ Start Dev Session                  │
   │                                    │
   │ Entity:    [PIMS ▼] / [HPH]        │
   │ Component: [eol_webhook      ▼]    │
   │ Phase:     [APPLICATION_DEV  ▼]    │
   │ Story:     [story_117        ▼]    │
   │                                    │
   │ [Start Session]  [Skip Tracking]   │
   └────────────────────────────────────┘
   ```
   - Entity, Component, Phase pre-filled from smart defaults (see below)
   - Story dropdown populated from `docs/dev/stories/*.md` files in workspace
   - Modal dismisses in < 3 seconds if user hits Enter twice

2. **Smart defaults:**
   - Entity: inferred by scanning story file for "PIMS" keyword → PIMS, else HPH
   - Phase: defaults to APPLICATION_DEVELOPMENT if entity=PIMS
   - Component: last-used component (persisted in `~/.atlas/preferences.json`)

3. **Status bar** shows live session timer and running CapEx total:
   ```
   ⏱ 1h23m  |  PIMS/eol_webhook  |  CapEx: $6,209 total
   ```
   Timer ticks every minute.

4. **On ATLAS quit (Cmd+Q):**
   - If active session: show close modal:
     ```
     ┌──────────────────────────────────────────┐
     │ Close Dev Session                         │
     │                                           │
     │ Duration: 1.75h (rounded from 1h42m)      │
     │ Capitalizable: YES ✅ ($113.75)           │
     │                                           │
     │ Recent commits:                           │
     │   a3f92bc  feat: implement eol webhook    │
     │   d819f01  test: add webhook tests        │
     │                                           │
     │ Description: [                         ]  │
     │ Commits:     [a3f92bc d819f01           ]  │
     │                                           │
     │ [Save & Quit]  [Quit Without Saving]      │
     └──────────────────────────────────────────┘
     ```
   - "Save & Quit" writes to `devtime.db` then closes
   - "Quit Without Saving" closes without logging

5. **SQLite database** at `~/.atlas/devtime.db` (shared across all workspaces):
   - Uses schema from `resources/devtime_schema.sql` (identical to HPH's `scripts/devtime/schema.sql`)
   - Electron main process manages the connection via `better-sqlite3`
   - IPC channels: `devtime:start`, `devtime:close`, `devtime:report`, `devtime:status`

6. **Sidebar panel** "CapEx Log" shows:
   - Current session (live timer, component, capitalizable flag)
   - Monthly summary table (hours × $65/hr = asset value)
   - Quick-add button for manual entries

7. **`/capex` command** in any panel opens the CapEx sidebar and shows current stats.

### Definition of Done

- [ ] Session start modal appears on first workspace open
- [ ] Status bar shows live timer that increments
- [ ] Quit modal appears with duration, capitalizable flag, recent commits
- [ ] Session is written to `~/.atlas/devtime.db`
- [ ] `/capex report month=2026-02` prints monthly summary
- [ ] Graceful degradation: ATLAS launches normally if `devtime.db` is locked or corrupt

---

## Story 081: Status Bar & Token Display

**Status:** READY FOR IMPLEMENTATION
**Estimate:** S (< 2 hours)
**Blocked by:** Story 077, 079, 080

### Narrative
As a Developer, I want a persistent status bar showing working directory, git branch, token usage per agent, and CapEx session info, so that I always have operational context without opening secondary views.

### Acceptance Criteria

1. **Status bar** segments (left to right):
   ```
   📁 ~/Projects/pims-core  |  🌿 main  |  Claude: 12.5k/200k ↑ $0.04  |  Gemini: 2.1k/1M ↑ $0.00  |  Jules: n/a  |  ⏱ 1h23m  |  CapEx $6,209
   ```

2. **Working directory:** shows truncated path, clickable to open native file picker for workspace change.

3. **Git branch:** `git rev-parse --abbrev-ref HEAD` polled every 30 seconds, shows dirty indicator `*` if uncommitted changes.

4. **Per-agent token display:**
   - Updates after each response from Chat panel (real token counts from API)
   - For CLI terminals (Claude/Gemini/Jules): parses PTY output for token count patterns — Claude Code outputs `X tokens` in its status; Gemini CLI outputs similar
   - Falls back to `—` if CLI doesn't expose token counts
   - Shows `in/context_limit` format (e.g., `12.5k/200k`)

5. **CapEx segment:** live timer + running total in USD. Clicking opens CapEx sidebar.

6. **Agent status indicators** in tab bar (not status bar):
   - 🟢 Active (streaming)
   - 🟡 Idle (waiting for input)
   - 🔴 Error (non-zero exit or stall detection)

### Definition of Done

- [ ] Status bar renders all segments
- [ ] Working directory updates when terminal `cd`s (tracked via PTY output parsing for shell prompts)
- [ ] Git branch updates every 30s
- [ ] Chat panel token counts appear after each response
- [ ] CapEx timer ticks in the status bar

---

## Story 082: Agent Interop — Cross-Agent Task Delegation

**Status:** READY FOR IMPLEMENTATION
**Estimate:** M (2-4 hours)
**Blocked by:** Story 077, 078

### Narrative
As a Developer, I want to delegate tasks between agents without switching terminals, so that I can ask Claude to plan something and then send the plan directly to Jules for implementation without copy-pasting.

### Acceptance Criteria

1. **`/delegate agent=jules task="..."` command:**
   - Focuses the Jules terminal tab
   - Types the task text into Jules's PTY input (simulates keystrokes)
   - Optional: prefixes with a context header listing current files

2. **`/forward agent=gemini` command:**
   - Takes the last N lines of the current panel's output
   - Writes them to the target agent's PTY input as context
   - Useful for: "Claude produced analysis → send to Gemini for a second opinion"

3. **Shared clipboard buffer** (`Ctrl+Shift+C` in any terminal):
   - Copies selected text to a named "Agent Clipboard" stored in Zustand
   - `Ctrl+Shift+V` pastes Agent Clipboard into the currently focused terminal
   - Agent Clipboard is visible as a floating badge: "📋 312 chars in buffer"

4. **Context forwarding via `@last` reference in Chat panel:**
   - `@last-claude` injects the last N lines from the Claude terminal
   - `@last-jules` injects the last N lines from Jules
   - Combined with planning: "Claude analyzed the requirements [@last-claude]. Jules, please implement this."

5. **No automatic agent-to-agent calls** without user approval. ATLAS does not autonomously route tasks. All interop is explicitly user-initiated via commands or keyboard shortcuts.

### Definition of Done

- [ ] `/delegate agent=jules task="..."` focuses Jules and types the task
- [ ] `/forward agent=gemini` copies active terminal output to Gemini
- [ ] Agent Clipboard copy/paste works between all three terminals
- [ ] `@last-claude` in Chat panel injects last Claude output
- [ ] No autonomous routing without explicit user command

---

## Story 083: Telemetry Popout Panel

**Status:** READY FOR IMPLEMENTATION
**Estimate:** M (2-4 hours)
**Blocked by:** Story 077, 081

### Narrative
As a Developer, I want a dedicated popout window showing live agent task state, subagent hierarchy, and token usage so that I can monitor what my agents are doing without losing my place in the main IDE.

### Acceptance Criteria

1. **Popout window** opens via `View > Telemetry` or `Ctrl+Shift+T`:
   - Separate `BrowserWindow` (not a panel in the main window)
   - `alwaysOnTop: true` option (toggleable)
   - Resizable, position persisted to `~/.atlas/preferences.json`
   - Minimum size: 400×300

2. **Telemetry data sources:**

   | Agent | How Telemetry is Captured |
   | :--- | :--- |
   | Claude Code CLI | Parse PTY output: tool names, durations, token lines match Claude Code's output format |
   | GeminiCLI | Parse PTY output for Gemini's status messages |
   | Jules | Parse PTY output for Jules task IDs and status |
   | Chat Panel | Direct from Anthropic/Google SDK responses |

3. **Display layout:**
   ```
   AGENT TELEMETRY                                 [📌 Pin] [×]
   ─────────────────────────────────────────────────────────────
   ▼ Claude Code  [active]  ⏱ 1h23m  ↑12.5k ↓3.2k  💰$0.042
     ├─ ✅ Read     backend/models/inventory.py       0.3s
     ├─ ✅ Edit     backend/routes/inventory.py        1.2s
     └─ 🔄 Bash    ruff check --fix                   running...

   ▷ Jules  [idle]
     └─ Queued: "Implement Story 117 webhook"

   ─ Gemini  [idle]

   ─────────────────────────────────────────────────────────────
   Session totals:
   Claude: 12.5k / 3.2k tokens | $0.042
   Gemini: 2.1k / 0.8k tokens  | $0.001
   CapEx session: 1h23m → PIMS/eol_webhook → $90.75
   ```

4. **PTY output parsing** for Claude Code tool events:
   - Claude Code CLI outputs structured lines like `⎿  Read backend/models/inventory.py` and `⎿  Bash ruff check`
   - ATLAS parses these via regex in the PTY data stream
   - Parsed events are stored in `agents` Zustand store: `AgentTask[]`
   - Popout subscribes to the store via IPC

5. **Subagent awareness:**
   - If Claude Code spawns a Task (subagent), it appears as a child node in the tree
   - Detection: Claude Code's output includes indented subagent blocks with their own tool calls
   - Display: collapsible tree node with "subagent" badge

6. **Auto-clear:** Completed tasks older than 5 minutes are collapsed (not deleted) to keep the view readable.

### PTY Parsing Interface

```typescript
// src/main/telemetry-parser.ts
interface AgentEvent {
  agentId: 'claude' | 'gemini' | 'jules' | 'chat';
  type: 'tool_start' | 'tool_end' | 'tool_error' | 'message' | 'subagent_start';
  toolName?: string;
  args?: string;
  duration?: number;
  tokensIn?: number;
  tokensOut?: number;
  timestamp: Date;
}
```

### Definition of Done

- [ ] Popout window opens with `Ctrl+Shift+T`
- [ ] Claude Code tool events (Read, Edit, Bash) appear as tree nodes in real time
- [ ] Completed tools show duration and checkmark
- [ ] Running tools show spinner
- [ ] Session token totals and cost display correctly
- [ ] Popout persists position across restarts
- [ ] Closing popout doesn't quit ATLAS

---

## Story 084: Distribution & Packaging

**Status:** READY FOR IMPLEMENTATION
**Estimate:** S (< 2 hours)
**Blocked by:** All other stories

### Narrative
As a Developer, I want ATLAS to be installable as a native macOS app with a single command, so that I don't need to clone the repo and run `npm start` every time.

### Acceptance Criteria

1. **`npm run make`** produces:
   - macOS: `.dmg` installer
   - Linux: `.deb` and `.AppImage`

2. **Auto-update** via `electron-updater`:
   - Checks for updates from the GitHub releases page on launch
   - Shows notification: "ATLAS 1.1.0 available. [Update Now] [Later]"

3. **First-run wizard** (shown once, on first launch):
   - Step 1: "Detect CLI tools" — scans PATH for `claude`, `gemini`, `jules`. Shows found/not-found status with install links.
   - Step 2: "API Keys" — prompts for Anthropic and Google AI keys, stores in OS keychain.
   - Step 3: "Set workspace" — opens folder picker to set default workspace directory.
   - Step 4: "CapEx setup" — asks entity/rate (default $65/hr) with explanation.

4. **`~/.atlas/` directory** created on first run:
   ```
   ~/.atlas/
   ├── preferences.json    (UI state: window size, last tab, model selection)
   ├── devtime.db          (CapEx SQLite database)
   ├── permissions.yaml    (agent permission allowlist)
   └── chat_history.db     (planning chat history)
   ```

5. **Crash reporter** logs to `~/.atlas/logs/` — no external telemetry, all local.

### Definition of Done

- [ ] `npm run make` produces distributable without errors
- [ ] `.dmg` installs and launches on macOS
- [ ] First-run wizard completes without errors
- [ ] `~/.atlas/` structure created correctly
- [ ] Auto-update check fires on launch (can be disabled in preferences)

---

## Amendment: Story 085 — Universal Auth Manager

**Added:** 2026-02-23. See `docs/stories/story_085_atlas_auth_manager.md` for full spec.

Story 079 (Chat Panel) originally assumed API key entry as the sole auth method.
This is insufficient: Gemini CLI and Jules already store OAuth credentials on disk
(`~/.gemini/oauth_creds.json`, `~/.config/gcloud/application_default_credentials.json`)
and users expect the same site-login OAuth redirect UX they have in VSCode.

**Story 085 adds:**
- `AuthManager` that resolves credentials via a priority ladder:
  existing CLI credential files → env vars → ATLAS PKCE browser flow → manual key
- Google token auto-refresh from `~/.gemini/oauth_creds.json` without user interaction
- Anthropic: `ANTHROPIC_API_KEY` env var → Claude.ai PKCE OAuth flow → manual key entry
- Bearer token passthrough for any future/custom provider
- Raw tokens confined to Electron main process; renderer only sees `AuthStatus`
- `Settings > Authentication` panel showing method and account per provider

Story 085 **blocks** Story 079. Story 084 first-run wizard auth step defers to Story 085.

---

## Amendment: Story 086 — Security Boundary Layer

**Added:** 2026-02-23. See `docs/stories/story_086_atlas_security_boundary.md` for full spec.

The original epic did not account for the risk of uncontainerized CLI agents with
unrestricted access to the host filesystem, network, and environment variables.

**Story 086 adds (process-level, no Docker):**
- `env-sanitizer.ts` — strips `SSH_AUTH_SOCK`, `AWS_*`, `*_TOKEN`, `*_SECRET`,
  `*_PASSWORD`, and similar vars from the environment passed to CLI processes
- Working directory enforcement — CLI processes spawn in workspace root, not `$HOME`
- `pty-auditor.ts` — logs all PTY I/O to `~/.atlas/logs/pty-{agent}-{date}.log`
- `pattern-detector.ts` — scans output for 16 named risk patterns (CRITICAL/HIGH/MEDIUM);
  shows coloured alert banners in the terminal tab header
- `git-guard.ts` — intercepts ATLAS-injected `git push` commands; requires confirmation
- `sandbox-manager.ts` — optional OS-level sandbox via `sandbox-exec` (macOS) or
  `firejail` (Linux); user opt-in per agent in Settings

Story 086 **ships with Story 077** (integrated before first release, not after).
It is parallel work, not blocked by anything.

---

## Implementation Order & Dependencies

```
Story 077 (Foundation) ══ Story 086 (Security) ← parallel, ships together
    │
    ├── Story 085 (Auth Manager)  ← blocks 079
    │       │
    │       └── Story 079 (Chat Panel)
    │
    ├── Story 078 (Slash Commands)
    │       │
    │       └── Story 082 (Agent Interop) ← 086 git-guard hooks here
    │
    ├── Story 080 (CapEx Tracker)
    │
    ├── Story 081 (Status Bar)  ← depends on 079, 080, 086 (security indicator)
    │
    └── Story 083 (Telemetry)   ← depends on 081; shows security alert section
            │
            └── Story 084 (Packaging) ← depends on all
```

**Recommended delivery sequence for Jules:**
1. Story 077 + 086 (terminals + security boundary — ship together, parallel work)
2. Story 085 (Auth Manager — unblocks Chat Panel; no new npm deps needed)
3. Story 080 (CapEx — high business value, low complexity)
4. Story 078 (Slash commands — low complexity, high daily use)
5. Story 079 (Chat panel — now auth-capable via AuthManager)
6. Story 081 (Status bar — polish, pulls from 079/080)
7. Story 082 (Interop — medium complexity, high value)
8. Story 083 (Telemetry — medium complexity)
9. Story 084 (Packaging — last, after everything works)

---

## Estimates Summary

| Story | Title | Estimate | Notes |
| :--- | :--- | :--- | :--- |
| 077 | Foundation | L (4-8h) | Hardest story; PTY + Electron scaffold |
| 085 | Auth Manager | M (2-4h) | File readers + PKCE flow; no new deps |
| 078 | Slash Commands | M (2-4h) | Registry pattern is clean |
| 079 | Chat Panel | L (4-8h) | Streaming + context injection |
| 080 | CapEx Tracker | M (2-4h) | SQLite reuse from HPH schema |
| 081 | Status Bar | S (< 2h) | Composites from earlier stories |
| 082 | Agent Interop | M (2-4h) | PTY write + clipboard |
| 083 | Telemetry Popout | M (2-4h) | PTY parsing regex is the hard part |
| 084 | Packaging | S (< 2h) | Electron Forge handles most of it |
| **Total** | | **~27-44h** | Parallelizable after Story 077 |

---

## Constraints & Risks

| Risk | Likelihood | Impact | Mitigation |
| :--- | :--- | :--- | :--- |
| `node-pty` native module issues on Linux | Medium | High | Pre-build native modules in Forge config; test on target OS early |
| Claude Code CLI output format changes break PTY parser | Medium | Medium | Parser is isolated in `telemetry-parser.ts`; easy to patch |
| Gemini CLI or Jules CLI binary not standardized | Medium | High | Configurable binary paths in `preferences.json`; graceful "not found" UI |
| `better-sqlite3` native module in Electron renderer | High | Medium | Must use IPC + main process for all DB operations (no direct renderer DB access) |
| Token count parsing from PTY output is fragile | Medium | Low | Telemetry is additive/optional; ATLAS works fine without accurate token counts |

---

## Out of Scope (Explicitly)

- Voice input/output
- Cloud sync of CapEx data or chat history
- Collaborative multi-user editing
- Custom language server protocol (LSP) integration (use Monaco's built-in language support)
- Git GUI (use the integrated terminal for git operations)
- Docker/container management UI
- Any web-accessible version (ATLAS is a local desktop app only)

---

## For Jules: Getting Started

This epic is self-contained. You do not need context from the `high-plains-hipster` repo. Start with Story 077.

**Environment prerequisites:**
```bash
node --version   # v20+
npm --version    # v10+
# Verify target CLIs are installed:
which claude     # Anthropic Claude Code CLI
which gemini     # Google GeminiCLI
which jules      # Jules CLI (check: https://jules.google.com)
```

**Bootstrap:**
```bash
mkdir atlas && cd atlas
npx create-electron-app@latest . --template=vite-typescript
npm install xterm xterm-addon-fit node-pty @monaco-editor/react better-sqlite3 zustand tailwindcss @anthropic-ai/sdk @google/generative-ai
npm install -D @types/better-sqlite3 @electron-forge/plugin-vite
```

**First commit target:** A working Electron window with three terminal tabs, each running the system default shell (`$SHELL`). The CLIs are wired in Story 077 Task 2 once the basic PTY scaffold works.

---

*Epic 004 authored by /architect for the agentic-platform repo. Commit to `docs/epics/epic_004_atlas_ide.md` before beginning implementation.*
