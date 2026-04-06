# Phase 6: The Configurable Agent Hub

**Status:** Vision / Pre-Implementation
**Authors:** Jeremy Thiessen + Claude
**Date:** 2026-04-06

---

## The Mental Model

Copernicus is an IDE. It is also a company.

When a user opens Copernicus and connects a provider:model, they are not configuring a tool — they are **hiring a worker**. That worker is given a role. The role carries authority. Some roles regulate others. The whole thing is transparent, auditable, and owned by the user.

The **Hub** is the org chart made operational. It is a loop controller and authority registry — not a dispatcher and not an executor. Every agent action routes through it for authority enforcement. The adapters dispatch. The agents execute. The Hub governs.

---

## The Shape of Work: Nested Loops, Not an Arc

The workflow is not a linear arc from planning to deployment. It is a **loop controller managing nested iterative loops**. No loop advances on step completion — it advances on **verified closing condition**.

```
Outer loop: Backlog → Verified (runs continuously)
│
├── Planning loop        closes when: story fully spec'd, ACs defined
├── Implementation loop  closes when: all ACs met, Reviewer returns APPROVED
│     └── Revision loop      closes when: BLOCKED items resolved
├── Test loop            closes when: suite passes, zero failures
└── Acceptance loop      closes when: user acceptance criteria verified
```

**Set-and-forget mode:** The Hub runs all loops autonomously. Human authority is escalated only for actions that exceed token scope — merge to main, contract amendment, acceptance criteria requiring human judgment. Everything else closes automatically.

---

## Roles

Every hired agent has exactly one role per session. Roles are agent-agnostic — the role defines what is done and with what authority. The provider:model is the worker hired to fill it.

### Pre-Work (Operational)

| Role | Authority | Closes When |
|------|-----------|-------------|
| Architect | L4 | Story spec complete, ACs defined |
| Product Owner | L3 | Backlog groomed, sprint planned |
| Designer | L3 | UI spec complete, Stitch assets ready |
| Researcher | L2 | Spike report delivered |

### Implementation (Operational)

| Role | Authority | Closes When |
|------|-----------|-------------|
| Coder | L2 | APPROVED review, all ACs met |
| Tester | L2 | Test suite passes, zero failures |
| Git Manager | L3 | Worktrees merged, branch clean |
| Deploy | L4 | Released to main |

### Cross-Cutting (Regulatory — always active)

| Role | Authority | Domain |
|------|-----------|--------|
| Reviewer | L3 | PR diffs, AC verification |
| Security Sentinel | L5 | Security, secrets — overrides all |
| Compliance Auditor | L4 | Policy enforcement |
| Classifier | L2 | Tool use enforcement |
| Loop Operator | L3 | Token health, stall/loop detection |
| Meta-Agent | L4 | Role contract amendment proposals |

**Authority rule:** Regulatory overrides operational within its domain. Higher authority_level wins on conflict within the same domain. The binary regulatory/operational split is a deliberate simplification — domain-scoped authority is the target model for a later phase.

---

## The Role Contract

A role contract is the behavioral specification for a role. It is **agent-agnostic** — it defines what the role does, not how a specific model does it. The current `program.md` files are informal predecessors of this concept.

```yaml
# ~/.copernicus/roles/reviewer.yaml
role: reviewer
class: regulatory
authority_level: 3
contract: |
  Review PR diffs against story ACs and forbidden patterns.
  Block on handleIpc() violations.
  Block on missing frozen surface preservation.
  Block if tsc errors are introduced.
  Approve if all ACs are met and no forbidden patterns present.
constraints:
  never_modify: ["<!-- FIXED -->", "<!-- HUMAN -->"]
  output_format: "APPROVED | BLOCKED | REQUEST_CHANGES"
```

Role contracts are user-owned, version-controlled, and editable in the IDE. Copernicus ships with defaults. The Meta-Agent proposes amendments. The user (L5) approves them.

---

## The Token: Employment Credential

When a provider:model is hired for a role, the Hub mints a token. The token is the employment credential. It is the formal record that this agent exists in the system, for this purpose, with this authority.

### Token Schema

