# Epic 018: Project Intelligence Layer

**Status:** ACTIVE
**Priority:** P1 — Product
**Phase:** Developer Experience

## Narrative

**As a** developer using Copernicus with any AI coding agent (Claude Code, Cursor, GitHub Copilot, Windsurf, Gemini CLI, or custom),
**I want** a single place to author, organise, and manage my project's agent instruction files —
**So that** I write my conventions once and Copernicus syncs them to every active agent's expected format and location, without knowing each provider's file layout by heart.

---

## Context

Every major AI coding agent uses some form of project instruction file:

| Provider | Instruction file | Modular rules | Agent personas | Skills/Workflows |
|----------|-----------------|---------------|----------------|-----------------|
| Claude Code | `CLAUDE.md` | `.claude/rules/*.md` (path-scoped) | `.claude/agents/*.md` | `.claude/skills/*/SKILL.md` |
| Cursor | `.cursorrules` | `.cursor/rules/*.mdc` (path-scoped) | — | — |
| GitHub Copilot | `.github/copilot-instructions.md` | — | — | — |
| Windsurf | `.windsurfrules` | — | — | — |
| Gemini CLI | `GEMINI.md` | — | — | — |
| Aider | `CONVENTIONS.md` | — | — | — |

Today, developers who use multiple agents must manually maintain separate files with duplicated content. When a convention changes, every provider file must be updated individually. Copernicus can own this synchronisation.

The Project Intelligence Layer introduces a canonical internal representation — **Intelligence Documents** — authored once in Copernicus and synced to each active provider's expected location and format on save. The sync engine knows the format rules for each provider (character limits, frontmatter conventions, path scoping syntax).

This is the agent-agnostic expansion of Epic 014 (Skill Scaffolding). Where Epic 014 generates Claude-specific `.claude/skills/`, Epic 018 manages the full intelligence surface across all providers.

---

## Goals

1. **Canonical Intelligence Documents** — a unified data model for project instructions, modular rules, agent personas, and skills. Provider-specific format is an output concern, not an authoring concern.
2. **Provider sync engine** — writes canonical documents to each provider's expected paths on save, handles format differences (frontmatter syntax, character limits, path-scope syntax).
3. **Intelligence Manager UI** — a panel in Copernicus where users view, create, edit, and organise all intelligence documents for their project, with per-provider sync status indicators.
4. **Stack-aware generation** — detect project stack (same heuristics as Epic 014 Story 460) and suggest intelligence documents appropriate to the project type.
5. **Epic 014 integration** — the skill scaffold generator (Story 463) outputs through the Intelligence Layer rather than writing `.claude/skills/` directly. Provider sync handles placement.
6. **Path scoping** — rules with a `pathScope` field are written with the correct path-scoping syntax for each provider (Claude uses `paths:` YAML frontmatter; Cursor uses `globs:` in `.mdc` frontmatter).
7. **CLAUDE.md length enforcement** — flag when a Claude Code instruction document exceeds the 200-line adherence threshold; suggest splitting into rules files.

---

## Intelligence Document Model

```typescript
interface IntelligenceDocument {
  id: string;                     // doc_<ulid>
  projectId: string;
  type: IntelligenceDocType;
  title: string;
  description: string;            // one-line: when does this apply?
  content: string;                // the markdown body
  pathScope?: string[];           // glob patterns — activates only on matching files
  toolRestrictions?: string[];    // for agent personas: allowed tool names
  preferredModel?: string;        // for agent personas: model hint
  providers: ProviderTarget[];    // which providers to sync to
  syncStatus: Record<ProviderKey, 'synced' | 'pending' | 'error' | 'unsupported'>;
  ts: number;
}

type IntelligenceDocType =
  | 'instruction'   // top-level project instructions (CLAUDE.md equivalent)
  | 'rule'          // modular scoped rule (.claude/rules/ equivalent)
  | 'agent'         // subagent persona (.claude/agents/ equivalent)
  | 'skill'         // autonomous workflow (.claude/skills/ equivalent)
  | 'command';      // slash command (.claude/commands/ equivalent)

type ProviderKey = 'claude' | 'cursor' | 'copilot' | 'windsurf' | 'gemini' | 'aider' | 'custom';

interface ProviderTarget {
  provider: ProviderKey;
  enabled: boolean;
}
```

---

## Provider Sync Map

The sync engine resolves each `(docType, provider)` pair to an output path and applies format transforms:

| Doc Type | Claude Code | Cursor | Copilot | Windsurf | Gemini | Aider |
|----------|-------------|--------|---------|----------|--------|-------|
| `instruction` | `CLAUDE.md` | `.cursorrules` | `.github/copilot-instructions.md` | `.windsurfrules` | `GEMINI.md` | `CONVENTIONS.md` |
| `rule` | `.claude/rules/<slug>.md` (+ `paths:` frontmatter) | `.cursor/rules/<slug>.mdc` (+ `globs:` frontmatter) | appended to instruction file | appended to instruction file | — | — |
| `agent` | `.claude/agents/<slug>.md` | — | — | — | — | — |
| `skill` | `.claude/skills/<slug>/SKILL.md` | — | — | — | — | — |
| `command` | `.claude/commands/<slug>.md` | — | — | — | — | — |

