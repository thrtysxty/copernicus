# Epic 016: Universal Agent Memory & Work Log

**Status:** COMPLETE
**Priority:** P1 — Platform Foundation
**Phase:** Agent Transparency

## Narrative

**As a** developer using Copernicus to orchestrate agent swarms,
**I want** every agent in the system — chat, workflow nodes, orchestrators, and swarms — to share a persistent, scoped memory and work log that survives across sessions,
**So that** agents walk into every session already aware of prior decisions, file changes, and cross-agent work, and I can trace any agent action back to the exact file, line, and moment it happened.

---

## Context

Copernicus's core value is agent transparency: users can see what agents did, why they did it, and the system remembers across sessions. Today that promise is broken at the foundation:

1. **Memory injection is wrong.** `db:search-memory` injects memories as a fake assistant chat bubble — visible in the UI, sent as `role: 'assistant'` in subsequent API calls. Agents see prior facts as chat history, not as grounding context.
2. **Auto-extraction never runs.** Story 158 specified a heuristic extractor on `chat:done`. It was never implemented. Memory only grows via the manual Save button.
3. **Memory is chat-only.** `project_memory` has no concept of `bank_id`. Workflow nodes, orchestrators, and agent swarms write nothing. The chat agent has no awareness of what the rest of Copernicus has been doing.
4. **Model switches are expensive.** The `[CONTEXT HANDOFF]` pattern prepends the full prior conversation to the first message on every model switch. At 50 turns that can be 20,000+ tokens injected at full cost every time.
5. **No work log.** File edits, tool calls, git commits, and agent spawns from agents are not recorded. There is no way to trace what any agent did at the file level.

The fix is a four-layer memory architecture — stable system prompt, fast SQLite recall, cheap-model delta summary, and on-demand tool-use recall — backed by a unified `agent_memory` table and `agent_work_log` table scoped by `bank_id` across every agent type in the system.

---

## Goals

1. Every agent type (chat, workflow node, orchestrator, swarm member) writes memory and work log entries to a unified store scoped by `bank_id`.
2. Memory injection is replaced with a tiered retrieval architecture that bounds token cost by design.
3. The `[CONTEXT HANDOFF]` full-history injection on model switch is replaced with a cheap-model delta summary — pay once for compression, not once per message.
4. Auto-extraction fires on every `chat:done` — memory grows without user action.
5. Every file edit, tool call, git commit, and agent spawn is recorded in the work log with the file path and line range needed for source navigation.
6. MemoryBrowser is upgraded to a cross-agent timeline — click any entry to open the exact file and line the agent touched.
7. From any source file, the LSP surfaces every agent that has touched it and when.
8. Hindsight (Epic 009, stories 467–469) swaps the SQLite backend for self-hosters — the `bank_id` scoping, injection pattern, and event taxonomy defined here are unchanged.

---

## The Four-Layer Memory Architecture

### Layer 1 — Stable System Prompt (cached, near-zero recurring cost)

A single `SystemPromptBuilder` class produces provider-agnostic content: project identity, agent persona, current task context, key conventions. Provider adapters handle delivery and caching:

| Provider | Delivery | Caching |
|---|---|---|
| Anthropic | `system` parameter | `cache_control: { type: 'ephemeral' }` on the block |
| OpenAI | `messages[0] = { role: 'system' }` | Automatic on prompts >1024 tokens |
| Google | `systemInstruction` parameter | `cachedContent` API if >32k tokens |
| Ollama | `messages[0] = { role: 'system' }` | None — also no cost |
| OpenRouter / DeepInfra | `messages[0] = { role: 'system' }` | Backend-dependent |
| Custom (OpenAI-compat) | `messages[0] = { role: 'system' }` | None assumed; fallback: prepend as first user message |

Content is always the same text regardless of provider. Caching is an optimization on top — the prompt is still cheaper than history injection even without a cache hit.

### Layer 2 — SQLite View Recall (sub-millisecond, always current)

A `memory_working_set` view pre-computes importance × recency scoring. On session start and model switch, `MemoryRecall` queries the view directly — no file parse, no index rebuild, no sync timing:

```sql
CREATE VIEW memory_working_set AS
SELECT *,
  importance * (1.0 / (1.0 + (unixepoch('now') - ts) / 3600.0 * 0.1)) AS score
FROM agent_memory
WHERE project_id = :project
ORDER BY score DESC;
```

