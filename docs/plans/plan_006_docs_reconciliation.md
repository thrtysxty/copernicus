# Execution Plan 006: Documentation Reconciliation
**Sprint:** 3
**Agent Role:** Scribe / Technical Writer
**Story:** 101 (C-9, H-9, Sprint 3 items)
**Prerequisite:** None (can run in parallel with Sprints 0–2)
**Date Authored:** 2026-02-25

---

## Context

The architectural review identified systemic documentation deficiencies across
100 story files:

- **C-9:** 21 Epic 004 stories (077–100) are marked `COMPLETE` with zero ACs checked
- **H-9a:** 33 stories missing `## Documentation Impact` section
- **H-9b:** 44 stories missing `## Blocks` / `## Blocked By` dependency notation
- Stories 077–100 lack canonical file paths in task breakdowns
- `story_094` references deleted code as if it was renamed (not deleted)
- Status naming is inconsistent (`DONE` vs `COMPLETE`)

This plan executes the reconciliation in four batches.
Work through each task sequentially. Do not skip files.

---

## Task 1: Fix Epic 004 Story Status (C-9)

### Stories: `story_077.md` through `story_100.md` (24 files)

**Step 1: For each story file in this range, read the file in full.**

**Step 2: Change the `Status:` line.**

Change:
```markdown
**Status:** COMPLETE
```

To:
```markdown
**Status:** APPROVED FOR IMPLEMENTATION
```

**Exception:** If a story's acceptance criteria checkboxes are ALL marked `[x]` (not `[ ]`),
leave its status as `COMPLETE`. Only downgrade stories where ACs remain unchecked.

**Files to process:**
- `docs/stories/story_077_atlas_foundation.md`
- `docs/stories/story_078_atlas_slash_commands.md`
- `docs/stories/story_079_atlas_planning_chat.md`
- `docs/stories/story_080_atlas_capex_tracker.md`
- `docs/stories/story_082_atlas_agent_interop.md`
- `docs/stories/story_083_atlas_telemetry_popout.md`
- `docs/stories/story_084_atlas_distribution.md`
- `docs/stories/story_085_atlas_auth_manager.md`
- `docs/stories/story_086_atlas_security_boundary.md`
- `docs/stories/story_087_tui_capex_integration.md`
- `docs/stories/story_088_agentic_sdk_canonical.md`
- `docs/stories/story_089_atlas_status_bar.md`
- `docs/stories/story_090_atlas_ui_canvas.md`
- `docs/stories/story_091_industrial_kanban.md`
- `docs/stories/story_092_documentation_factory.md`
- `docs/stories/story_093_spotlight_controller.md`
- `docs/stories/story_095_touch_bar_integration.md`
- `docs/stories/story_096_github_dashboard_integration.md`
- `docs/stories/story_097_dell_r210ii_infrastructure_migration.md`
- `docs/stories/story_098_industrial_manual_&_operator_onboarding.md`
- `docs/stories/story_099_visual_identity:_app_icon_&_industrial_loading_screen.md`
- `docs/stories/story_100_dynamic_phosphor_color_system.md`

Also fix `story_094_copernicus_rebranding.md` (see Task 4).

**Step 3: Fix `story_050` status inconsistency.**

In `docs/stories/story_050_implement_agent_tool_use.md`, change:
```markdown
**Status:** DONE
```
To:
```markdown
**Status:** COMPLETE
```

---

## Task 2: Add `## Documentation Impact` to Deficient Stories (H-9a)

### Stories missing this section (33 files)

The required section format is:

```markdown
## Documentation Impact

- **Files Created:** list any new files this story produces
- **Files Modified:** list any existing files this story changes
- **Files Deprecated:** list any files this story renders obsolete
- **Docs Updated:** `USER_GUIDE.md`, `README.md`, `BACKLOG.md` (as applicable)
```

**Priority order — add to these stories first:**

