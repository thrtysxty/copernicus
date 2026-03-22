# Epic 009: Hindsight Long-Term Memory Engine

**Status:** ACTIVE
**Priority:** P1
**Theme:** Sovereign Intelligence & Cross-Session Learning

## Narrative
The hand-rolled `project_memory` and `context_snapshots` system (Stories 157–158) gives Copernicus basic session continuity — but it's a flat importance×recency lookup with no ability to synthesize patterns across sessions. Hindsight (vectorize-io/hindsight) is a self-hosted, benchmark-validated long-term memory engine that provides exactly what the next tier of agentic intelligence requires: structured retain/recall/reflect operations scoped per agent, per panel, and per project. Swapping the memory layer post-launch upgrades Copernicus agents from "remembers facts" to "builds mental models."

## Goals
1. **Replace hand-rolled memory schema** with Hindsight's battle-tested PostgreSQL + vector backend — eliminating maintenance burden and gaining SOTA LongMemEval recall performance.
2. **Scoped memory banks** — map `bank_id` to Copernicus `panelId` / agent identity so chat panels, workflow nodes, and named agents each have isolated, persistent memory stores.
3. **`reflect` operation** — enable agents to synthesize insights across many prior sessions, not just retrieve raw facts. Unlocks genuine cross-session learning for recurring tasks (code review patterns, project conventions, user preferences).
4. **On-prem sovereign deployment** — run Hindsight on the R620 via Docker + Ollama integration. Zero data leaves the private stack.
5. **Copernicus as proof-of-concept** — validate the integration in the IDE first, then carry the proven pattern into HPH (prop inventory entity recognition) and any future project built through Copernicus.

## User Stories
- **Story TBD:** Hindsight service deployment — Docker Compose integration on R620, health-check IPC, admin UI accessible from Copernicus Settings → Memory.
- **Story TBD:** Memory bank wiring — replace `project_memory` SQLite table reads/writes with Hindsight `retain` + `recall` calls; preserve `bank_id` = `panelId` scoping.
- **Story TBD:** Session-start `reflect` injection — on chat panel open, call Hindsight `reflect` to synthesize a session-context summary; inject as system prompt prefix instead of raw memory rows.
- **Story TBD:** Memory browser UI upgrade — replace current `MemoryBrowser` component with Hindsight web UI embed or a native panel that exposes retain/recall/reflect controls to the user.
- **Story TBD:** HPH entity memory pilot — after Copernicus integration is stable, wire HPH image-research pipeline to the same Hindsight instance using `bank_id` = `item_entity_id` for cross-session prop recognition.

## Technical Constraints
- **Migration path:** `project_memory` rows must be migrated to Hindsight on first launch — no data loss.
- **Fallback:** If Hindsight service is unreachable, fall back to legacy SQLite memory read silently — no user-visible crash.
- **Ollama model for reflect:** Use a mid-tier local model (GLM 4.7 9B or Gemma 3 12B) for the `reflect` synthesis call — not a cloud model.
- **Latency budget:** `recall` on session-start must complete within 2 seconds; `retain` calls are async/non-blocking.

## Dependencies
- Epic 005 (Advanced Agentic Intelligence) — context management foundation ✅ COMPLETE
- Stories 157–158 (hot-swap context continuity, project memory buffer) — existing layer being replaced ✅ COMPLETE
- R620 sovereign brain operational (Ollama inference service) ✅ COMPLETE

## Reference
- Repo: https://github.com/vectorize-io/hindsight
- License: MIT
- Benchmark: SOTA on LongMemEval (Virginia Tech + Washington Post independent verification)
- Install: `docker run ghcr.io/vectorize-io/hindsight:latest` (API :8888, UI :9999)