`MemoryRecall.recall(bankId, query, n, scope)` returns top-N rows. Scope controls read breadth:

| Scope | Used by | Gets |
|---|---|---|
| `'self'` | Workflow nodes, swarm members | Own bank_id only |
| `'project'` | Chat agent | All bank_ids for this project |
| `BankId[]` | Orchestrators | Explicit list of child node bank_ids |

The chat agent uses `scope: 'project'` — it is the synthesis point for the entire system and should have ambient awareness of everything every other agent has done.

**Differentiated window sizes (cost controls):**

| bank_id pattern | Window (rows) | Recall depth (injected) |
|---|---|---|
| `chat` | 200 | 5 (default, configurable) |
| `orchestrator:*` | 100 | 5 |
| `workflow:node:*` | 50 | 3 |
| `agent:*` | 50 | 3 |

Window and recall depth are user-configurable in Settings → Memory. They directly bound maximum Layer 2 injection cost:
```
5 rows × avg 60 tokens = 300 tokens max injected per session start
```

### Layer 3 — Delta Summary on Model Switch (cheap model, one-time compression)

Replaces the `[CONTEXT HANDOFF]` full-history injection. On model switch:

1. Record `last_seen_ts` for this `bank_id` × `model_id` pair
2. Query `agent_memory WHERE ts > last_seen_ts` for this bank_id — only what changed since this model last ran
3. Route delta through a cheap/fast model (local Ollama or `gpt-oss:20b`) for compression to ≤150 tokens
4. Inject compressed summary as the first user message prefix on the new model's first call

Pay once for compression at low cost. The new model gets a targeted summary, not a full transcript.

### Layer 4 — Tool-Use Recall (on-demand, orchestrators only)

Workflow nodes and orchestrators receive a `recall_memory(query: string)` tool. Nothing is injected upfront — the agent requests what it needs, when it needs it. Zero injection cost on calls where memory isn't needed.

---

## `bank_id` Taxonomy

```
chat                          — main chat panel
chat:<panelId>                — named or multi-instance chat panel
workflow:<workflowId>         — workflow orchestrator
workflow:node:<nodeId>        — individual workflow agent node
agent:<name>                  — named agents (Jules, Gemini)
orchestrator:<workflowId>     — orchestrator-level records
```

**Write:** each agent writes only to its own `bank_id`.
**Read:** determined by scope. Chat reads project-wide. Workflow nodes read self only.

---

## Event Taxonomy

| event_type | Written by | meta fields |
|---|---|---|
| `memory_fact` | Any agent (auto-extract or manual) | `source: 'auto'|'manual'`, `importance` |
| `decision` | Workflow engine | `branch`, `node_id`, `reason` |
| `tool_call` | Workflow nodes, chat agents | `tool`, `command`, `exit_code` |
| `file_edit` | Any agent that modifies files | `file`, `range.start.line`, `range.end.line`, `description` |
| `git_commit` | Orchestrator, workflow nodes | `sha`, `files[]`, `story`, `message` |
| `agent_spawn` | Orchestrator | `agent_type`, `prompt_summary`, `story`, `session_id` |
| `context_handoff` | Orchestrator | `from_bank_id`, `to_bank_id`, `summary` |
| `model_switch` | Chat agent | `from_model`, `to_model`, `panel_id` |
| `session_start` | Any agent | `model`, `scope` |
| `skill_pattern` | Retro engine, auto-extractor | `skill_name`, `invocation_count`, `generalised_from: memory_id[]`, `description` |

---

## Schema

### `agent_memory` (replaces and generalises `project_memory`)

```sql
CREATE TABLE agent_memory (
  id          TEXT PRIMARY KEY,          -- mem_<ulid>
  project_id  TEXT NOT NULL,
  bank_id     TEXT NOT NULL,             -- bank_id taxonomy above
  event_type  TEXT NOT NULL,             -- event taxonomy above
  content     TEXT NOT NULL,             -- human-readable, injection-ready
  importance  INTEGER NOT NULL DEFAULT 5,
  tags        TEXT,                      -- JSON array of searchable terms
  entities    TEXT,                      -- JSON array of proper nouns, symbols, paths
  meta        TEXT,                      -- JSON blob (file, range, sha, story, etc.)
  ts          INTEGER NOT NULL           -- unix timestamp
);

CREATE INDEX idx_agent_memory_project_bank ON agent_memory(project_id, bank_id);
CREATE INDEX idx_agent_memory_ts ON agent_memory(ts);
```