Providers that don't support a doc type set `syncStatus: 'unsupported'`. The user sees this in the sync status indicators — no silent failure.

---

## Intelligence Manager UI

A new panel accessible from the Kanban (Blueprint column card) and from Settings. Shows:

- **Document list** grouped by type (Instructions, Rules, Agents, Skills, Commands)
- **Per-document sync status** — coloured indicators per active provider (green = synced, amber = pending, red = error, grey = unsupported)
- **Editor pane** — markdown editor with frontmatter preview (shows what path-scoping syntax each provider will receive)
- **Provider toggle** — enable/disable sync to each provider per document
- **Length warning** — banner when an `instruction` document exceeds 200 lines for Claude Code

---

## Sub-Stories

| Story | Title | Depends On |
|-------|-------|------------|
| 507 | `intelligence_documents` schema + CRUD IPC handlers | — |
| 508 | Provider sync engine: resolve `(docType, provider)` → path + format transform, write on save | 507 |
| 509 | Intelligence Manager UI: document list + editor + sync status indicators | 508 |
| 510 | Stack detector integration: auto-suggest intelligence documents on project open (reuses Epic 014 Story 460 detector) | 489, Epic 014 Story 460 |
| 511 | Epic 014 bridge: skill scaffold generator outputs through Intelligence Layer instead of writing `.claude/skills/` directly | 490, Epic 014 Story 463 |
| 512 | Path scoping UI: `pathScope` field in editor with live preview of per-provider frontmatter output | 509 |
| 513 | CLAUDE.md length audit: flag `instruction` docs > 200 lines, suggest split into `rule` docs | 509 |

507 is the foundation. 508 gates on 507. 509 gates on 508. 512 and 513 parallelise once 509 lands. 510 gates on 507 and Epic 014 Story 460. 511 gates on Epic 014 Story 463.

---

## Acceptance Criteria (Epic Level)

- [ ] An `instruction` document authored in the Intelligence Manager writes to `CLAUDE.md`, `.cursorrules`, `.github/copilot-instructions.md`, and `.windsurfrules` simultaneously (for all enabled providers)
- [ ] A `rule` document with `pathScope: ['src/api/**/*.ts']` writes to `.claude/rules/<slug>.md` with `paths:` frontmatter for Claude and `.cursor/rules/<slug>.mdc` with `globs:` frontmatter for Cursor
- [ ] An `agent` document writes to `.claude/agents/<slug>.md`; Cursor shows `syncStatus: 'unsupported'`
- [ ] Sync status indicators update within 1 second of save
- [ ] `instruction` document > 200 lines triggers a warning banner in the editor with a "Split into rules" action
- [ ] Epic 014 skill scaffold output appears in the Intelligence Manager document list with correct `type: 'skill'`
- [ ] Stack detector suggests at least one intelligence document on first project open for a TypeScript/Electron project
- [ ] `tsc --noEmit` clean; `pytest` green

---

## Out of Scope

- Two-way sync (reading existing provider files back into Intelligence Documents) — write-only in v1
- Conflict resolution when provider files are edited outside Copernicus — v1 overwrites on save
- Custom provider definitions beyond the six listed — config-driven extension post-v1
- Real-time collaboration on intelligence documents across team members

---

## Frozen Surfaces

- `copernicus/src/renderer/components/kanban/KanbanBoard.tsx` — Intelligence Manager entry point is a Blueprint column card; existing layout unchanged
- Existing `.claude/skills/` files written by Epic 014 — Epic 018 migrates the generator forward; existing files are not retroactively reformatted

---

## Relationship to Other Epics

**Epic 014 (Skill Scaffolding)** — Epic 018 subsumes the file-writing responsibility. Story 493 is the bridge: after 018 ships, the scaffold generator calls the Intelligence Layer sync engine instead of writing directly. Epic 014's templates and stack detector remain unchanged.

**Epic 016 (Universal Agent Memory)** — intelligence documents are static configuration; agent memory is dynamic session context. No overlap, but the auto-extraction observer agents (Story 474) could surface suggested rule documents as retro items (Epic 017) if recurring patterns emerge.

**Epic 017 (Retrospective Engine)** — approved retro items of type `file_patch` targeting `.claude/rules/` or `CLAUDE.md` are routed through the Intelligence Layer sync engine, so the patch lands in all active providers, not just Claude Code.

---

## Documentation Impact

- `docs/reference/TECHNICAL_BIBLE.md` — add "Project Intelligence Layer" section: IntelligenceDocument model, provider sync map, path scoping syntax per provider
- `docs/reference/UX_BIBLE.md` — add "Intelligence Manager" panel spec: layout, sync status indicators, length warning pattern
