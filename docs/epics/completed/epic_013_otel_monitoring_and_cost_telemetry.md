# Epic 013: OTel Monitoring & Cost Telemetry

**Status:** COMPLETE
**Priority:** P2 — Observability
**Phase:** Platform Instrumentation

## Narrative

**As a** platform operator running multi-agent workflows,
**I want** a structured telemetry pipeline that correlates every Kanban dispatch to its API cost, token usage, and tool decisions,
**So that** the CAPEX view reflects real spend, the SQLite ledger survives Electron crashes, and I can trace any card from dispatch to merged PR.

---

## Context

Copernicus captures agent activity via IPC events and writes to the SQLite ledger, but two gaps exist:

1. **No prompt-scoped correlation ID.** There is no way to link a `workflow:step-start` event to a specific API call and its cost. If two agents run concurrently, their costs are unattributable to individual cards.
2. **Single write path.** All telemetry flows through IPC → Electron main → SQLite. An Electron crash drops the tail of any in-flight session with no recovery.

Claude Code emits a full OTel signal suite — `api_request` (cost, tokens, cache breakdown), `tool_result` (bash command, git commit SHA), `active_time`, `code_edit_tool.decision` — all correlated by `prompt.id`. Running an OTel Collector sidecar creates a second, IPC-independent write path into the same SQLite ledger, and `prompt.id` adoption in the IPC layer closes the correlation gap.

---

## Goals

1. Every Kanban card dispatch is traceable end-to-end: card → `prompt.id` → API call → cost → tool decisions → commit SHA.
2. `model_calls` table gains a second write path via OTel Collector → SQLite that is independent of the Electron IPC path.
3. CAPEX view gains cost-per-active-second breakdown using `active_time.total` (cli).
4. `code_edit_tool.decision.source` values map to card spotlight accept/reject stats.
5. `git_commit_id` from `tool_result` events is written to `model_calls` / `context_snapshots` without additional git IPC.

---

## Sub-Stories

| Story | Title | Depends On |
|---|---|---|
| 440 | OTel Collector sidecar — local OTLP receiver → SQLite writer | — |
| 441 | `CLAUDE_CODE_ENABLE_TELEMETRY=1` in managed settings + collector launch on app start | 440 |
| 442 | `prompt.id` added to `workflow:step-start` / `workflow:step-end` IPC events | — |
| 443 | `prompt.id` written to `model_calls` table; foreign-keyed to workflow step | 440, 442 |
| 444 | `active_time.total` (cli) → CAPEX cost-per-active-second column | 440 |
| 445 | `tool_result.git_commit_id` → `model_calls.commit_sha` column | 440 | ✅ delivered as story 456 |
| 446 | `code_edit_tool.decision.source` → card spotlight accept/reject stats | 442 |
| 447 | Crash recovery: re-hydrate `model_calls` from OTel Collector on Electron restart | 443 |

**Phase 2 — Copernicus statusline signal selector (depends on Phase 1 stable)**

| Story | Title | Depends On |
|---|---|---|
| 448 | Statusline IPC bridge: push statusline JSON to renderer on each assistant message | 440 |
| 449 | Selectable signal chips in Settings → Telemetry: model, cost, ctx%, cache hit rate, lines, worktree, RTK savings | 448 |
| 450 | Status bar renders selected chips; user preference persisted in settings store | 449 |

440 and 442 are independent and can run in parallel.
443 gates on both — it's the join point.
444, 445, 446 fan out from 440/442 in parallel.
447 is the terminal Phase 1 story.
448–450 are Phase 2 and require Phase 1 stable before activation.

---

## Acceptance Criteria (Epic Level)

- [ ] OTel Collector runs as a sidecar process launched by Electron main; PID tracked; killed on app exit
- [ ] `CLAUDE_CODE_ENABLE_TELEMETRY=1` present in `.claude/settings.json` managed block
- [ ] `api_request` events arrive in SQLite `model_calls` via OTel path — verified by killing IPC mid-session and confirming rows still written
- [ ] Every `workflow:step-start` event carries a `promptId` field (UUID v4)
- [ ] `model_calls` rows carry `prompt_id` foreign key; `SELECT` by card links to cost + token breakdown
- [ ] CAPEX view shows cost-per-active-second alongside existing cost-per-model
- [ ] `model_calls.commit_sha` populated on bash tool `git commit` calls — no extra git IPC
- [ ] Card spotlight shows accept/reject/abort counts sourced from `code_edit_tool.decision`
- [ ] After simulated Electron crash, `model_calls` re-hydrated from Collector on next launch
- [ ] `tsc --noEmit` clean; `pytest` green

---

## OTel Configuration

```bash
# Managed settings block (.claude/settings.json)
CLAUDE_CODE_ENABLE_TELEMETRY=1
OTEL_METRICS_EXPORTER=otlp
OTEL_LOGS_EXPORTER=otlp
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318   # Collector HTTP receiver
OTEL_EXPORTER_OTLP_METRICS_TEMPORALITY_PREFERENCE=cumulative
OTEL_LOG_TOOL_DETAILS=1                              # enables git_commit_id, bash_command
```

```yaml
# Collector config (collector/config.yaml)
receivers:
  otlp:
    protocols:
      http:
        endpoint: localhost:4318

exporters:
  sqlite:                        # custom exporter (Story 440)
    path: ${COPERNICUS_DB_PATH}

service:
  pipelines:
    metrics:
      receivers: [otlp]
      exporters: [sqlite]
    logs:
      receivers: [otlp]
      exporters: [sqlite]
```

---

## Out of Scope

- Remote / cloud OTel backends (Honeycomb, Datadog, ClickHouse) — local SQLite only in this epic
- Team-level aggregation across multiple machines — single-user local deployment
- Raw prompt text capture (`OTEL_LOG_USER_PROMPTS`) — privacy-sensitive, deferred
- Prometheus / Grafana dashboards — CAPEX view in Copernicus is the display layer

---

## Frozen Surfaces

- `copernicus/electron/workflow/engine.ts` — `promptId` added to existing event payloads only; no new event types
- `copernicus/src/renderer/components/capex/` — new cost-per-active-second column appended; no layout changes
- `copernicus/src/renderer/components/kanban/KanbanBoard.tsx` — accept/reject stats appended to existing card spotlight; no layout changes

---

## Scope (Implementation Files)

```
collector/config.yaml                                          (new)
collector/sqlite_exporter.py                                   (new — OTLP receiver → SQLite)
copernicus/electron/main.ts                                    (launch/kill collector sidecar)
copernicus/electron/workflow/engine.ts                         (add promptId to step events)
copernicus/electron/db/schema.ts                               (model_calls: prompt_id, commit_sha columns)
copernicus/src/renderer/components/capex/CapexView.tsx         (cost-per-active-second)
copernicus/src/renderer/components/kanban/CardSpotlight.tsx    (accept/reject/abort stats)
.claude/settings.json                                          (managed telemetry env vars)
```

---

## Documentation Impact

- `docs/reference/TECHNICAL_BIBLE.md` — add "Telemetry Pipeline" section: OTel Collector sidecar lifecycle, `prompt.id` contract, SQLite writer schema
- `docs/reference/COMPLETION_PROTOCOL.md` — add crash-recovery check to Definition of Done gate