**Migration:** on first launch after this story, copy all `project_memory` rows to `agent_memory` with `bank_id = 'chat'` and `event_type = 'memory_fact'`.

### `agent_work_log` (append-only audit trail)

```sql
CREATE TABLE agent_work_log (
  id          TEXT PRIMARY KEY,
  project_id  TEXT NOT NULL,
  bank_id     TEXT NOT NULL,
  event_type  TEXT NOT NULL,            -- file_edit | tool_call | git_commit | agent_spawn
  meta        TEXT NOT NULL,            -- JSON: file+range, sha+files, command+exit, etc.
  ts          INTEGER NOT NULL
);

CREATE INDEX idx_work_log_project ON agent_work_log(project_id, ts);
CREATE INDEX idx_work_log_bank ON agent_work_log(bank_id, ts);
```

The work log is append-only and never injected wholesale. It is queried by MemoryBrowser and the LSP file-history feature.

---

## JSONL Export (Transparency Artifact)

The JSONL files are **not** the retrieval mechanism — the SQLite view is. JSONL is a human-readable, editable transparency artifact written on a background export cycle (not on the hot path).

**Location:** `~/Library/Application Support/Copernicus/memory/<projectHash>/<bank_id>.jsonl`

**Structure:**
```jsonl
{"id":"mem_001","bank_id":"chat","tags":["ipc","handleIpc"],"entities":["handleIpc","ipcMain"],"content":"handleIpc wrapper required on all ipcMain.handle registrations","importance":10,"event_type":"memory_fact","ts":1742000300}
{"id":"mem_004","bank_id":"orchestrator","tags":["story-441","merge"],"entities":["b7a3231","StatusBar.tsx"],"content":"Jules merged story 441 StatusBar crash fix","importance":7,"event_type":"git_commit","meta":{"sha":"b7a3231","files":["copernicus/src/renderer/components/layout/StatusBar.tsx"],"story":441},"ts":1742000500}
```

The LSP indexes these files. `id` is the symbol name. `tags` and `entities` are symbol aliases. `meta.file` and `meta.range` are the navigation targets.

---

## LSP Navigation

### MemoryBrowser → source file (click to navigate)

Click handler on any `file_edit` or `git_commit` memory entry:
- Single file: reads `meta.file` + `meta.range` → `fs:open-file` IPC → Monaco scrolls to line
- Multiple files (`meta.files[]`): shows inline file picker → selected file opens at top of change

No LSP required. Structured `meta` fields + existing `fs:open-file` IPC.

### Source file → agent history (reverse navigation)

When a file is open in Monaco, the LSP queries the JSONL index for all memory nodes where `meta.file` or `meta.files[]` contains the current file path. Results surface as:
- Gutter annotations: agent icon + timestamp on lines that were touched
- MemoryBrowser side panel filter: "History for this file" showing all agents, events, dates

This requires the LSP manager to index JSONL files in the watched file set and handle `workspace/symbol` queries scoped to a file path.

---

## Sub-Stories

| Story | Title | Depends On |
|---|---|---|
| 489 | `agent_memory` schema + `memory_working_set` view + migration from `project_memory` | — |
| 490 | `SystemPromptBuilder` + provider adapters — Layer 1 stable system prompt | — |
| 491 | `MemoryRecall` + session-start injection fix — Layer 2 SQLite view recall | 489 |
| 492 | Layer 3 delta summary on model switch — replace `[CONTEXT HANDOFF]` injection | 491 |
| 493 | Auto-extraction on `chat:done` — heuristic scorer, importance 3 auto-save | 489 |
| 494 | `agent_work_log` table + capture hooks — file_edit, tool_call, git_commit, agent_spawn | 489 |
| 495 | WorkflowEngine + orchestrator memory writes — bank_id per node, step events | 494 |
| 496 | JSONL export cycle + JSON Schema + LSP file-watch registration | 489 |
| 497 | MemoryBrowser upgrade — timeline, cross-agent search, click-to-file, source history | 496 |
| 498 | Layer 4 tool-use recall — `recall_memory()` tool for workflow nodes | 491 |

