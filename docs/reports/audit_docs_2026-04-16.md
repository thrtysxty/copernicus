# Documentation Audit Report
**Date:** 2026-04-16  
**Story:** 672 — Launch Readiness Documentation Audit  
**Auditor:** Claude Code  

---

## Executive Summary

This audit assessed 6 core documentation files against Story 672 acceptance criteria. **27 gaps identified:** 11 HIGH priority, 12 MEDIUM priority, 4 LOW priority. Primary issues: port number inconsistencies, missing Agent Hub documentation, stale dispatch protocol references, and missing component documentation for shipped features.

---

## Priority Legend

- **HIGH** — Wrong or misleading information that could block users
- **MEDIUM** — Stale information that should be updated
- **LOW** — Minor updates or cosmetic issues

---

## README.md Gaps

### GAP-001: Missing Agent Hub Section [HIGH]
- **Line:** N/A (entirely missing)
- **Issue:** No Agent Hub section present. Phase 6 is described in Roadmap section (line 421-422) but there's no dedicated user-facing section explaining token authority, role contracts, or org chart configuration.
- **AC Ref:** AC-1: "Agent Hub section present: token authority, role contracts, org chart configuration"
- **Proposed Fix:** Add new section after "Execution Channels & Providers" (~line 75) with Hub architecture overview, token concept, and org chart basics.
- **Scope:** ~15-20 lines new content

### GAP-002: Apple Silicon Section Gaps [MEDIUM]
- **Line:** 252-284
- **Issue:** Apple Silicon section exists but:
  - No mention of **MLX Panel UI component** referenced in AC-2
  - No connection between MLX and Agent Hub role mapping
  - `mlx-models.yaml` path may be stale
- **AC Ref:** AC-1, AC-2
- **Proposed Fix:** Add MLX Panel reference; verify yaml path; add Hub role mapping sentence.
- **Scope:** 3-5 line updates

### GAP-003: CCR Dispatch Inconsistencies [HIGH]
- **Line:** 44, 299, 341-346
- **Issues:**
  - Line 44 says CCR on "port 9669" but CLAUDE_CODE_ROUTER.md says 3456
  - Line 299 mentions `gemini` CLI for orchestration (deprecated)
  - Lines 341-346 describe CCR dispatch but use `--dangerously-skip-permissions` without context
- **AC Ref:** AC-1: "CCR dispatch model described"
- **Proposed Fix:** Standardize on port 9669; remove gemini CLI reference; add context on `--dangerously-skip-permissions` flag.
- **Scope:** 3 separate 1-line patches

### GAP-004: Provider Registry Missing MLX Entry [MEDIUM]
- **Line:** 51-62 (Provider Ecosystem table)
- **Issue:** MLX native inference is in Apple Silicon section but NOT in the main Provider Ecosystem table. Should be first-class provider entry alongside Anthropic, OpenRouter, Ollama, Jules.
- **AC Ref:** AC-1: "Provider registry section: Anthropic, OpenRouter, Ollama, MLX, Jules"
- **Proposed Fix:** Add MLX row to Provider Ecosystem table with model info and "Apple Silicon only" note.
- **Scope:** 1 table row addition

### GAP-005: Deprecated gemini CLI Reference [MEDIUM]
- **Line:** 297-299 (Stack table)
- **Issue:** Still references "`gemini` CLI (yolo mode)" for orchestration. While `dispatch_gemini.sh` is not mentioned, this is stale terminology.
- **AC Ref:** AC-1: "No references to deprecated dispatch scripts"
- **Proposed Fix:** Replace "`gemini` CLI (yolo mode)" with "CCR (Claude Code Router)" or "Agent Hub adapters"
- **Scope:** 1 line patch

### GAP-006: Missing Hub Ledger Reference [MEDIUM]
- **Line:** 153-175 (Financial Telemetry section)
- **Issue:** Describes CapEx dashboard but **no mention of Hub Ledger** — the audit trail for token events, mints, checks, revocations from PHASE6_AGENT_HUB.md.
- **AC Ref:** AC-2: "Feature descriptions match current UI (Hub Ledger)"
- **Proposed Fix:** Add Hub Ledger paragraph describing token audit trail functionality.
- **Scope:** ~5 lines new content

