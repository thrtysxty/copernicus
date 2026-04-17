# Epic 017: Retrospective Engine

**Status:** COMPLETE
**Priority:** P1 — Sovereign Intelligence
**Phase:** Compounding Agent Intelligence

## Narrative

**As a** developer using Copernicus across many sessions,
**I want** the system to periodically synthesize what it has learned about my project, patterns, and preferences — surface those conclusions as a reviewable report in the Kanban, and upon approval, update the memory layer and project docs automatically —
**So that** agent intelligence compounds over time, standing conventions are encoded where agents find them (memory, skills, CLAUDE.md), and I have a transparent, auditable record of how the system's understanding of my project has evolved.

---

## Context

Epic 016 gives Copernicus a structured memory layer: `agent_memory` rows are extracted, scored, and injected into agent context. Story 473 gives agents a delta summary at model-switch time. Both solve the *session-level* continuity problem.

What neither addresses is *cross-session synthesis* — the ability to look across 30 sessions and surface: "this project always rejects auth middleware rewrites," "TypeScript strict mode violations are consistently introduced in IPC handlers," "the user prefers one bundled PR over split commits for refactors."

Hindsight's `reflect` operation was designed for this. Epic 017 replaces it with a first-class, transparent product feature: the Retrospective. Where Hindsight reflects in a background daemon the user never sees, a Copernicus Retrospective is a reviewable document surfaced in the Kanban — the user reads every conclusion the system drew, approves or edits each item, and the approved set is committed to memory and docs. Prior approved retros are fed as inflection points into subsequent ones, creating a compounding synthesis chain. The raw memory rows that a retro supersedes decay naturally; the synthesized conclusions persist at high importance.

This is the SICA self-improvement loop applied to project intelligence: the system improves its own instructions and memory based on accumulated evidence, with the user in the loop at every step.

---

## Goals

1. **Reporter service** stores retro reports as first-class persistent documents with a full lifecycle: `draft → pending_review → approved`.
2. **Retro card** appears automatically in the Blueprint column when a retro draft is ready for review — same card-type extension point as Epic 014's onboarding card. On approval the card moves to **Done** alongside story cards.
3. **Review UI** presents each synthesized item (memory fact, file change, queued story) individually — the user approves, rejects, or edits each before committing.
4. **Approval commit** atomically: writes approved memory facts to `agent_memory` (importance 8–10, `supersedes_id` links to stale rows), applies bounded file patches (skill gotchas, CLAUDE.md), queues code-level changes as auto-generated stories, and **serializes the full report to `.claude/retros/retro_<ulid>.md`** for version control and human readability.
5. **Historical archive** — Done retro cards are permanently browsable in the Kanban Done column; the `retrospectives` tab in the Reporter (CapexDashboard) is the full archive view with inflection chain timeline. The `.claude/retros/` disk files are the source of truth for inflection point context in subsequent retros.
6. **Compounding synthesis** — each new retro reads all prior `.claude/retros/` files as inflection point context. Raw fact recall improves; synthesized convention recall improves faster.
7. **Trigger system** — retros are generated on a session-count threshold (default: every 20 sessions) and on user demand from the Kanban.
8. **Sprint gate (opt-in)** — a Settings toggle that, when enabled, blocks any story card from moving to In Progress while a retro is in `pending_review`. Prevents the team from starting new work before the retrospective is resolved.

---

## The Reporter Service

The Reporter already exists: it is `CapexDashboard` (`copernicus/src/renderer/components/capex/CapexDashboard.tsx`), registered as the last activity bar icon (`BarChart2`, `⌘0`). It currently renders six tabs: `financial | quality | llm | velocity | heatmap | leaderboard`.

Epic 017 adds a seventh tab: **`retrospectives`**.

Backend IPC handlers go in a new `copernicus/electron/ipc/retro-handlers.ts` (parallel to the existing `capex-handlers.ts`), registered via `register-all-handlers.ts`. The Reporter does not write to `agent_memory` directly — it queues writes that the memory service applies atomically on commit.

### Schema

```sql
CREATE TABLE retro_reports (
  id          TEXT    PRIMARY KEY,  -- retro_<ulid>
  project_id  TEXT    NOT NULL,
  scope       TEXT    NOT NULL,     -- 'project' | bank_id
  status      TEXT    NOT NULL,     -- 'draft' | 'pending_review' | 'approved' | 'archived'
  ts_generated INTEGER NOT NULL,
  ts_approved  INTEGER,
  sessions_range TEXT NOT NULL,     -- JSON: { from_ts, to_ts, session_count }
  inflection_ids TEXT               -- JSON array of prior retro_report IDs used as context
);

CREATE TABLE retro_items (
  id                   TEXT PRIMARY KEY,  -- ritem_<ulid>
  retro_id             TEXT NOT NULL REFERENCES retro_reports(id),
  item_type            TEXT NOT NULL,     -- 'memory_fact' | 'file_patch' | 'story_queue' | 'convention'
  content              TEXT NOT NULL,     -- synthesized text
  target               TEXT,             -- file path (file_patch) | bank_id (memory_fact)
  importance           INTEGER,          -- for memory_fact items (8–10)
  supersedes_memory_id TEXT,             -- agent_memory.id being superseded
  status               TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'approved' | 'rejected' | 'edited'
  edited_content       TEXT,             -- user's amended version if status = 'edited'
  ts                   INTEGER NOT NULL
);
```

