# Epic 019: GSD-Pattern Workflow Execution

**Status:** ACTIVE
**Priority:** P1 — Workflow Intelligence
**Phase:** Workflow Engine Enhancement

## Narrative

**As a** developer orchestrating multi-agent work through Copernicus,
**I want** the workflow engine to decompose stories into dependency-aware execution waves, spawn agents with situationally-assembled context (not accumulated conversation history), verify plans before any code is written, and hand off intelligently when agents fail or get stuck —
**So that** parallel execution is automatic rather than manually orchestrated, context rot is structurally prevented, broken agents hand off their failure history rather than a clean slate, and the plan-checker catches spec ambiguity before it becomes broken code.

---

## Context

GSD (Get Shit Done, 39K stars) is a meta-prompting framework built around a core insight: AI coding quality degrades with context accumulation — not because the model gets worse, but because accumulated conversation history dilutes the signal of the actual task. GSD's solution is fresh 200K context per agent, assembled from structured file-based artifacts.

Copernicus adopts GSD's **execution patterns** but rejects its file-based state layer. Our argument:

1. **SQLite over files**: If state can be structured in a file, it can be structured in SQLite. We have WAL-mode SQLite with ACID transactions. GSD uses `.planning/STATE.md` with `O_EXCL` file locks because it has no database. We do. No lock files, no spin-wait.

2. **History is the recovery asset**: GSD's fresh-context model optimises for the happy path. But when an agent gets stuck, makes mistakes, or has to be replaced, a clean-slate replacement is the worst possible handoff — it will attempt the same approach and hit the same wall. The incoming agent needs the failure brief from `agent_work_log`, not a blank prompt. Context history is the recovery asset.

The result is a **situational context model**: fresh-assembled context for clean wave transitions; curated failure context from `agent_work_log` for recovery handoffs. Better than GSD's single strategy.

---

## Goals

1. **Wave executor** — analyse `Blocks:`/`Blocked By:` graph across in-flight stories, group independent work into parallel waves, dispatch sequentially between waves.
2. **Plan-checker node** — read-only verification agent reviews the assembled execution plan against story ACs before any executor fires. Max 3 cycles. Blocks execution on spec ambiguity.
3. **Context assembler node** — before each agent node fires, queries SQLite (Kanban story + `agent_memory` relevant rows + handoff context) and constructs a clean prompt payload. No conversation history leaked.
4. **Recovery handoff** — when an agent is marked `stuck | failed | manual_remove`, the next agent receives a structured failure brief from `agent_work_log`: what was tried, what failed, last confirmed good state.
5. **Situational handoff routing** — the workflow engine classifies each transition and routes to the appropriate context assembly strategy.
6. **Agent role taxonomy** — 6 role types available as workflow node labels: `researcher | planner | checker | executor | verifier | auditor`. Each has a default model tier and tool restriction policy.

---

## The Situational Context Model

| Handoff type | Trigger condition | Context assembled |
|---|---|---|
| **Wave transition** | Prior agent completed cleanly (`status: done`) | Story ACs + relevant `agent_memory` rows + prior wave summaries |
| **Recovery** | Agent status: `stuck \| failed \| manual_remove` | Full `agent_work_log` for prior agent's run + failure classification + last confirmed good state + story ACs |
| **Model switch** | User swapped model mid-task | Delta summary (Story 492) + story ACs + relevant memory |
| **Escalation** | Plan-checker refused 3×, escalating to heavier model | Plan critique history + original spec |

Recovery context is richer than GSD's fresh context — not noisier, because it's curated from structured `agent_work_log` rows, not raw chat. The incoming agent reads a structured failure brief, not a wall of conversation.

---

## Agent Role Taxonomy

6 roles map to workflow node types. Each has a default model tier and tool restriction:

| Role | Default model tier | Tool policy | Typical use |
|------|--------------------|-------------|-------------|
| `researcher` | `fast` | Read, WebFetch, Grep, Glob | Stack analysis, spec research |
| `planner` | `thinker` | Read, Grep, Glob (no write) | Phase breakdown, XML plan generation |
| `checker` | `fast` | Read, Grep, Glob (no write, no exec) | Plan verification, AC coverage audit |
| `executor` | `coder` | All tools | Implementation |
| `verifier` | `fast` | Read, Grep, Glob, Bash (no write) | Post-execution AC verification |
| `auditor` | `fast` | Read, Grep, Glob (no write, no exec) | Test coverage, security, style |

Model tier maps to `cloud_agent.py` roles. Tool policy enforces principle of least privilege — checkers and auditors never write files.

---

## Wave Execution Design

The wave executor analyses the `Blocks:`/`Blocked By:` graph for all stories currently in a sprint and groups them into waves:

