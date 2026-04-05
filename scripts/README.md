# scripts/ — Copernicus Utility Scripts

One-liner index of every script in this directory.

| Script | Purpose |
|--------|---------|
| `agent_cli.py` | CLI entry point for dispatching agent tasks |
| `agent_console.py` | Interactive console for agent session management |
| `agent_context.py` | Prepends role-specific system context to dispatch prompts |
| `agent_gateway.py` | HTTP gateway for agent session routing |
| `agent_harness.py` | Test harness for running agent sessions in isolation |
| `agent-daemon/index.mjs` | Node daemon: handles Jules SDK streams, Anthropic PR review, auto-merge |
| `agent_tui.py` | Terminal UI for monitoring active agent sessions |
| `cloud_orchestrator.py` | Orchestration logic for cloud model routing |
| `copernicus_assign.sh` | Internal assignment helper (used by Kanban dispatch button) |
| `dev-setup.sh` | One-command development environment setup |
| `devtime_manager.py` | Tracks developer time allocation across stories |
| `generate_repo_index.py` | Generates semantic codebase index for RAG queries |
| `install-daemon.ps1` | Windows: installs daemon as a system service |
| `install-daemon.sh` | Unix: installs daemon as a launchd/systemd service |
| `ipc-lint.sh` | IPC compliance checker — run before dispatch and after merge |
| `jules-preflight.sh` | Validates a story file before `jules_assign.sh` dispatch |
| `jules_assign.sh` | Dispatches a story to Jules (async PR agent) |
| `mcp_hub.py` | MCP server hub — aggregates multiple MCP servers |
| `mcp_server.py` | Standalone MCP server for Copernicus codebase tools |
| `migrate_platform_assets.sh` | Migrates assets between platform versions |
| `ollama_ask.sh` | Quick shell wrapper for single Ollama queries |
| `ollama_tool_shim.py` | Shim layer for Ollama tool-calling protocol compatibility |
| `repo_intelligence.py` | Semantic search and symbol graph queries over the codebase |
| `setup_ollama_personas.sh` | Creates Ollama Modelfiles for Copernicus agent personas |
| `setup_ollama_server.sh` | Configures Ollama server for use with Copernicus |
| `story-implemented.sh` | Marks a story as COMPLETE in the Kanban after merge |
| `story-validator.sh` | Validates story file format before Jules dispatch |
| `story.py` | Story CRUD operations against the Kanban SQLite DB |
| `workflow_manager.py` | Manages workflow definitions and execution state |
