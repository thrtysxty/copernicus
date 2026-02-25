# CLAUDE.md
**Project:** COPERNICUS IDE
**Stack:** Python 3.11/Flask, PostgreSQL 16, React 18/TS (Electron), Dell R210ii Core (Docker)
**Context:** Professional multi-agent orchestration platform.
**Tooling:** `claude_mcp_config.json` (Context7 + Lynkr)
**Knowledge Source:** Local Repo (Primary).

## Subagent Policy
**Always launch Sonnet subagents unless specified otherwise.**

## Tool Use Protocol
You have access to tools. To use them, output strict XML tags in your response.

1. **Write File:**
   `<write_file path="src/file.py">code here</write_file>`
2. **Execute Shell Command:**
   `<exec_command>python scripts/test.py</exec_command>`

## Common Commands
```bash
make dev             # Start Backend (5001) + COPERNICUS (3000)
make test            # Run test suite
make deploy          # Push to Dell R210ii Core and restart containers
make db-deploy       # Deploy database schema to Core
make agent           # Terminal 1: Launch Agent (with venv + MCP)
make dashboard       # Terminal 2: Launch Dashboard
```

## Architecture
- **backend/** - Core services and API handlers.
- **copernicus/** - Electron/React IDE frontend.
- **src/agentic/** - Multi-agent orchestration logic and telemetry.
- **docs/stories/** - Feature tracking and industrial pipeline.

## Agent Interaction Commands
- `/story "Title" [--type story|api|component]`: Scaffolds a new user story and optional boilerplate.
- `/pi_check`: Runs the Performance Baseline Audit (Raspberry Pi 3B+ constraints).
- `/audit`: Triggers the Sentinel Persona to scan staged changes for secrets.

## Security & Guardrails
- **Pre-commit:** Blocks secrets and runs performance baseline audits.
- **Sentinel:** Autonomous hardening and secret detection.