```
Wave 1: Story 489 (no deps), Story 507 (no deps)   → parallel dispatch
Wave 2: Story 490 (blocked by 489), Story 499 (blocked by 489)  → parallel after Wave 1
Wave 3: Story 491 (blocked by 490)  → sequential after Wave 2
...
```

Wave boundaries are re-evaluated after each wave completes — a wave that unblocks multiple downstream stories launches them in parallel in the next wave.

**Parallel dispatch limit**: configurable, default 3 concurrent agents (matching GSD's default). Prevents API rate throttling and resource contention.

**Wave state in SQLite**: each wave is a row in `workflow_waves` table. Agent completion updates the row. The next wave launches when all agents in the current wave reach `done` or `failed`.

---

## Plan-Checker Design

The plan-checker is a read-only `checker` role node that runs between the planner node and the first executor wave. It receives:
- The assembled execution plan (story ACs + context assembler output)
- The story's Definition of Done criteria
- The frozen surfaces list

It outputs a structured verdict:
```typescript
interface PlanCheckResult {
  verdict: 'approved' | 'revision_required' | 'blocked';
  issues: Array<{ severity: 'error' | 'warning'; description: string }>;
  revision_request?: string;  // if verdict = 'revision_required'
}
```

On `revision_required`: the planner node regenerates, max 3 cycles. On `blocked` after 3 cycles: the workflow escalates to a `thinker` role for the planner step and resets the check counter once.

---

## Sub-Stories

| Story | Title | Depends On |
|-------|-------|------------|
| 514 | Wave executor: `Blocks:`/`Blocked By:` graph analysis → wave groups → parallel dispatch | Epic 016 Story 494 (work log) |
| 515 | Plan-checker node: read-only verifier, 3-cycle loop, escalation on block | 514 |
| 516 | Context assembler node: SQLite query → clean prompt payload, no conversation history | Epic 016 Story 489 |
| 517 | Recovery handoff: `agent_work_log` failure brief assembly on `stuck\|failed\|manual_remove` | Epic 016 Story 494 |
| 518 | Situational handoff router: classify transition type → route to correct assembler | 516, 517 |
| 519 | Agent role taxonomy: 6 role types as workflow node labels, model tier + tool policy defaults | — |

519 is standalone — add role types to workflow node schema with no engine dependency.
516 gates on Epic 016 Story 489 (schema must exist).
517 gates on Epic 016 Story 494 (work log hooks must be writing).
514 gates on 494 (needs work log to track wave state).
515 gates on 514.
518 gates on 516 and 517.

---

## Relationship to Other Epics

**Epic 016 (Universal Agent Memory)** — the context assembler (Story 516) reads `agent_memory` via the `memory_working_set` view. The recovery handoff (Story 517) reads `agent_work_log`. Story 494 (work log hooks) must land before Story 517 can fire.

**Epic 017 (Retrospective Engine)** — the retro synthesis agent is a `researcher` role node. Wave execution (Story 514) can dispatch the retro synthesis as a wave-0 task before the main sprint begins. GSD's VERIFICATION.md pattern maps to Story 503 (retro approval commit).

**Epic 018 (Project Intelligence Layer)** — the researcher nodes read intelligence documents as part of their context bundle. The context assembler (Story 516) queries intelligence documents alongside `agent_memory`. The plan-checker (Story 515) reads frozen surfaces from intelligence documents.

---

## Acceptance Criteria (Epic Level)

- [ ] A sprint with 5 stories (3 independent, 2 blocked) dispatches waves correctly: Wave 1 = 3 parallel, Wave 2 = 2 parallel after Wave 1 completes
- [ ] Plan-checker blocks executor launch on a plan with ambiguous ACs; planner revises; checker approves on second cycle
- [ ] Context assembler produces a clean prompt payload with zero conversation history, verified by reading the dispatched prompt from `agent_work_log`
- [ ] Recovery handoff delivers structured failure brief to replacement agent; replacement agent does not repeat the failed approach (verified via `agent_work_log` tool call sequence)
- [ ] Wave executor respects max concurrent agent limit (default 3)
- [ ] `checker` and `auditor` role nodes have `Write` and `Edit` tools stripped from their tool list
- [ ] `tsc --noEmit` clean; `pytest` green

---

## Out of Scope

- GSD's `.planning/` file system — all state in SQLite
- GSD's 44 slash commands — Copernicus Kanban replaces the PM layer
- File-based STATE.md locking — SQLite WAL handles concurrent writes
- GSD's Nyquist test coverage auditor — deferred, potential Story 520

---

## Frozen Surfaces

- `copernicus/electron/workflow/engine.ts` — wave executor extends the existing engine; no existing dispatch paths changed, only new wave orchestration layer added
- `copernicus/electron/workflow/types.ts` — new `WFNodeRole` type added; existing `WFNode` fields unchanged
