# Epic 014: Skill Scaffolding & Repo Onboarding

**Status:** DRAFT
**Priority:** P1 — Product
**Phase:** Developer Experience

## Narrative

**As a** developer opening a new repo in Copernicus for the first time,
**I want** the IDE to analyse my stack and scaffold the right skill set automatically,
**So that** I start with Library & API Reference, Verification, CI/CD, and Runbook skills pre-wired for my project — not a blank slate.

---

## Context

The nine skill categories from Anthropic's internal playbook map to every meaningful project archetype. Today, every Copernicus user starts with zero project-specific skills and builds them by hand. This is exactly the "blank slate" problem that Copernicus exists to eliminate.

The fix is a two-part system:

1. **Repo indexing trigger** — when a project is first opened (or re-indexed), Copernicus analyses the stack and presents a skill onboarding wizard. The user selects which categories to scaffold; stubs are generated and checked into `.claude/skills/`.

2. **On-demand generation** — at any point, a `/scaffold-skills` command re-runs the wizard for the current project, or generates a single category on request.

This epic does not ship all nine categories fully implemented. It ships the scaffolding *system* and pre-built templates for the four highest-ROI categories. The remaining five are stubs that teams fill in.

---

## The Nine Categories (from Anthropic Skills Playbook)

| # | Category | Template Priority |
|---|---|---|
| 1 | Library & API Reference | **Ship full** — `copernicus-ipc` is the proof of concept |
| 2 | Product Verification | **Ship full** — Playwright driver template |
| 3 | Data Fetching & Analysis | **Ship full** — Ledger query template |
| 4 | Business Process & Team Automation | Stub |
| 5 | Code Scaffolding & Templates | Stub |
| 6 | Code Quality & Review | **Ship full** — extends existing `security-review`, `tdd`, `pi_check` |
| 7 | CI/CD & Deployment | **Ship full** — `babysit-jules` is the proof of concept |
| 8 | Runbooks | Stub |
| 9 | Infrastructure Operations | Stub |

---

## Goals

1. On first project open, Copernicus detects the stack (TypeScript/React/Electron, Python/Flask, etc.) and presents a skill onboarding card in the Kanban Blueprint column.
2. User selects which categories to scaffold; Copernicus generates `.claude/skills/<skill-name>/` folders with appropriate SKILL.md, `references/`, `scripts/`, and `assets/` based on detected stack.
3. A `/scaffold-skills` slash command re-runs the wizard or generates a single named category on demand.
4. All generated skills follow the article's best practices: trigger-oriented descriptions, gotchas section, progressive disclosure via folder structure, config.json pattern for setup, `${CLAUDE_PLUGIN_DATA}` for persistent state.
5. Existing skills in the repo are detected and excluded from scaffold suggestions (no duplicates).
6. The skill description audit runs on every existing skill at index time — skills with summary-style descriptions are flagged for update.

---

## Sub-Stories

| Story | Title | Depends On |
|---|---|---|
| 460 | Stack detector: analyse repo on open → emit `{ stack, frameworks, hasTests, hasCI }` | — |
| 461 | Skill template library: 9 category templates, 4 fully implemented | 460 |
| 462 | Onboarding card in Blueprint column on first open | 460 |
| 463 | Skill scaffold generator: reads template + stack → writes `.claude/skills/` folder | 461 |
| 464 | `/scaffold-skills` slash command: wizard or `--category <name>` flag | 463 |
| 465 | Description auditor: flags summary-style descriptions at index time | — |
| 466 | `${CLAUDE_PLUGIN_DATA}` adoption: migrate `handoff`, `log_success`, `log_error` to stable storage | — |
| 467 | Skill usage telemetry via PreToolUse hook (opt-in) | 463 |

460 and 465 and 466 are independent — run in parallel.
461 gates on 460.
462, 463 gate on 461.
464 gates on 463.
467 is standalone, lowest priority.

---

## Stack Detection Heuristics

| Signal | Detected Stack |
|---|---|
| `package.json` + `electron` dep | Electron app |
| `package.json` + `react` + `typescript` | React/TS frontend |
| `requirements.txt` or `pyproject.toml` + `flask` | Flask backend |
| `playwright.config.ts` or `cypress.config.ts` | Has E2E tests |
| `.github/workflows/` | Has CI |
| `Makefile` with `deploy` target | Has deployment automation |
| `copernicus/electron/preload.ts` | Copernicus itself → load `copernicus-ipc` template |

Detection is heuristic, not exhaustive. User can override in the wizard.

---

## Template Structure (per generated skill)

```
.claude/skills/<name>/
  SKILL.md               # trigger description + rules + references/ pointers
  references/
    patterns.md          # correct usage patterns
    gotchas.md           # common failures — seeded from template, grows over time
  scripts/               # helper scripts (optional, stack-dependent)
  assets/                # templates, fixtures (optional)
  config.json            # setup state (created on first run if needed)
```

---

## Acceptance Criteria (Epic Level)

- [ ] Opening a project with no `.claude/skills/` triggers onboarding card in Blueprint
- [ ] Stack detector correctly identifies Electron + React/TS + Flask + CI for this repo
- [ ] Selecting "Library & API Reference" generates a skill folder with patterns + gotchas pre-populated from stack detection
- [ ] `/scaffold-skills --category verification` generates a Playwright driver stub for a TypeScript project
- [ ] Generated skill descriptions are trigger-oriented ("Use when X"), not summaries
- [ ] Existing skills are not overwritten or duplicated
- [ ] Description auditor flags at least one summary-style description in the existing skill set at index time
- [ ] `handoff` skill stores log in `${CLAUDE_PLUGIN_DATA}` — survives `/plugin update`
- [ ] `tsc --noEmit` clean; `pytest` green

---

## Out of Scope

- Fully implementing all 9 stub templates (team fills those in post-ship)
- Skill marketplace / distribution (Epic 010 scope)
- Auto-updating skills when codebase changes (future: hooks-based)
- Measuring skill trigger rates in production (Story 467, lowest priority)

---

## Frozen Surfaces

- `copernicus/src/renderer/components/kanban/KanbanBoard.tsx` — onboarding card is a new card type in Blueprint column; existing card layout unchanged
- Existing skills in `.claude/skills/` — scaffold only generates new folders; never overwrites

---

## Documentation Impact

- `docs/reference/TECHNICAL_BIBLE.md` — add "Skill Conventions" section: trigger descriptions, gotchas pattern, `${CLAUDE_PLUGIN_DATA}` usage, folder structure standard
- `.claude/skills/README.md` (new) — index of all project skills with one-line descriptions and category labels
