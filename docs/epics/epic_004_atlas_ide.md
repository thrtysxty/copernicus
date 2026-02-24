# Epic 004: ATLAS IDE — Industrial Agentic OS

**Status:** APPROVED FOR IMPLEMENTATION
**Priority:** CRITICAL
**Phase:** Phase 5 — Multi-Agent Orchestration Platform
**Target Repo:** `agentic-platform`
**Authored By:** /architect
**Date:** 2026-02-24

---

## Executive Summary

ATLAS is an "Industrial-Grade" Agentic Operating System purpose-built for deterministic, multi-agent software development. It moves beyond "Chat-with-Code" to a **State-First** architecture where a persistent SQLite Ledger serves as the universal memory for all agents, subagents, and tools. 

ATLAS utilizes an adaptive, flippable UI that manages cognitive load through "Spotlight" (Center Stage) views and an "Industrial Kanban" that enforces a rigid 6-column validation pipeline (Blueprint → Engine Room → Test Bench → QA → Documenting → Done).

---

## Architectural Decision Record

### State-First Memory (The Ledger)

The core of ATLAS is the **State Ledger (Story 041)**. Unlike standard IDEs that rely on ephemeral model context, ATLAS persists every intent, PTY I/O, tool call, and agent "thought" in a structured SQLite database. This allows for **Hot-Swappable Models** (OpenRouter, Anthropic, Google) to be swapped mid-session without losing context.

### The Industrial Workflow

We implement a "Measure Twice, Cut Once" factory model. No code is written without a **Story Gate (Story 091)** and no story is "Done" without an **Automated Doc & Visual Audit (Story 092)**.

### Space-Saving Adaptive UI

To manage the complexity of three agent PTYs, a UI Canvas, a Kanban, and a Chat panel, ATLAS uses **Flippable Panels (Story 093)**. Each pane has a "Backside" for utility functions (e.g., Navigator flips to Command Deck) and a "Center Stage" button for focused work.

### Technology Stack (Updated)

| Layer | Technology | Rationale |
| :--- | :--- | :--- |
| **Shell** | Electron 33+ | Desktop distribution & OS Sandbox |
| **Editor** | Monaco Editor | VSCode engine with unified theming |
| **State** | SQLite + Zustand | Persistent Ledger + Reactive UI State |
| **Terminal** | `xterm.js` + `node-pty` | Real PTY with unified Monaco color-coding |
| **Auth** | Universal Auth (Story 085) | OpenRouter / OpenAI / OAuth support |
| **UI Prototype** | UI Canvas (Story 090) | Sandboxed JSX/TSX Live Preview |
| **Workflow** | Industrial Kanban | Rigid 6-column state machine |
| **Docs** | Doc Factory (Story 092) | Automated 3-tier docs + Visual Audit |

---

## System Architecture (Adaptive Storyboards)

| Storyboard | View Focus | Trigger |
| :--- | :--- | :--- |
| **Blueprint** | Chat (60%) + Editor (40%) | `/story` or Chat input |
| **Studio** | UI Canvas (70%) + Chat (30%) | `/architect --ui` or JSX gen |
| **Engine Room** | Editor (50%) + PTYs (50%) | `/plan` or implementation task |
| **Spotlight** | Selected Pane (95%) | "Center Stage" button click |

---

## Slash Command Registry (Shared Across All Panels)

| Command | Target | Action |
| :--- | :--- | :--- |
| `/story "Title"` | Chat/Claude | Scaffold new story & enter Blueprint mode |
| `/architect --ui` | Canvas | Switch to UI Architect & enter Studio mode |
| `/plan` | Claude | Enter Plan Mode & shift to Engine Room |
| `/delegate agent=X` | Interop | Send task to subagent PTY |
| `/capex` | Sidebar | Flip Navigator to Command Deck (Makefile) |
| `/spotlight` | Layout | Toggle Center Stage for active pane |

---

## Implementation Order & Dependencies

```
Story 077 (Foundation) ══ Story 086 (Security) ← Parallel
    │
    ├── Story 085 (Universal Auth) ← OpenAI/OpenRouter support
    │       │
    │       └── Story 079 (State-Aware Chat)
    │
    ├── Story 093 (Spotlight & Flippable UI) ← Layout Store
    │
    ├── Story 041 (State Ledger V2) ← Shared Asset Registry
    │
    ├── Story 091 (Industrial Kanban) ← Depends on 041
    │
    ├── Story 090 (UI Canvas) ← Depends on 093
    │
    └── Story 092 (Doc Factory) ← Depends on 090, 091
```

---

*Epic 004 (v2) authored by /architect. This version supersedes the 2026-02-23 draft.*
