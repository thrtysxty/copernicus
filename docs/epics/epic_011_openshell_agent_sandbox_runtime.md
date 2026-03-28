# Epic 011: OpenShell Agent Sandbox Runtime

**Status:** COMPLETE
**Priority:** P1 — Infrastructure
**Phase:** Agent Security & Isolation

## Narrative

**As a** platform operator dispatching autonomous agents,
**I want** agent subprocesses contained in a policy-enforced sandbox,
**So that** a misbehaving or compromised agent cannot exfiltrate credentials, mutate files outside its story scope, or exhaust API quotas before I can intervene.

---

## Context

Copernicus dispatches agents (Gemini, Jules, local Ollama) with broad access to the filesystem and network. There is no containment boundary between agent processes and the host system today. A misbehaving or compromised agent can exfiltrate credentials, mutate files outside its story scope, or exhaust API quotas before Claude can intervene.

NVIDIA OpenShell (https://github.com/NVIDIA/OpenShell, Apache 2.0) is a container-native sandbox runtime for autonomous AI agents. It wraps agent subprocesses in an isolated Docker/K3s environment governed by hot-reloadable YAML policies — filesystem access, network egress, process restrictions, and LLM credential injection. GPU passthrough via NVIDIA Container Toolkit is directly compatible with the R620 sovereign brain Ollama inference path.

This epic wires OpenShell into the Copernicus agent dispatch layer as an opt-in secure execution host, starting on the R620 (native Linux Docker) and extending to the dev workstation when upstream macOS support stabilises.

> **OpenShell status as of 2026-03-19:** v0.0.11, Apache 2.0, NVIDIA-backed, early alpha.
> 2.4k stars in days. Active triage. Known gaps: macOS Docker Desktop compat, Jetson ARM64 iptables. Monitor https://github.com/NVIDIA/OpenShell/releases.

---

## Goals

1. Agent subprocesses (Gemini, Jules) can be dispatched into an OpenShell sandbox rather than as bare host processes.
2. Per-story YAML policies scope filesystem writes to the story's declared file list and block all network egress not in an explicit allowlist.
3. API credentials are injected via OpenShell provider bundles — no agent ever reads `.credentials.json` or `~/.claude` directly.
4. The Copernicus IDE surfaces sandbox status (running / policy violation / exited) on the Kanban card for the dispatched story.
5. Escape hatch: sandbox mode is opt-in per dispatch; bare-host dispatch remains the default.

---

## Sub-Stories

| Story | Title | Depends On |
|---|---|---|
| 420 | OpenShell host registration + `sandbox:status` IPC | — |
| 421 | Policy generator (`scripts/openshell_policy.py`) | 420 |
| 422 | Sandboxed Gemini dispatch (`--sandbox` flag) | 421 |
| 423 | Sandboxed Jules dispatch (`--sandbox` flag) | 421 |
| 424 | Credential isolation via provider bundles | 421 |
| 425 | Kanban sandbox status surface (lock icon, SANDBOX_VIOLATION badge) | 422, 423 |
| 426 | R620 remote host support (SSH + GPU passthrough) | 424 |
| 427 | Sandbox Settings panel (Settings → Sandbox tab) | 420 |
| 428 | Ollama-cloud sandboxed dispatch | 421 |

Stories 422 and 423 can run in parallel once 421 merges.
Stories 425, 426, 427 can run in parallel once their blockers merge.
Story 428 is lowest priority — deferred until 422/423 are stable.

---

## Acceptance Criteria (Epic Level)

- [ ] `openshell version` resolves on R620 via SSH alias; `sandbox:status` IPC returns `available: true`
- [ ] Gemini dispatched with `--sandbox`: story-scoped files written, out-of-scope write attempt logged as policy violation
- [ ] Jules dispatched with `--sandbox`: same containment; patch apply (`jules remote pull --apply`) runs outside sandbox
- [ ] No raw API key material present in policy YAML files (`strings` verified)
- [ ] Kanban card shows lock icon during sandboxed session; red badge on violation
- [ ] R620 GPU passthrough: `openshell run --gpu ... ollama run <model>` completes without error
- [ ] All dispatch paths default to `--sandbox=false` — zero behaviour change without opt-in
- [ ] `COPERNICUS_SANDBOX_REQUIRED=1` makes bare-host fallback a hard error
- [ ] `tsc --noEmit` clean; `pytest` green across all sub-stories

---

## Out of Scope (this epic)

- macOS dev workstation sandbox — Docker Desktop compat issues in OpenShell alpha; revisit at v0.2+
- Jetson AGX Xavier edge node — ARM64/iptables upstream gap; tracked in OpenShell issue backlog
- Multi-tenant / team-mode OpenShell — not yet supported upstream
- Full policy editor UI — Settings panel (Story 427) is read-only config; editor is a follow-on epic

---

## Frozen Surfaces

- `copernicus/electron/workflow/engine.ts` — add `sandboxed` field to existing event payloads only
- `copernicus/src/renderer/components/kanban/KanbanBoard.tsx` — lock icon appended to existing card; no layout changes
- Gemini dispatch protocol — `--sandbox` flag is purely additive

---

## Documentation Impact

- `docs/reference/TECHNICAL_BIBLE.md` — add "Agent Sandbox" section: dispatch protocol, policy schema, credential injection rules
- `docs/reference/AGENTS.md` — add `--sandbox` flag to Gemini and Jules dispatch examples
- Hardware stack prerequisites table — OpenShell + NVIDIA Container Toolkit on R620
