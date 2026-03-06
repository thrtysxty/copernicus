# COPERNICUS Agent Mandates

## Core Tooling
- **Tool Execution:** All agentic tool calls (file ops, RAG search, MCP) route through `scripts/claude_ollama_cli.py "/persona <prompt>"` for local RAG and persona-routed research.
- **Hybrid Orchestration:** High-intel tasks use the cloud-hosted Ollama via `dev_orchestrator/cloud_agent.py`; tactical tasks use local sidekick via `claude_ollama_cli.py`.
- **RAG Search:** Use `search_codebase` via `claude_ollama_cli.py` for any semantic or non-deterministic code exploration.
- **LSP Guardrail:** Mandatory use of `lsp:check-file` after every TypeScript write as per `TECHNICAL_BIBLE.md`.
- **Development Orchestrator:** For complex drafting, planning, or experimental coding, use `python3 dev_orchestrator/cloud_agent.py <role> "<prompt>" [--worktree <branch_name>]`. This connects to zero-footprint cloud models (`thinker`, `coder`, `vision`, `researcher`, `fast`). When creating sub-agent code drafts, ALWAYS use the `--worktree` flag to isolate their changes.

## Execution Protocol
- **80/20 Rule:** 80% research/planning (using `scripts/claude_ollama_cli.py` for discovery), 20% implementation.
- **IPC Safety:** All IPC changes must follow the dual-registration pattern in `main.ts` and `preload.ts`.
- **Verification:** Always run `cd copernicus && npx tsc --noEmit` to verify TypeScript integrity.