```yaml
token_id: "tok_a1b2c3"

identity:
  provider: "anthropic"
  model:    "claude-sonnet-4-6"
  adapter:  "CCRAdapter"

role:
  name:            "coder"
  class:           "operational"
  authority_level: 2

scope:
  domain:   ["electron-ipc", "agent-daemon"]
  folder:   ["copernicus/electron/ipc/**", "scripts/agent-daemon/**"]
  task:     ["story-631"]
  worktree: ".agent-worktrees/story-631"
  commands: ["node", "npm install", "git add", "git commit", "git push origin feat/*"]
  files:
    frozen:   ["scripts/agent-daemon/handlers/jules.mjs"]
    excluded: [".env", "~/.secrets", "*.pem"]

capabilities: ["shell", "fs_write", "git:commit", "git:push:branch"]

duration:
  ttl:          "4h"         # configurable per role
  expires_at:   timestamp    # hard wall-clock — enforced regardless of task state
  renewable:    true
  max_renewals: 2            # safety ceiling on renewals

budget:
  max_cost_usd:   2.00
  alert_at_usd:   1.50

health:
  retry_count:       0       # consecutive retries without progress
  max_retries:       5
  revision_count:    0
  max_revisions:     3
  last_progress_at:  timestamp

issued_at:     timestamp
issued_by:     "hub:session-2026-04-06"  # or "user:jeremy" for L5 tokens
parent_token:  null          # null = issued by human authority
```

### Scope is Granular by Default

Scope covers five dimensions: domain, folder, task, command, file. The effective permission is the **intersection** of all five. Granular by default — if a team finds it too restrictive, they loosen the config. The architecture does not assume permissiveness.

The worktree identifier is part of scope. Two coder tokens with different worktrees cannot conflict by definition. Conflict resolution is a Git Manager concern, not a Hub concern.

### Token Lifecycle

```
ACTIVE → task completes within TTL           → RETIRED  (normal — no renewal considered)
ACTIVE → TTL expires, work legitimate        → EXPIRED  → renewal decision → RENEWED or DEAD
ACTIVE → TTL expires, stall/loop confirmed   → EXPIRED  → renewal denied   → DEAD → alert
ACTIVE → budget exceeded / explicit kill     → DEAD                        → alert
```

Renewal only applies when the TTL hits before task completion. If the task completes first, the token retires — TTL is irrelevant. **Renewal is the exception path, not the normal path.**

---

## Agent States and Telemetry

The Hub tracks four distinct agent states. Each is observable from factual telemetry — not inferred from counters alone.

| State | Definition | Source |
|-------|-----------|--------|
| WORKING | Active, forward progress observable | Git commits, file changes, LLM call activity |
| WAITING | Declared suspension — pending external input | Agent-declared via Hub signal |
| STALLED | No activity, no declared wait | Telemetry absence |
| LOOPING | Activity without progress | Identical LLM calls, identical failures |

### WAITING is Declared, Not Inferred

When an agent is waiting — for plan approval, a human response, a dependency on another story — it signals this to the Hub explicitly. The Hub records: what it is waiting for, the timestamp, and the configured wait timeout for that wait type.

```
token:waiting fired on state change
  reason:   "plan_approval"
  since:    timestamp
  timeout:  "30m"

→ timeout exceeded:
  "Jules has been waiting for plan approval — 47 minutes (timeout: 30m)
   ACTION REQUIRED: approve, respond, or cancel session"
```

Human waits (approval, response) → alert escalated.
Agent-to-agent waits (dependency) → Bus (Story 632) resolves automatically. Hub resumes token on signal.

The daemon's existing `awaitingPlanApproval` state feeds directly into the Hub as a declared WAITING signal.

### Factual Telemetry Sources for Renewal Policy

Before renewing a token, the Loop Operator queries:

- **Model Call Ledger (Story 156)** — call frequency, cost rate, semantic similarity of recent prompts
- **Daemon audit log** — tool calls, command success/failure patterns
- **Git activity in worktree** — last commit timestamp, unique files modified, diff size since issuance
- **Bus traffic (Story 632)** — inter-agent communication activity
- **Episode store (Story 573)** — prior quality scores for this role/story combination

Renewal assessment is a factual report, not a heuristic:

```
TOKEN RENEWAL ASSESSMENT — tok_a1b2c3 (Coder / story-631)
  Last commit:    2h 14m ago — no new commits in 2h on 4h token
  Files modified: 3 unique files — unchanged for 2h
  LLM calls:      last 12 calls contain identical error: "Cannot find module..."
  Cost:           $1.23 / $2.00 (62%)

CONDITION: Factual stall + error loop (identical failure, no forward progress)
ACTION:    Renewal denied — alert dispatched
```

### Hookable Events

```
token:expiring          warning — 15min before wall-clock
token:expired           dead — renewal decision required
token:waiting           agent declared a wait state
token:wait_timeout      wait exceeded configured timeout
token:budget_warning    approaching cost ceiling
token:budget_exceeded   hard stop — token suspended
token:loop_suspected    retry_count at threshold
token:renewal_denied    escalate to Loop Operator or human
token:revoked           explicit kill
token:retired           normal task completion
```

---

## The Configurable Org Chart

The org chart is a user artifact. Copernicus ships with sensible defaults. Users amend.