### IPC Channels (new — `retro-handlers.ts`)

| Channel | Direction | Purpose |
|---------|-----------|---------|
| `retro:generate` | renderer → main | Trigger synthesis for scope + session range |
| `retro:list` | renderer → main | Returns all retro_reports (for `retrospectives` tab) |
| `retro:get` | renderer → main | Returns retro with all items |
| `retro:update-item` | renderer → main | Approve / reject / edit a single item |
| `retro:commit` | renderer → main | Execute all approved items atomically |
| `retro:ready` | main → renderer | Push when draft moves to `pending_review` → triggers retro card in Blueprint |

---

## Synthesis Design

The retro synthesis is a two-phase agentic call:

**Phase 1 — Context assembly**
- Pull last N sessions of `agent_memory` + `agent_work_log` rows for the target scope
- Pull all prior approved `retro_reports` (full text) as inflection point context
- Compute a deduplicated, time-ordered summary of raw memory events

**Phase 2 — Structured synthesis**
- Single cheap model call (cloud `fast` role) with structured output
- Target schema:

```typescript
interface RetroSynthesis {
  memory_facts: Array<{
    content: string;         // the synthesized fact
    importance: number;      // 8–10
    bank_id: string;
    supersedes_hint?: string; // description of what this replaces
    tags: string[];
  }>;
  file_patches: Array<{
    target: string;          // relative file path
    section: string;         // which section to append/update
    content: string;         // the patch content
    rationale: string;
  }>;
  story_queues: Array<{
    title: string;           // story title
    rationale: string;       // why this story was identified
    priority: 'P1' | 'P2' | 'P3';
  }>;
  conventions: Array<{
    content: string;         // standing convention discovered
    scope: 'project' | 'agent' | 'workflow';
  }>;
}
```

**Inflection point usage:** Prior retro report content is included verbatim in the synthesis prompt under a `## Prior Retrospectives` heading. The model is instructed to note when a conclusion from a prior retro has been reinforced, contradicted, or superseded by the new session data. Contradictions surface as `supersedes_hint` on the new memory_fact item.

---

## Retro Card in Blueprint Kanban

The retro card is a new card type (`type: 'retro'`) in the Blueprint column — the same extension point as the Epic 014 onboarding card. The card renders a compact summary of the pending retro:
- Date range covered
- Item counts by type (N memory facts, N file patches, N stories)
- Prior inflection count
- "Review" CTA button → opens the retro review panel

One active retro card maximum. If a second retro generates before the first is approved, it queues as `draft` and shows a "1 pending" badge on the existing card.

---

## Review Panel

The review panel opens as an expanded card or slide-over within the Blueprint column. It presents retro items in sections:

**Memory Facts** — each item shows: synthesized content, importance, bank_id scope, what it supersedes (if anything). User controls: ✓ Approve / ✗ Reject / ✎ Edit.

**File Patches** — each item shows: target file, section, proposed content, rationale. User controls: ✓ Approve / ✗ Reject / ✎ Edit.

**Story Queue** — each item shows: proposed story title + rationale + priority. User controls: ✓ Queue as story / ✗ Dismiss.

**Conventions** — each item shows: standing convention + scope. User controls: ✓ Approve / ✗ Reject / ✎ Edit.

A summary bar at the bottom shows approved/rejected/pending counts. "Commit Approved Items" button is enabled when all items have a status (no `pending` remaining).

---

## Approval Commit

On `reporter:commit-retro`, the Reporter service executes atomically:

1. **Memory writes** — for each approved `memory_fact` item:
   - Insert row into `agent_memory` with `importance` 8–10, `event_type: 'memory_fact'`, `bank_id` from item
   - If `supersedes_memory_id` set: update that row's `importance` to 1 (effectively retired, still queryable)

2. **File patches** — for each approved `file_patch` item:
   - `fs.appendFile` or targeted section replacement on bounded doc files (skill `references/gotchas.md`, `CLAUDE.md` project-level rules block, `.claude/skills/README.md`)
   - Code-level targets are not patched inline — they are promoted to `story_queue` items automatically