**Dependency order:**
- 489 and 490 are independent — run in parallel
- 491, 493, 494, 496 all gate on 489
- 492 gates on 491
- 495 gates on 494
- 497 gates on 496
- 498 gates on 491
- 493, 494, 496 can run in parallel once 489 merges

---

## Acceptance Criteria (Epic Level)

- [ ] `agent_memory` table present; all `project_memory` rows migrated with `bank_id = 'chat'`
- [ ] `memory_working_set` view returns correctly scored rows for a given `project_id`
- [ ] Chat agent session start: memories injected as system context, not as an assistant chat bubble
- [ ] `db:search-memory` fake bubble injection removed from `useChatPanel.ts`
- [ ] Auto-extraction fires on `chat:done` — at least one memory row written per substantive response without user action
- [ ] Model switch uses Layer 3 delta summary — `[CONTEXT HANDOFF]` full-history injection is gone
- [ ] WorkflowEngine writes `session_start`, `decision`, and `session_end` events per node run
- [ ] Orchestrator writes `agent_spawn` record when dispatching Jules / Gemini
- [ ] `agent_work_log` records `file_edit` events with `meta.file` and `meta.range` populated
- [ ] `agent_work_log` records `git_commit` events with `meta.sha` and `meta.files[]` populated
- [ ] MemoryBrowser: clicking a `file_edit` entry opens the file at the correct line
- [ ] MemoryBrowser: clicking a `git_commit` entry shows a file picker and opens selected file
- [ ] MemoryBrowser: timeline view filterable by `bank_id`
- [ ] LSP: opening a source file shows agent history entries referencing that file
- [ ] JSONL export files present at `userData/memory/<projectHash>/<bank_id>.jsonl` after first write cycle
- [ ] Settings → Memory: recall depth and window size configurable, persisted
- [ ] `tsc --noEmit` clean; `pytest` green

---

## Frozen Surfaces

- All existing provider implementations (`google.py`, `anthropic.py`, `openai.py`, `ollama.py`) — no changes to LLM call logic; `SystemPromptBuilder` output is injected by the provider adapter, not by modifying provider internals
- `register-all-handlers.ts` existing registrations — append only
- `WorkflowEngine` execution logic — memory writes are hooks on existing events; no changes to node execution, state machine, or edge traversal
- `ChatPanel` and streaming pipeline — memory injection happens before `chat:send`; no changes to the panel itself
- `KanbanBoard.tsx` — no changes
- All existing IPC channel signatures — new channels added, none changed

---

## Hindsight Relationship (Epic 009)

Stories 467–469 remain valid and unchanged. Hindsight is the optional backend upgrade for self-hosters with a Docker host:
- Story 467 deploys Hindsight on R210 ii with the health-check IPC
- Story 468 swaps the `addAgentMemory` / `recall` calls from SQLite to Hindsight `retain` / `recall` — the `bank_id` taxonomy, event types, and injection pattern defined here are identical
- Story 469 adds Hindsight `reflect` synthesis at session start

Epic 016 must be complete before story 468 is dispatched. There is no value in wiring Hindsight onto broken injection — the SQLite path must work correctly first so there is a baseline to compare against.

---

## Out of Scope

- Remote / cloud memory backends — local SQLite for all users, Hindsight for self-hosters (Epic 009)
- Shared team memory across machines — single-user, single-project scope
- Embedding-based semantic search — importance × recency × keyword overlap is sufficient; embeddings are a future upgrade
- Raw prompt text capture — privacy-sensitive, deferred
- Automatic JSONL commit to git — opt-in only, not default behaviour

---

## Documentation Impact

- `docs/reference/TECHNICAL_BIBLE.md` — add "Universal Agent Memory" section: `bank_id` taxonomy, event taxonomy, `memory_working_set` view contract, Layer 1–4 architecture, JSONL export path, LSP navigation contract
- `docs/reference/TECHNICAL_BIBLE.md` — mark `project_memory` table as deprecated; forward to `agent_memory`
- `docs/reference/COMPLETION_PROTOCOL.md` — add memory hygiene check: verify `db:search-memory` is not injecting fake bubbles after any story that touches `useChatPanel.ts`
