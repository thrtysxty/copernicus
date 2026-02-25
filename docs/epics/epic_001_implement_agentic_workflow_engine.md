# Epic 001: Implement Configuration-Driven Agentic Workflow Engine

**Status:** DRAFT
**Priority:** CRITICAL
**Phase:** Phase 4 - Maintenance & Iteration
**Target Repo:** Platform repo (Story #030 extraction)

## Narrative
**As a** Product Owner and Architect,
**I want** a configuration-driven workflow engine that reads a central manifest to execute our development lifecycle,
**So that** our process is resilient, extensible, and maintainable, avoiding the "Crystal Palace" problem.

## Context
This Epic formalizes the project plan to implement the deterministic lifecycle detailed in `docs/dev/planning/agentic_ecosystem_overview.md`. It directly follows the Architect's recommendation to "Build the Engine First" by prioritizing the creation of a generic, manifest-driven framework over building numerous, brittle, hardcoded scripts. This epic will orchestrate the sub-stories needed to build the engine, de-risk the state machine, and then wire up the full agentic workflow.

> **Note (2026-02-01):** This epic was drafted before story IDs 034–041 were assigned to
> product work. The sub-story IDs below are **placeholders only** — they do not correspond
> to existing stories in `docs/dev/stories/`. New story IDs will be assigned when this
> epic is activated in the platform repo (Story #030).
>
> **Existing related story:** Story #041 ("Build Workflow Engine MVP") partially covers
> Phase 1 of this epic. It should be treated as the starting point for implementation.

## Acceptance Criteria
1.  **Phase 1 Complete (The Engine):** A generic workflow engine exists that can parse a `workflow.yaml` manifest and execute basic transitions (like creating and approving a story). The brittle file-based queues are replaced with a transactional SQLite database.
2.  **Phase 2 Complete (The Core Loop):** The primary development loop (queuing work for devs, requesting reviews) is fully integrated into the new engine. Agents have been updated to interact with the new transactional queue system.
3.  **Phase 3 Complete (The Guardrails):** The remaining high-value gates from the ecosystem overview (e.g., documentation checks, deployment handoffs) are implemented as transitions within the new engine.
4.  **Process Obsolescence:** The old, hardcoded scripts (`scaffold_story.py`, etc.) and the "Two-Stage" backlog process are fully deprecated and removed from the codebase and documentation.

## Documentation Impact
- **New Files:** `config/workflow.yaml`, `scripts/workflow/run_transition.py`, `src/agentic/workflow_engine.py`, `data-local/workflow.db` (SQLite).
- **Updated Files:** `Makefile`, `docs/dev/planning/agentic_ecosystem_overview.md`.
- **Process Change:** This represents a fundamental shift from a collection of individual scripts to a unified, configuration-driven process.

---

## Project Plan & Sub-Stories

This Epic will be broken down into the following phased stories. Story IDs are placeholders — actual IDs will be assigned when stories are scaffolded in the platform repo.

### Phase 1: Build the Foundation

| Story | Description | Status | Notes |
| :--- | :--- | :--- | :--- |
| TBD | **Create Workflow Manifest & Engine Core:** Define the `workflow.yaml` structure and build the.copernicus `run_transition.py` script that can parse it. | DRAFT | |
| TBD | **Implement Transactional State Database:** Create the SQLite database (`workflow.db`) and the services to manage `work_queue`, `review_queue`, etc. | DRAFT | |
| TBD | **Implement `idea` and `approve` Transitions:** Build the first two transitions to prove the engine works for story creation and promotion. | DRAFT | |
| **Story #041** | **Build Workflow Engine MVP:** SQLite-backed state, transactional transitions, basic 3-step workflow execution. | APPROVED | Existing story — covers much of Phase 1 scope |

### Phase 2: Integrate the Core Loop

| Story | Description | Status |
| :--- | :--- | :--- |
| TBD | **Integrate Work Queue Handoff:** Implement the `/queue` command to add stories to the new SQLite `work_queue`. | DRAFT |
| TBD | **Update Agent Pull Model:** Modify the `/senior_dev` agent to poll the SQLite database instead of the file system. | DRAFT |
| TBD | **Integrate Gated Review Handoff:** Implement the `/request_review` command with its pre-flight check and integration into the SQLite `review_queue`. | DRAFT |

### Phase 3: Harden the Edges

| Story | Description | Status |
| :--- | :--- | :--- |
| TBD | **Implement Documentation Gate:** Build the `/close_story` transition with its `pre_check_script` to verify documentation changes. | DRAFT |
| TBD | **EPIC: Production-Grade Deployer:** Create a separate Epic to properly scope and build the new `/deployer` agent, smoke tests, and rollback mechanisms. | DRAFT |
