# Documentation Audit Report
**Date:** 2026-04-16  
**Auditor:** Claude (Story 672)  
**Scope:** README.md, docs/reference/*.md, docs/help/*.md

---

## Executive Summary

This audit identifies gaps between current documentation and Phase 6 reality. The codebase has shipped 670+ stories including Agent Hub (stories 634-668), Org Chart UI (646), Hub Ledger (647), and MLX native inference (652/652b). Documentation contains stale references, outdated view names, and missing Phase 6 features.

**Key Finding:** `docs/help/` user guides reference deprecated UI concepts (Blueprint/Studio/Engine Room view names) that do not match the current ActivityBar view names (Planner/Editor/Designer/Orchestrator). This is HIGH priority as it confuses new users.

---

## Gap Report by File

### README.md — Overall Status: GOOD with MINOR gaps

**What's Current:**
- Apple Silicon MLX section present and accurate (added by Jules, story 652b) ✅
- CCR dispatch model documented ✅
- Provider registry includes Anthropic, OpenRouter, Ollama, MLX ✅
- Phase 6 roadmap table present (stories 634-648) ✅

**Gaps Found:**

| Line | Gap | Priority | Proposed Fix |
|------|-----|----------|--------------|
| 297-299 | Outdated dispatch scripts reference: `gemini CLI (yolo mode)` — CCR replaced Gemini CLI | LOW | Replace with `ccr code --dangerously-skip-permissions` |
| 443 | PHASE6_AGENT_HUB.md link may be stale (document shows "Pre-Implementation") | MEDIUM | Update PHASE6_AGENT_HUB.md status or add note |

**Estimated Fix Scope:** 2-3 lines

---

docs/reference/TECHNICAL_BIBLE.md — Status: NEEDS UPDATES

**What's Current:**
- IPC standards (`handleIpc()`, `useIpcError`) accurate ✅
- Store architecture matches implementation ✅
- LSP guardrail section accurate ✅

**Gaps Found:**

| Section | Gap | Priority | Proposed Fix |
|---------|-----|----------|--------------|
| §8.4 Dispatch Deduplication | Mentions `jules_sessions` table but doesn't reference Hub token deduplication | LOW | Add cross-reference to Hub token schema |
| §8.6 Dynamic Model Selection | Mentions Ollama tool shim; CCR is now primary dispatch | MEDIUM | Update to describe CCR dispatch pattern |
| §21 Dogfooding Harness | Review gate script exists but `ipc-lint.sh` command incomplete | LOW | Verify `make ipc-lint` still works or update |
| Missing Section | No Agent Hub token schema documentation | MEDIUM | Add §22: Hub Token Schema reference |

**Estimated Fix Scope:** ~50 lines (new section + updates)

---
ndocs/reference/UX_BIBLE.md — Status: MOSTLY CURRENT

**What's Current:**
- Layout specifications accurate ✅
- VT block selection pattern documented ✅
- Panel system (Spotlight, Flip) accurate ✅
- Kanban 9 lanes correct ✅
- Story card anatomy with Jules badge accurate ✅

**Gaps Found:**

| Section | Gap | Priority | Proposed Fix |
|---------|-----|----------|--------------|
| §1.5 Activity Bar | Icon list outdated — missing Agent Memory, Review, Testing, Git, Debug, Browser, Database, Agent Hub | MEDIUM | Add new navigation items with correct order |
| §2 Views | View names reference old F-key mapping (Blueprint F1, Studio F2) not matching current ActivityBar labels | HIGH | Update to current view names: Planner, Editor, Designer, Orchestrator, Telemetry, Reporter |
| §2.6 Command Center | Description accurate but view ID shows `command-center` — actual display label is "Telemetry" | LOW | Clarify view ID vs display name |
| Missing Section | No Org Chart UI documentation (story 646 shipped) | MEDIUM | Add §X: Org Chart Panel specification |
| Missing Section | No Hub Ledger panel documentation (story 647 shipped) | MEDIUM | Add §X: Hub Ledger Panel specification |
| Missing Section | No MLX Panel documentation (story 652 shipped) | MEDIUM | Add §X: MLX Provider Panel specification |

**Estimated Fix Scope:** ~100 lines ( ActivityBar update + 3 new panel sections)

---

docs/reference/USER_WORKFLOW.md — Status: SIGNIFICANTLY STALE

**Critical Issue:** This document describes a 5-step wizard flow and view names ("Blueprint", "Studio", "Engine Room") that do not match the current IDE UI.

**Gaps Found:**

| Section | Gap | Priority | Proposed Fix |
|---------|-----|----------|--------------|
| Throughout | Uses deprecated view names: "Blueprint F1", "Studio F2", "Engine Room F3" instead of current ActivityBar labels | HIGH | Replace with current view names: Planner, Editor, Designer, Orchestrator, Telemetry |
| Act 2 — The Wizard | Describes 5-step wizard; actual wizard may differ | MEDIUM | Verify current wizard steps against implementation |
| Act 3 — First Look | References "Designer view" — actual view is "Designer" | MEDIUM | Update view references |
| Provider Rhythm | Mentions "Persona tab" context handoff — verify this UI exists | LOW | Confirm feature shipped |

**Estimated Fix Scope:** Full rewrite recommended (~200 lines)

---

docs/reference/CLAUDE_CODE_ROUTER.md — Status: STALE

**Critical Issues:**

| Line | Gap | Priority | Proposed Fix |
|------|-----|----------|--------------|
| All | Port shows 3456; actual CCR port is 9669 | HIGH | Update port throughout |
| 13-23 | Route table outdated — `default` route shows kimi-k2.5 but memory indicates nemotron-3-super; `background` route shows claude-sonnet but should be local model | HIGH | Update route table per memory: default=nemotron-3-super, think=opus-4-6, longContext=opus-4-6 |
| 16 | Background route references `claude-sonnet-4-6` via Ollama — this is wrong | HIGH | Background route should be local Ollama model (gemma4:e4b per memory) |
| Missing Section | No Provider Route Precedence section (story 669) | HIGH | Add route precedence table: default < think < longContext |

**Estimated Fix Scope:** Full rewrite required (~120 lines)

---

docs/reference/PHASE6_AGENT_HUB.md — Status: OUTDATED HEADER

**Gap:** Document header shows `Status: Vision / Pre-Implementation` but stories 634-668 have shipped.

| Section | Gap | Priority | Proposed Fix |
|---------|-----|----------|--------------|
| Line 3 | Status: "Vision / Pre-Implementation" — stories COMPLETE | HIGH | Update status: "Phase 6 Shipped — Foundation Complete" |
| §Phase 6 Story Sequence | Shows ordered/unordered stories; actual completion status needed | MEDIUM | Add completion status column |

**Estimated Fix Scope:** 5-10 lines

---

docs/help/USER_GUIDE.md — Status: SIGNIFICANTLY STALE

**Critical Issue:** Uses deprecated view names throughout.

| Section | Gap | Priority | Proposed Fix |
|---------|-----|----------|--------------|
| §1.1 Storyboards | "Blueprint F1", "Studio F2", "Engine Room F3" — actual names are Planner, Editor, Designer, Orchestrator, Telemetry | HIGH | Replace all F-key references with current ActivityBar view names |
| §2 Chat Panel | "Studio (F2)" reference | HIGH | Replace with "Editor view" |
| §3 Kanban | "Blueprint (F1)" reference | HIGH | Replace with "Planner view" |
| §6 Agent Review | "Blueprint view (F1)" reference | HIGH | Replace with "Planner view" |
| §7 CapEx | "F4" reference | MEDIUM | Replace with "Reporter view" |
| §8 Settings | Tab list incomplete — missing Org Chart, Hub Ledger | MEDIUM | Update settings tab list |
| §9 NotebookLM | Still marked pending (Stories 432-433) | LOW | Verify status or update |

**Estimated Fix Scope:** Full rewrite recommended (~180 lines)

---

docs/help/PROVIDER_SETUP_GUIDE.md — Status: MOSTLY CURRENT

**Gaps Found:**

| Section | Gap | Priority | Proposed Fix |
|---------|-----|----------|--------------|
| Missing Section | No MLX (Apple Silicon) setup instructions | MEDIUM | Add MLX section with `pip install mlx-lm` and model download |
| Missing Section | No CCR (Claude Code Router) setup | MEDIUM | Add CCR section with port 9669 and route commands |
| §7 NotebookLM | Marked pending (Stories 432-433) | LOW | Verify status |

**Estimated Fix Scope:** ~40 lines (2 new sections)

---

docs/help/WORKFLOW_BUILDER_GUIDE.md — Status: CURRENT

No significant gaps found. Template names and node types match implementation.

---

docs/help/KEYBOARD_SHORTCUTS.md — Status: STALE

**Gaps Found:**

| Issue | Priority | Proposed Fix |
|-------|----------|--------------|
| View shortcuts show F1-F5; actual ActivityBar uses ⌘1-⌘9+ | HIGH | Update to match ActivityBar shortcuts: Planner ⌘1, Editor ⌘2, Designer ⌘3, Orchestrator ⌘4, Telemetry ⌘5, Agent Memory ⌘6, Reviews ⌘7, Testing ⌘8, Source Control ⌘9, Reporter ⌘0 |
| Missing Agent Memory, Review, Testing, Git shortcuts | MEDIUM | Add missing shortcuts |

**Estimated Fix Scope:** ~30 lines

---

docs/help/BACKGROUND_SERVICES_GUIDE.md — Status: STALE MARKERS

**Gaps Found:**

| Section | Gap | Priority | Proposed Fix |
|---------|-----|----------|--------------|
| Throughout | Multiple "📌 Pending Story" markers (524, 525, 527) | MEDIUM | Verify which stories shipped; remove pending markers |
| Line 2-10 | Service table accurate | — | No change |

**Estimated Fix Scope:** 5-10 lines

---

docs/help/OPERATOR_STARTUP.md — Status: DEPRECATED CONCEPTS

**Critical Issue:** Uses "Strategic Chat" and `/plan`, `/delegate` commands that may not exist.

| Section | Gap | Priority | Proposed Fix |
|---------|-----|----------|--------------|
| Throughout | References "Strategic Chat", `/plan`, `/delegate` commands — verify these exist | HIGH | Confirm commands exist or rewrite without them |
| Step 1 | `/plan` command — verify | HIGH | Verify or remove |
| Step 3 | `/delegate` command — verify | HIGH | Verify or remove |

**Estimated Fix Scope:** Full rewrite if commands don't exist (~50 lines)

---

## ROADMAP.md Draft (for Jeremy Review)

See `ROADMAP.md` in repo root for the full Phase 7/8/Strategic Vision document.

---

## Priority Summary

### HIGH Priority (Wrong/Misleading)
1. **USER_WORKFLOW.md** — Deprecated view names (Blueprint/Studio/Engine Room)
2. **USER_GUIDE.md** — Deprecated view names and F-key references
3. **CLAUDE_CODE_ROUTER.md** — Wrong port (3456 vs 9669), wrong route table
4. **KEYBOARD_SHORTCUTS.md** — F-keys don't match ActivityBar shortcuts
5. **PHASE6_AGENT_HUB.md** — "Pre-Implementation" status is wrong

### MEDIUM Priority (Stale/Missing)
6. **README.md** — Minor dispatch script reference
7. **TECHNICAL_BIBLE.md** — Missing Hub token schema section
8. **UX_BIBLE.md** — Missing Org Chart, Hub Ledger, MLX Panel sections; ActivityBar icon list
9. **PROVIDER_SETUP_GUIDE.md** — Missing MLX and CCR sections
10. **BACKGROUND_SERVICES_GUIDE.md** — Pending story markers

### LOW Priority (Minor)
11. **OPERATOR_STARTUP.md** — Verify `/plan`, `/delegate` commands
12. **WORKFLOW_BUILDER_GUIDE.md** — No changes needed

---

## Recommendations

1. **Immediate (HIGH priority):** Fix CLAUDE_CODE_ROUTER.md port and routes — this blocks user CCR setup
2. **Before launch:** Rewrite USER_GUIDE.md and USER_WORKFLOW.md with current view names
3. **Post-launch:** Add missing panel documentation (Org Chart, Hub Ledger, MLX) to UX_BIBLE.md

---

## Verification Checklist

- [x] README.md read and assessed
- [x] TECHNICAL_BIBLE.md read and assessed
- [x] UX_BIBLE.md read and assessed
- [x] USER_WORKFLOW.md read and assessed
- [x] CLAUDE_CODE_ROUTER.md read and assessed
- [x] PHASE6_AGENT_HUB.md read and assessed
- [x] docs/help/*.md read and assessed
- [x] ActivityBar.tsx inspected for current view names
- [x] layout.ts inspected for StoryboardView types
- [x] OrgChartPanel.tsx confirmed exists (story 646)
- [x] HubLedgerPanel.tsx confirmed exists (story 647)
- [x] MLXProviderPanel.tsx confirmed exists (story 652)