---

## TECHNICAL_BIBLE.md Gaps

### GAP-007: Dispatch Protocol References Gemini CLI [HIGH]
- **Line:** 298-299 (Stack table)
- **Issue:** "Orchestration: `gemini` CLI (yolo mode)" — this is deprecated terminology.
- **AC Ref:** AC-4: "Dispatch protocol reflects CCR not gemini CLI"
- **Proposed Fix:** Replace with "CCR (Claude Code Router) via Agent Hub adapters"
- **Scope:** 1 line patch

### GAP-008: Missing CCR Documentation [HIGH]
- **Line:** N/A (entirely missing)
- **Issue:** No mention of CCR (Claude Code Router) anywhere. Section 8 (Agent Dispatch Protocol) should include CCR as primary dispatch mechanism.
- **AC Ref:** AC-4: "Dispatch protocol reflects CCR"
- **Proposed Fix:** Add CCR subsection to Section 8 with port, routes, and dispatch commands.
- **Scope:** ~20 lines new content

### GAP-009: Agent Roles Outdated [HIGH]
- **Line:** 409-418 (Section 8.1 Roles table)
- **Issue:** Roles table lists "Claude (Architect)", "Claude (Implementer)", "Gemini", "Jules" but does NOT reflect Hub org chart roles: **coder, reviewer, planner, sentinel**.
- **AC Ref:** AC-4: "Agent roles section reflects Hub org chart"
- **Proposed Fix:** Rewrite Section 8.1 to describe Hub roles (coder, reviewer, planner, sentinel) and their authority levels.
- **Scope:** Table rewrite, ~15 lines

### GAP-010: jules_assign.sh Pattern Stale [LOW]
- **Line:** 617-618, 8.3 references
- **Issue:** Still references `jules_assign.sh` dispatch pattern. While script exists, pattern is shifting to Hub adapters.
- **AC Ref:** AC-4: "No references to dispatch_claude_ollama.sh or dispatch_gemini.sh"
- **Proposed Fix:** Add note that `jules_assign.sh` is being migrated to JulesAdapter pattern; keep for backward compatibility.
- **Scope:** 1 note addition

### GAP-011: Missing Token Schema Documentation [HIGH]
- **Line:** N/A
- **Issue:** No documentation of employment credential token schema (token_id, identity, role, scope, capabilities, duration, budget, health) from PHASE6_AGENT_HUB.md.
- **AC Ref:** AC-4: Agent roles should reflect Hub
- **Proposed Fix:** Add new Section 8.x documenting token schema with YAML example.
- **Scope:** ~30 lines new content

---

## CLAUDE_CODE_ROUTER.md Gaps

### GAP-012: Wrong Port Number [HIGH]
- **Line:** 8, 58
- **Issue:** Document states port **3456**, but README.md and AC-5 specify port **9669**.
- **AC Ref:** AC-5: "CCR port (9669) documented"
- **Proposed Fix:** Change all instances of 3456 to 9669.
- **Scope:** 2 line patches

### GAP-013: Missing Route Precedence Table [HIGH]
- **Line:** N/A (entirely missing)
- **Issue:** No "Provider Route Precedence" section as required by Story 669. Routes are listed but no precedence rules.
- **AC Ref:** AC-5: "Provider Route Precedence section present"
- **Proposed Fix:** Add section documenting route precedence: default → background → think → longContext → webSearch → image.
- **Scope:** ~10 lines new content

### GAP-014: Default Model Mismatch [HIGH]
- **Line:** 18
- **Issue:** Shows `moonshotai/kimi-k2.5:cloud` as default but AC-5 specifies `nemotron-3-super`.
- **AC Ref:** AC-5: "default model (nemotron-3-super) documented"
- **Proposed Fix:** Verify actual CCR config and update to match.
- **Scope:** 1 line patch

