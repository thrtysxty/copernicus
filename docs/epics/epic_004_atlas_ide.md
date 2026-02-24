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
**See:** `docs/stories/story_077_atlas_foundation.md`

---

## Story 078: Shared Slash Command Registry

**Status:** READY FOR IMPLEMENTATION
**See:** `docs/stories/story_078_atlas_slash_commands.md`

---

## Story 079: Planning Chat Panel

**Status:** READY FOR IMPLEMENTATION
**See:** `docs/stories/story_079_atlas_planning_chat.md`

---

## Story 080: CapEx Tracker Integration

**Status:** READY FOR IMPLEMENTATION
**See:** `docs/stories/story_080_atlas_capex_tracker.md`

---

## Story 089: Status Bar & Token Display

**Status:** READY FOR IMPLEMENTATION
**See:** `docs/stories/story_089_atlas_status_bar.md`

---

## Story 082: Agent Interop — Cross-Agent Task Delegation

**Status:** READY FOR IMPLEMENTATION
**See:** `docs/stories/story_082_atlas_agent_interop.md`

---

## Story 083: Telemetry Popout Panel

**Status:** READY FOR IMPLEMENTATION
**See:** `docs/stories/story_083_atlas_telemetry_popout.md`

---

## Story 084: Distribution & Packaging

**Status:** READY FOR IMPLEMENTATION
**See:** `docs/stories/story_084_atlas_distribution.md`

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
    ├── Story 089 (Status Bar)  ← depends on 079, 080, 086 (security indicator)
    │
    └── Story 083 (Telemetry)   ← depends on 089; shows security alert section
            │
            └── Story 084 (Packaging) ← depends on all
```

**Recommended delivery sequence for Jules:**
1. Story 077 + 086 (terminals + security boundary — ship together, parallel work)
2. Story 085 (Auth Manager — unblocks Chat Panel; no new npm deps needed)
3. Story 080 (CapEx — high business value, low complexity)
4. Story 078 (Slash commands — low complexity, high daily use)
5. Story 079 (Chat panel — now auth-capable via AuthManager)
6. Story 089 (Status bar — polish, pulls from 079/080)
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
| 089 | Status Bar | S (< 2h) | Composites from earlier stories |
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