```yaml
# ~/.copernicus/org.yaml
version: 1

roles:
  reviewer:
    class: regulatory
    authority_level: 3
    assigned_to:
      provider: openrouter
      model: mistralai/devstral-small
    contract: ~/.copernicus/roles/reviewer.yaml
    token_ttl: "1h"
    token_budget_usd: 0.50

  coder:
    class: operational
    authority_level: 2
    assigned_to:
      provider: jules
      model: default
    contract: ~/.copernicus/roles/coder.yaml
    token_ttl: "4h"
    token_budget_usd: 2.00

  sentinel:
    class: regulatory
    authority_level: 5
    assigned_to:
      provider: anthropic
      model: claude-opus-4-6
    contract: ~/.copernicus/roles/sentinel.yaml
    token_ttl: "8h"
    token_budget_usd: 5.00

authority_chains:
  regulatory_overrides_operational: true
  reviewer_can_block: [coder, researcher, dispatcher]
  sentinel_can_block: [all]

enforcement:
  block_mode: hard          # hard | soft | warn-only
  wait_timeout_plan: 30m
  wait_timeout_human: 2h
  require_token_for_dispatch: true
```

The primary editing surface is the Org Chart UI in the IDE. The YAML is generated — version-controllable, diffable, hand-editable for power users. Config is always validated on load.

---

## Transport Adapters

The Hub speaks a common internal interface. Provider-specific code lives only in adapters.

```
Hub
 ├── JulesAdapter      → Jules API (sessions, plan approval, PR workflow)
 ├── CCRAdapter        → Claude Code Router (port 9669)
 ├── AnthropicAdapter  → Direct Anthropic API
 ├── OpenRouterAdapter → OpenRouter catalog
 └── CustomAdapter     → User-defined HTTP endpoint
```

`jules_assign.sh` becomes the JulesAdapter entry point — not the dispatch mechanism. Nothing above the adapter layer knows or cares which provider is behind a role.

---

## How Existing Work Maps Here

| Story / System | Phase 6 Role |
|----------------|-------------|
| Provider Registry (626) | Staffing pool — available provider:model workers |
| LLM Dispatch (628) | Becomes transport adapter layer |
| Token System (608) | Employment credentials — schema expands to full spec above |
| Socket Bus (632) | Hub inter-agent communication + dependency resolution |
| `program.md` files | Role contracts — formalize as YAML schema |
| Self-Improvement Loop (629) | Meta-Agent proposes contract amendments via Hub |
| Provider Config (627) | Subset of `org.yaml` hiring pool definition |
| Classifier hook | Replaced by Hub token capability enforcement |
| DatabasePanel (631) | Reporting surface for Hub audit log |
| Loop Operator agent | Formal Regulatory L3 role — monitors token health |
| Devtime (story tracking) | Feeds telemetry for stall/wait detection |
| Model Call Ledger (156) | Feeds telemetry for loop/cost detection |

---

## Phase 6 Story Sequence

### Foundation (ordered — each unblocks the next)

1. **Token Schema + Hub Interface** — Define the full token schema. Implement Hub's three operations: mint, check, revoke. This is the foundation everything else builds on.

2. **Hub State Store + Loop Controller** — Loop tracking, closing condition verification, phase transition triggers, agent state machine (WORKING / WAITING / STALLED / LOOPING).

3. **Role Contract Schema** — YAML schema for role contracts. Convert `program.md` files. Establish agent-agnostic behavioral spec format.

4. **Org Chart Config + Hub Core** — `org.yaml` parsing, role registry, default org chart. Hub reads config, mints contextually appropriate tokens per phase.

5. **Classifier → Hub Enforcement** — Replace `classifier.py` pattern matching with Hub token capability check. Regulatory authority becomes structural.

### Adapters (parallelizable after foundation)

6. **Jules Adapter** — Extract Jules-specific dispatch into JulesAdapter.
7. **CCR Adapter** — Extract CCR dispatch into CCRAdapter.

### Product Surface

8. **Org Chart UI** — Visual org chart, role assignment, authority chain config.
9. **Hub Reporting Panel** — Audit log, token events, cost by role, loop history.

### Continuous

10. **Self-Improvement → Hub** — Route Meta-Agent contract amendments through Hub authority chain. User L5 is the approval gate.

---

## What This Unlocks

A user integrating Copernicus:

1. Connects their providers
2. Edits `org.yaml` — assigns models to roles, sets authority chains, configures token budgets
3. Edits role contracts to match their standards
4. Dispatches work — Hub mints credentials, adapters route, agents execute
5. Loops close on verified conditions — autonomously where possible, escalated where authority requires human
6. Full audit trail: who did what, with what authority, at what cost, in what state

No Gemini. No Jules. No Claude-specific assumptions. Their agents, their rules, their org chart.

That is Copernicus.