### GAP-015: Missing Background/Think Route Documentation [MEDIUM]
- **Line:** 19-20
- **Issue:** Routes exist in table but no detailed documentation of when/why to use them.
- **AC Ref:** AC-5: "background/think routes documented"
- **Proposed Fix:** Add usage guidance section for route selection.
- **Scope:** ~8 lines new content

---

## PHASE6_AGENT_HUB.md Gaps

### GAP-016: Story Completion Status Inaccurate [HIGH]
- **Line:** 1-6, 342-368
- **Issue:** Header says "Status: Vision / Pre-Implementation" dated 2026-04-06. AC-6 states stories 634–668 are COMPLETE.
- **AC Ref:** AC-6: "Story completion status accurate (634–668 all COMPLETE)"
- **Proposed Fix:** Update header to "Status: IMPLEMENTED" and mark Phase 6 stories as complete.
- **Scope:** Header rewrite + story status updates

### GAP-017: Missing Architecture Diagram [MEDIUM]
- **Line:** N/A
- **Issue:** No architecture diagram present. Document describes complex Hub architecture that would benefit from visual.
- **AC Ref:** AC-6: "Architecture diagram if present reflects shipped reality"
- **Proposed Fix:** Add ASCII or linked diagram showing Hub, adapters, and token flow.
- **Scope:** ~20 lines ASCII art or reference to external diagram

### GAP-018: "Planned" Sections Describe Shipped Work [HIGH]
- **Line:** 342-368 (Phase 6 Story Sequence)
- **Issue:** Shows stories as "ordered tasks" but status is "Vision". If 634-668 are complete, this should reflect shipped vs planned.
- **AC Ref:** AC-6: "No 'planned' sections describing things already shipped"
- **Proposed Fix:** Add completion status indicators to story list; separate shipped from planned.
- **Scope:** Table restructuring

### GAP-019: CCR Port Consistency Issue [HIGH]
- **Line:** 313
- **Issue:** Shows "port 9669" which matches AC-5 but contradicts CLAUDE_CODE_ROUTER.md's port 3456.
- **AC Ref:** Consistency across docs
- **Proposed Fix:** CLAUDE_CODE_ROUTER.md must be updated to 9669 (this document is correct).
- **Scope:** None — other file needs fix

---

## UX_BIBLE.md Gaps

### GAP-020: Missing Hub Ledger Component [MEDIUM]
- **Line:** N/A
- **Issue:** No documentation of Hub Ledger component. Should be in Chapter 2 (Views) or new section.
- **AC Ref:** AC-7: "Component list reflects current inventory (Hub Ledger)"
- **Proposed Fix:** Add Hub Ledger view section describing token audit log UI.
- **Scope:** ~15 lines new content

### GAP-021: Missing Org Chart Component [MEDIUM]
- **Line:** N/A
- **Issue:** No documentation of Org Chart UI component (Story 646).
- **AC Ref:** AC-7: "Component list reflects current inventory (Org Chart)"
- **Proposed Fix:** Add Org Chart view section describing visual org chart UI.
- **Scope:** ~15 lines new content

### GAP-022: Missing MLX Panel Component [MEDIUM]
- **Line:** N/A
- **Issue:** No documentation of MLX Panel component for Apple Silicon inference.
- **AC Ref:** AC-7: "Component list reflects current inventory (MLX Panel)"
- **Proposed Fix:** Add MLX Panel component section.
- **Scope:** ~10 lines new content

### GAP-023: Design Token Verification [LOW]
- **Line:** 931-966 (Color System)
- **Issue:** Color system documented but not verified against actual `tailwind.config.ts`.
- **AC Ref:** AC-7: "Design tokens match tailwind.config.ts"
- **Proposed Fix:** Verify tokens match; no changes expected.
- **Scope:** Verification only

---

## USER_WORKFLOW.md Gaps

### GAP-024: Wizard Flow Documentation Stale [MEDIUM]
- **Line:** 39-167 (Act 2 — The Wizard)
- **Issue:** Steps described but may not match current implementation. Step 1 mentions "BitNet (Embedded Agent)" which may be deprecated.
- **AC Ref:** AC-3: "Splash → Wizard → IDE flow matches current implementation"
- **Proposed Fix:** Review and update wizard steps to match actual flow; remove BitNet if deprecated.
- **Scope:** Section review, 5-10 line updates