1. `story_041_workflow_engine_mvp.md` (CRITICAL priority)
2. `story_077_atlas_foundation.md` (Epic foundation)
3. `story_085_atlas_auth_manager.md` (Security critical)
4. `story_086_atlas_security_boundary.md` (Security critical)
5. `story_000_agent_logging.md` (Foundation)
6. All remaining Epic 004 stories (078–100 not already done above)

**For each file:**

1. Read the story in full.
2. Identify what files the story creates, modifies, or deprecates based on its
   acceptance criteria and task list.
3. Insert the `## Documentation Impact` section. Place it **after** `## Acceptance Criteria`
   and **before** `## Definition of Done`.

**Example — `story_041_workflow_engine_mvp.md`:**

```markdown
## Documentation Impact

- **Files Created:**
  - `copernicus/electron/db/state-ledger.ts` — SQLite-backed intent/event/memory ledger
  - `copernicus/electron/context-bus.ts` — IPC broadcast service
  - `copernicus/electron/asset-registry.ts` — Shared asset DRY enforcement
- **Files Modified:**
  - `copernicus/electron/main.ts` — Register context bus IPC handlers
  - `copernicus/electron/pty-manager.ts` — Hook PTY output to ledger
- **Docs Updated:** `BACKLOG.md`, `docs/epics/epic_001_implement_agentic_workflow_engine.md`
```

---

## Task 3: Add `## Blocks` / `## Blocked By` to All Stories (H-9b)

### All active stories (44+ files)

The required format is:

```markdown
## Blocks
- Story NNN (Title) — reason why this story must complete first

## Blocked By
- Story NNN (Title) — reason this cannot start until that story is done
```

If a story has no dependencies in either direction, use:

```markdown
## Blocks
- None

## Blocked By
- None
```

**Dependency reference — use this table to populate the fields:**

| Story | Blocked By | Blocks |
|-------|-----------|--------|
| 041 (State Ledger) | None | 079, 082, 091, 092 |
| 077 (Atlas Foundation) | None | 078, 079, 080, 082, 083, 084, 085, 086, 087, 088, 089, 090, 091, 092, 093 |
| 078 (Slash Commands) | 077 | 079 |
| 079 (Planning Chat) | 077, 078, 085 | 082 |
| 080 (Capex Tracker) | 077 | 087 |
| 082 (Agent Interop) | 077, 079, 041 | 092 |
| 083 (Telemetry Popout) | 077 | None |
| 084 (Distribution) | 077 | None |
| 085 (Auth Manager) | 077 | 079, 086 |
| 086 (Security Boundary) | 077, 085 | None |
| 087 (TUI Capex) | 080 | None |
| 088 (SDK Canonical) | None | None |
| 089 (Status Bar) | 077 | None |
| 090 (UI Canvas) | 077 | 092 |
| 091 (Industrial Kanban) | 041 | 092 |
| 092 (Documentation Factory) | 090, 091, 082 | None |
| 093 (Spotlight Controller) | 077 | None |
| 095 (Touch Bar) | 077 | None |
| 096 (GitHub Dashboard) | 085 | None |
| 097 (Dell R210ii) | None | None |
| 098 (Industrial Manual) | 097 | None |
| 099 (Visual Identity) | 077 | None |
| 100 (Phosphor Color) | 077, 099 | None |
| 101 (This story) | None | All others |

**Placement:** Insert the `## Blocks` / `## Blocked By` section immediately after
the `**Epic:**` metadata header line, before the first `---` separator.

**Example — `story_079_atlas_planning_chat.md`:**

```markdown
**Status:** APPROVED FOR IMPLEMENTATION
**Priority:** HIGH
**Epic:** 004 — COPERNICUS IDE
**Authored By:** /architect
**Date:** 2026-02-24

## Blocks
- Story 082 (Atlas Agent Interop) — planning chat context required by agent dispatch

## Blocked By
- Story 077 (Atlas Foundation) — window scaffold required
- Story 078 (Atlas Slash Commands) — command parser required for /model /context commands
- Story 085 (Atlas Auth Manager) — API keys required for LLM calls

---
```

---

