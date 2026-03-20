# Epic 012: Jules REST API Integration

**Status:** DRAFT — WAITING ON UPSTREAM
**Priority:** P2 — Infrastructure
**Phase:** Agent Dispatch Modernisation
**Blocked By:** Jules REST API exiting alpha (`https://jules.google/docs/api/reference/`)

## Narrative

**As a** platform operator dispatching implementation tasks,
**I want** Jules sessions created, monitored, and gated via the REST API rather than the Jules CLI binary,
**So that** dispatch is programmatic, plan approval is enforceable, and the CLI binary dependency is eliminated.

---

## Context

Jules is currently dispatched via `scripts/jules_assign.sh` which shells out to the `jules` CLI binary. The binary is a black box — no structured output, no plan approval gate, no activity feed. Jules has published a REST API (alpha as of 2026-03-19) that exposes the full session lifecycle: create, poll, approve plan, steer, and wait for the PR.

### What the API provides

| Endpoint | Purpose |
|---|---|
| `GET /v1alpha/sources` | List connected repos |
| `POST /v1alpha/sessions` | Create a session (dispatch a task) |
| `GET /v1alpha/sessions/{id}/activities` | Poll progress |
| `POST /v1alpha/sessions/{id}:approvePlan` | Gate execution on plan review |
| `POST /v1alpha/sessions/{id}:sendMessage` | Follow-up / steer mid-session |

Auth: `X-Goog-Api-Key` header. Keys from jules.google.com/settings (max 3). No OAuth.
No SDK — raw HTTP only. No "apply patch" endpoint — output is a GitHub PR, applied via `gh pr merge`.

### Why we are waiting

The API carries an explicit alpha warning. Auth scheme, endpoint paths, and response schemas may change without notice. Integrating now creates churn. The trigger to activate this epic is **any of**:

- API graduates to `v1beta` or `v1`
- Auth moves to OAuth (signals stability intent)
- A breaking change freeze is announced on the Jules changelog

Monitor: https://jules.google/docs/api/reference/ and https://jules.google/changelog

---

## Goals

1. `jules_assign.sh` is replaced by `backend/routes/jules.py` — a thin REST client over the Jules API.
2. Plan approval (`requirePlanApproval: true`) is wired into the Kanban story dispatch flow — Claude reviews the plan before Jules writes code.
3. Activity polling feeds into the existing `workflow:step-start` / `workflow:step-end` IPC event stream.
4. "Apply" step is `gh pr merge --squash` via the existing git tooling — no `jules remote pull`.
5. Jules API key managed by `AuthManager` alongside other provider keys — never in renderer.

---

## Sub-Stories

| Story | Title | Depends On |
|---|---|---|
| 430 | `AuthManager` Jules provider + `auth:jules-status` IPC | — |
| 431 | `JulesClient` Python class (`backend/services/jules_client.py`) | 430 |
| 432 | Replace `jules_assign.sh` with `POST /v1alpha/sessions` dispatch | 431 |
| 433 | Activity poller → `workflow:step-start/end` IPC bridge | 432 |
| 434 | Plan approval gate — Kanban "Approve Plan" action | 433 |
| 435 | `sendMessage` steer — Kanban "Steer Jules" action | 434 |
| 436 | `gh pr merge` apply step wired to session completion event | 433 |
| 437 | Remove `jules` CLI binary dependency; update AGENTS.md | 432–436 |

432 and 436 can run in parallel once 431 merges.
434 and 435 can run in parallel once 433 merges.
437 is the terminal story — nothing ships until it's clean.

---

## Acceptance Criteria (Epic Level)

- [ ] `jules_assign.sh` deleted; no remaining references in dispatch scripts
- [ ] `POST /v1alpha/sessions` with `requirePlanApproval: true` — Jules pauses at plan; Kanban shows "Awaiting Plan Approval" badge
- [ ] Claude reviews plan text surfaced via `GET /v1alpha/sessions/{id}/activities`; approves via `POST :approvePlan`
- [ ] Activity events map to `workflow:step-start` / `workflow:step-end` — VS Code task panel shows live progress
- [ ] On session completion, `gh pr merge --squash` applied automatically; Kanban card advances to REVIEW
- [ ] Jules API key stored via `AuthManager.getApiKey('jules')` — `strings` on any renderer bundle contains no key material
- [ ] `tsc --noEmit` clean; `pytest` green
- [ ] `jules` CLI binary absent from CI image — build passes without it

---

## Out of Scope (this epic)

- Multi-session parallelism for Jules (API has no documented concurrency guarantees)
- Jules session sandboxing (handled by Epic 011 — OpenShell wraps the *host* process; Jules runs server-side)
- PR conflict resolution (manual; deferred)
- Streaming activity feed (API is poll-only; streaming deferred until upstream adds it)

---

## Frozen Surfaces

- `copernicus/electron/workflow/engine.ts` — activity events mapped to existing `step-start/end` payloads; no new event types
- `copernicus/src/renderer/components/kanban/KanbanBoard.tsx` — "Approve Plan" and "Steer Jules" are new badge actions appended to the existing card action row; no layout changes

---

## Scope (Implementation Files)

```
backend/routes/jules.py                        (new)
backend/services/jules_client.py               (new)
backend/services/auth_manager.py               (add jules provider)
scripts/jules_assign.sh                        (deleted)
copernicus/electron/main.ts                    (auth:jules-status IPC)
copernicus/electron/preload.ts                 (expose auth:jules-status)
copernicus/src/renderer/components/kanban/KanbanBoard.tsx   (plan approval badge)
docs/reference/AGENTS.md                       (update Jules dispatch section)
```

---

## Activation Checklist

Before activating this epic, verify all of the following:

- [ ] Jules API is `v1beta` or `v1` (not `v1alpha`)
- [ ] Auth scheme confirmed stable (API key header or OAuth)
- [ ] `POST /v1alpha/sessions` response schema has not changed from the version documented here
- [ ] At least one internal test run against the live API succeeds end-to-end
- [ ] Story numbers 430–437 are unoccupied in `docs/stories/`

---

## Documentation Impact

- `docs/reference/AGENTS.md` — replace Jules CLI dispatch section with REST API flow
- `docs/reference/TECHNICAL_BIBLE.md` — add Jules API key to AuthManager provider table
- `CLAUDE.md` — remove `jules remote pull --session <ID> --apply` from Jules Review Protocol; replace with `gh pr merge` step
