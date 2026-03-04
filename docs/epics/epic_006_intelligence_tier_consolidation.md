# Epic 006: Intelligence Tier Consolidation (The Agentic Bus)

**Status:** IN PROGRESS
**Priority:** CRITICAL
**Theme:** Architectural Determinism & Performance

## Narrative
To fulfill the COPERNICUS mandate of system transparency and determinism, we must move away from "one-off" standalone scripts and fragmented intelligence layers. This epic focuses on consolidating all model orchestration (Claude, Gemini, Ollama, Jules) into a persistent, high-performance Python-based "Agentic Bus" integrated within the Flask backend.

## Goals
1. **Eliminate Subprocess Overhead:** Convert all standalone Python scripts into persistent services within the Flask backend to remove interpretation and import latency.
2. **Unified Intelligence API:** Provide a single, deterministic API for the Electron frontend to interact with any model provider (Local or Cloud).
3. **Real-time Streaming via WebSockets:** Move away from stdio-scraping to a robust WebSocket-based streaming architecture for model tokens and tool status.
4. **Centralized Tool Governance:** Move the `ToolExecutor` logic into the Python layer to enable complex multi-step reasoning loops without round-trip IPC overhead.

## User Stories
- **Story 223:** [Python Shim to Persistent Service](#) - Migrate `ollama_tool_shim.py` logic into `backend/api/agents.py`.
- **Story 224:** [Claude & Gemini Migration](#) - Move cloud provider orchestration from Electron (Node.js) to the Python backend.
- **Story 225:** [WebSocket Streaming Bridge](#) - Implement a unified streaming bus for real-time token delivery.
- **Story 226:** [Deterministic Agent Registry](#) - A single source of truth for all persona mappings and model metadata.

## Technical Constraints
- **Low Latency:** API/Socket overhead must be < 5ms.
- **Zero Standalone Scripts:** No `child_process.spawn` for python files in production.
- **Full Observability:** Every request through the Agentic Bus must be logged to the `state-ledger`.