### GAP-025: Provider Setup References Removed UI [MEDIUM]
- **Line:** 47-109
- **Issue:** Describes CLI-based provider setup which may not reflect current Settings → Providers UI.
- **AC Ref:** AC-3: "Provider setup step reflects Settings → Providers UI"
- **Proposed Fix:** Update to describe Settings panel provider configuration instead of CLI approach.
- **Scope:** ~20 line rewrite

### GAP-026: Broken Step Numbering [LOW]
- **Line:** 169-180
- **Issue:** After Step 5, there are "### Step 3 — Quick Tour" and "### Step 4 — Launch" — numbering is broken.
- **AC Ref:** AC-3: Consistency
- **Proposed Fix:** Renumber to Step 6, Step 7 or adjust structure.
- **Scope:** 2 header fixes

### GAP-027: References Potentially Removed Tour [MEDIUM]
- **Line:** 184-207 (Act 3)
- **Issue:** References "60-second tour" and "Designer view" tour that may not exist.
- **AC Ref:** AC-3: "No references to removed wizard steps"
- **Proposed Fix:** Verify tour exists; remove or update section if tour was cut.
- **Scope:** Section removal or update

---

## Cross-Cutting Issues

### ISSUE-001: Port Number Inconsistency [CRITICAL]
- **Files:** README.md (line 405), CLAUDE_CODE_ROUTER.md (line 8), PHASE6_AGENT_HUB.md (line 313)
- **Problem:** CCR port documented as 9669 vs 3456
- **Resolution:** Standardize on port 9669 (per AC-5 and PHASE6_AGENT_HUB.md)
- **Files to Patch:** CLAUDE_CODE_ROUTER.md

### ISSUE-002: Model Name Inconsistency [HIGH]
- **Files:** CLAUDE_CODE_ROUTER.md (line 18), AC-5
- **Problem:** Default model `moonshotai/kimi-k2.5:cloud` vs `nemotron-3-super`
- **Resolution:** Verify actual CCR config and standardize documentation
- **Files to Patch:** CLAUDE_CODE_ROUTER.md

### ISSUE-003: Missing Hub Integration Across All Docs [HIGH]
- **Problem:** PHASE6_AGENT_HUB.md describes vision but other docs don't reference Hub as governing architecture
- **Resolution:** Update all docs to reflect Hub-centric architecture where appropriate
- **Files to Patch:** README.md, TECHNICAL_BIBLE.md

---

## Summary Table

| Priority | Count | Key Files |
|----------|-------|-----------|
| HIGH | 11 | CLAUDE_CODE_ROUTER.md (4), TECHNICAL_BIBLE.md (3), README.md (2), PHASE6_AGENT_HUB.md (2) |
| MEDIUM | 12 | UX_BIBLE.md (4), USER_WORKFLOW.md (4), README.md (3), PHASE6_AGENT_HUB.md (1) |
| LOW | 4 | USER_WORKFLOW.md (2), README.md (1), UX_BIBLE.md (1) |

---

## Recommended Fix Order

1. **Port/Model Standardization (CRITICAL):** Fix CLAUDE_CODE_ROUTER.md port 3456→9669 and verify default model
2. **Hub Documentation (HIGH):** Add Agent Hub section to README.md
3. **Token Schema (HIGH):** Add token schema documentation to TECHNICAL_BIBLE.md
4. **Role Updates (HIGH):** Update TECHNICAL_BIBLE.md Section 8.1 with Hub roles
5. **PHASE6_AGENT_HUB.md Status (HIGH):** Update to IMPLEMENTED status
6. **Component Documentation (MEDIUM):** Add Hub Ledger, Org Chart, MLX Panel to UX_BIBLE.md
7. **Workflow Refresh (MEDIUM):** Update USER_WORKFLOW.md for current wizard flow

---

*This audit is research-only as specified in Story 672. No existing documentation files were modified.*