3. **Story scaffolding** — for each approved `story_queue` item:
   - Call `scaffold_story.py` with title + rationale
   - New story file lands in `docs/stories/` at DRAFT status
   - Story ID appended to a `retro_originated_stories` field on the retro_report row

4. **Report status** → `approved`; retro card in Kanban transitions to archived state (compact badge in Blueprint footer)

All four steps run in a single async transaction. If any step fails, the entire commit rolls back and the retro returns to `pending_review`.

---

## Historical Archive

All approved retro reports are permanently stored and browsable. Access: Blueprint column footer → "Retrospectives" → expands an archive list. Each entry shows:

- Date range covered
- Item counts and approval rate
- Inflection chain (which prior retros it built on, as a linked list)
- Full item list (read-only, post-approval)

The archive view also surfaces the cumulative inflection chain as a timeline — a visual record of how project conventions have evolved across retros.

---

## Sub-Stories

| Story | Title | Depends On |
|-------|-------|------------|
| 499 | Reporter service: schema, IPC channels, lifecycle state machine | Epic 016 Story 470 |
| 500 | Retro synthesis engine: reads agent_memory + work_log + prior retros → RetroSynthesis structured output | 499 |
| 501 | Retro card: new `retro` card type in Blueprint column, `reporter:retro-ready` push wiring | 499 |
| 502 | Retro review panel: per-item approve/reject/edit UI, commit button | 501 |
| 503 | Approval commit: memory writes + file patches + story scaffold, atomic rollback | 502, Epic 016 Story 489 |
| 504 | Historical archive: retro list in Blueprint footer, inflection chain timeline | 503 |
| 505 | Retro trigger: session-count threshold (configurable, default 20) + manual trigger | 500 |

480 is the foundation — all others gate on it.
481 and 482 run in parallel once 480 lands.
483 gates on 482.
484 gates on 483.
485 gates on 484.
486 gates on 481 (needs synthesis to exist before trigger can fire it).

---

## Relationship to Other Epics

**Epic 016 (Universal Agent Memory)** — prerequisite. Reporter reads `agent_memory` and `agent_work_log`; commits write back to `agent_memory`. Story 470 (schema) must land before Story 480.

**Epic 009 (Hindsight)** — superseded for the Copernicus use case. The `reflect` operation is fully covered by:
- Story 473 (delta summary at model-switch time) — inline, session-level
- Epic 017 synthesis (cross-session, user-reviewed) — retrospective-level

Hindsight remains an optional PostgreSQL upgrade path for post-v1 high-volume deployments (HPH prop entity recognition at scale). Epic 009 status: **SUPERSEDED** pending a final decision on HPH infrastructure.

**Epic 014 (Skill Scaffolding)** — file patch items in a retro can update `references/gotchas.md` in any skill folder. The retro is the primary mechanism by which gotchas accumulate over time without manual curation. Story 484 should call Epic 014's description auditor (Story 465) after patching skill files.

---

## Acceptance Criteria (Epic Level)

- [ ] Reporter service starts with Electron app; tables created on first launch
- [ ] After 20 sessions of agent activity, a retro card appears automatically in Blueprint column
- [ ] Retro synthesis uses all prior approved retro reports as inflection context
- [ ] Review panel shows memory facts, file patches, story queue items, conventions — each with approve/reject/edit
- [ ] Commit is atomic: if file patch fails, memory writes roll back
- [ ] Approved memory facts appear in `memory_working_set` view with importance ≥ 8
- [ ] Superseded memory rows have importance set to 1, not deleted
- [ ] Approved file patches land correctly in skill gotchas and CLAUDE.md
- [ ] Approved story queue items scaffold new DRAFT stories in `docs/stories/`
- [ ] Historical archive shows full inflection chain per retro
- [ ] `tsc --noEmit` clean; `pytest` green

---

## Out of Scope

- Automatic retro approval without user review
- Retro synthesis for individual sessions (that is Story 473's job)
- Deletion of rejected memory rows (rejection sets item status only; no writes to agent_memory)
- Remote / shared retro reports across team members (single-user local deployment)
- Hindsight service integration (Epic 009, deferred)

---

## Frozen Surfaces

- `copernicus/src/renderer/components/kanban/KanbanBoard.tsx` — retro card is a new `type: 'retro'` card in Blueprint column; existing card layout and other card types unchanged
- `agent_memory` table — Reporter never deletes rows; commit only inserts new rows or updates `importance` of superseded rows
- Existing `SKILL.md` files — file patches target `references/gotchas.md` only; `SKILL.md` body is frozen

---

## Documentation Impact

- `docs/reference/TECHNICAL_BIBLE.md` — add "Retrospective Engine" section: Reporter service lifecycle, commit atomicity contract, inflection chain design
- `docs/reference/COMPLETION_PROTOCOL.md` — add retrospective check to Definition of Done: stories with persistent behavioral patterns should surface a retro item, not just a fix
