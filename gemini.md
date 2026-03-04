# COPERNICUS Agent Mandates

## Core Tooling
- **Tool Execution:** All agentic tool calls (file ops, RAG search, MCP) MUST be routed through `scripts/ollama_tool_shim.py`.
- **Hybrid Orchestration:** High-intel tasks use the cloud-hosted Ollama via the shim; tactical tasks use local sidekick.
- **RAG Search:** Use `search_codebase` via the shim for any semantic or non-deterministic code exploration.
- **LSP Guardrail:** Mandatory use of `lsp:check-file` after every TypeScript write as per `TECHNICAL_BIBLE.md`.

## Execution Protocol
- **80/20 Rule:** 80% research/planning (using `scripts/ollama_tool_shim.py` for discovery), 20% implementation.
- **IPC Safety:** All IPC changes must follow the dual-registration pattern in `main.ts` and `preload.ts`.
- **Verification:** Always run `cd copernicus && npx tsc --noEmit` to verify TypeScript integrity.