## Task 4: Fix `story_094` Narrative (Stale Code Reference)

### File: `docs/stories/story_094_copernicus_rebranding.md`

**Step 1: Read `story_094_copernicus_rebranding.md` in full.**

**Step 2: Verify the actual git state of `benway/`.**

The git status shows 21 deleted files from `benway/`. The story says the directory
was renamed to `copernicus/`. In reality, the `benway/` files were deleted and
`copernicus/` appears to be a fresh implementation.

**Step 3: Update the story to reflect what actually happened.**

Find the acceptance criteria that says:
```markdown
[x] DONE by GEMINI — Rename the `benway/` directory to `copernicus/`
```

Update to reflect the actual outcome. If benway was deleted rather than renamed,
change the AC to:

```markdown
[x] COMPLETE — `benway/` directory deleted; `copernicus/` created as fresh
    implementation. Code was not migrated verbatim; new architecture implemented.
    See: git log for deleted files list.
```

Also add a `## Notes` section at the bottom:

```markdown
## Notes

**2026-02-25 — Architect Review**
Git history shows `benway/` files were deleted (not renamed). `copernicus/` is
a new implementation. The rebranding story accurately documents intent; the
implementation diverged from a rename to a rewrite. Story status reflects
actual implementation outcome.
```

---

## Task 5: Add Canonical File Paths to Epic 004 Task Breakdowns (H-9b)

### Stories: `story_077.md` through `story_100.md`

For each story, read the `## Technical Tasks` or `## Tasks` section.
For every task that references creating or modifying a file, append the canonical path.

**Example — before:**
```markdown
## Technical Tasks
1. Repo scaffold at `copernicus/` directory
2. Adaptive Layout Engine
3. Three terminal tabs
```

**Example — after:**
```markdown
## Technical Tasks
1. Repo scaffold: `copernicus/` directory root
2. Adaptive Layout Engine: `copernicus/src/renderer/store/layoutStore.ts`
3. Three terminal tabs: `copernicus/src/renderer/components/Terminal/TerminalTabs.tsx`
```

Only add paths where you can determine the canonical location from the story's
acceptance criteria and the existing codebase. If a path is genuinely unknown,
annotate with `[PATH TBD — confirm with Senior Dev]` rather than guessing.

---

## Task 6: Regenerate `BACKLOG.md`

After all story status changes, regenerate the backlog:

```bash
cd ~/Projects/agentic-platform
make backlog
```

Verify the output reflects the new `APPROVED FOR IMPLEMENTATION` statuses.

If `make backlog` fails (the script may not exist — check first):

```bash
python scripts/utils/generate_backlog.py 2>&1 | head -20
```

If neither works, manually update `BACKLOG.md`:
- Change all entries for stories 077–100 from `COMPLETE` to `APPROVED`
- Change story_050 from `DONE` to `COMPLETE`

---

## Completion Checklist

- [ ] Stories 077–100 status changed to `APPROVED FOR IMPLEMENTATION` (or left COMPLETE where all ACs are `[x]`)
- [ ] `story_050` status changed from `DONE` to `COMPLETE`
- [ ] `## Documentation Impact` added to all 33 deficient stories
- [ ] `## Blocks` / `## Blocked By` added to all active stories
- [ ] Stories 077–100 task breakdowns include canonical file paths
- [ ] `story_094` narrative updated to reflect deletion vs. rename reality
- [ ] `BACKLOG.md` regenerated or manually updated

**Commit message:**
```
docs(sprint-3): reconcile story statuses, AC coverage, and dependency graph

- Downgrade stories 077-100 from COMPLETE to APPROVED FOR IMPLEMENTATION (C-9)
- Add Documentation Impact section to 33 deficient stories (H-9a)
- Add Blocks/Blocked By dependency notation to all active stories (H-9b)
- Add canonical file paths to Epic 004 task breakdowns
- Fix story_094 to reflect benway deletion vs. rename reality
- Normalise status DONE -> COMPLETE in story_050
- Regenerate BACKLOG.md
```
