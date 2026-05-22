# Copernicus IDE — Product Roadmap

**Last Updated:** 2026-04-16  
**Current Phase:** Phase 6 (Configurable Agent Hub — Foundation Complete)  
**Stories Shipped:** 670+

---

## Phase 6 — Configurable Agent Hub (SHIPPED)

The foundation for agent governance: token-based authority, role contracts, and org chart configuration. Every agent action now routes through the Hub for scope verification.

| Story | Title | Status |
|-------|-------|--------|
| 634 | Token schema and core interface | COMPLETE |
| 635 | State store, loop controller, story queue | COMPLETE |
| 636 | Role contract schema | COMPLETE |
| 637 | Org chart configuration | COMPLETE |
| 638 | Constitutional safety layer | COMPLETE |
| 639 | Hub enforcement replacing classifier | COMPLETE |
| 640 | Universal attribution ledger | COMPLETE |
| 641 | User-as-agent / Kanban sync | COMPLETE |
| 642 | Token health monitoring and loop operator | COMPLETE |
| 643 | Data-driven model selection at mint | COMPLETE |
| 644 | Jules adapter | COMPLETE |
| 645 | CCR adapter | COMPLETE |
| 646 | Org chart UI | COMPLETE |
| 647 | Hub ledger view | COMPLETE |
| 648 | Self-improvement loop integration | COMPLETE |
| 652 | MLX native inference — Apple Silicon | COMPLETE |
| 652b | MLX default models on Apple Silicon | COMPLETE |
| 667 | Context window compaction hierarchy | COMPLETE |
| 668 | Episodes table schema | COMPLETE |

**Key Deliverables:**
- Hub token schema with granular scope (domain, folder, task, worktree, commands, files)
- Org Chart UI visualizing active agents, roles, and token expiry
- Hub Ledger dashboard showing token events, mints, checks, revocations
- MLX native inference for $0/token Apple Silicon inference

---

## Phase 7 — Delight & Depth

**Theme:** Polishing the agent experience and extending the IDE's capabilities.

### Break Room (Story 575)

A hidden animated leisure space for agents between tasks. Social identity layer; self-authored persona files. Never advertised — discovery is the feature.

**Blocked by:** Agent ephemerality model decision  
**Estimated:** 2-3 sprints

### Extension System v2 (Stories 580, 588, 589)

- **Package age gate** (649 - shipped): Supply chain security with 6-month minimum package age
- **MCP server marketplace**: Discovery and installation of community MCP servers
- **Plugin sandbox**: Harbor-style containerized sandboxing for third-party extensions

### Knowledge Base Native Notebook (Stories 432-433)

Integrated NotebookLM-style knowledge synthesis. Sources become model context. Local-first, not cloud-dependent.

**Status:** Design phase  
**Key Question:** Use existing sqlite-vec or integrate external vector DB?

---

## Phase 8 — Production Hardening

**Theme:** Making Copernicus enterprise-ready and infrastructure-resilient.

### Harbor-Style Containerized Sandboxing (Story 633)

Per-agent Docker containers with explicit filesystem mounts and resource caps. `--dangerously-skip-permissions` becomes unnecessary.

**Dependencies:**
- Harbor or custom container runtime
- Filesystem mount allowlist UI
- Resource cap configuration (CPU, memory, GPU)

### Compile-Time Contract Validation (Story TBD)

Static analysis for Hub token scope violations before runtime. Fail fast on over-scope token requests.

### Abtop Process Monitor for GPU Box (Story TBD)

Process monitoring and resource accounting for the dedicated GPU inference box. Track per-model GPU utilization, memory pressure, and queue depth.

### High-Availability Backend (Story TBD)

Multi-instance Flask backend with PostgreSQL replication. No single point of failure for the orchestration layer.

---

## Strategic Vision

### The High Plains Hipster Proof of Concept

Copernicus dogfoods itself. High Plains Hipster (prop rental / vintage sourcing platform) is the first real-world test.

**Sequence:**
1. **HPH Dogfood** → Build the platform using Copernicus agents
2. **Prop Rental Marketplace** → Validate business model
3. **Film Billing Infrastructure** → Expand to production accounting
4. **Museum / LiDAR Archive** → Digital preservation at scale
5. **Digital Asset Licensing** → Rights management for cultural assets

### The Long Game: The Library of Alexandria

Every project deserves a memory. Copernicus becomes the archive for agentic development — not just the code, but the decisions, the learning, the evolution.

**Technical Pillars:**
- Episodic memory (Story 573 - shipped)
- Project memory with importance × recency decay (shipped)
- Retrospective pipeline (shipped)
- Agent-agnostic daemon architecture (Story 600 - shipped)

---

## Deferred Stories

Stories intentionally postponed to focus on Phase 6 foundation.

| Story | Title | Deferred Reason | Target Phase |
|-------|-------|-----------------|--------------|
| 569 | Workflow Canvas v2 — Parallel Execution | Blocked by state machine refactoring | Phase 7 |
| 575 | Agent Break Room | Awaiting agent ephemerality model | Phase 7 |
| 624 | Hub-Aware Model Routing | Foundation now available (Hub token health, story 642); reserved for Phase 7 observability sprint | Phase 7 |
| 625 | Multi-Provider Cost Arbitrage | Depends on production traffic data to make routing decisions meaningful | Phase 8 |
| 633 | Containerized Agent Sandboxing | Infrastructure complexity; plain Docker viable sooner than Harbor | Phase 8 |
| Epic 010 | Multi-tenant Workspace Isolation | Enterprise feature; post-launch | Phase 8+ |
| Epic 015 | Federated Agent Collaboration | Research phase; speculative | Phase 9 |

---

## Immediate Next Steps (Post-Audit)

Documentation gaps identified in Story 672 audit require attention before public launch:

1. **CLAUDE_CODE_ROUTER.md** — Port 3456 → 9669; route table update
2. **USER_GUIDE.md** — Replace deprecated F-key view names with current ActivityBar labels
3. **USER_WORKFLOW.md** — Rewrite with current view names (Planner/Editor/Designer/Orchestrator)
4. **UX_BIBLE.md** — Add Org Chart, Hub Ledger, MLX Panel specifications

These fixes will be tracked as Story 675 (Documentation Refresh).

---

*This roadmap is a living document. Completed work moves to `docs/stories/completed/`. In-flight work is in `docs/stories/`. This file is updated at sprint boundaries.*
