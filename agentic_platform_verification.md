# Agentic Platform Verification Tree

Use this file tree to verify the contents of the new `agentic-platform` repository after running `scripts/migrate_platform_assets.sh`.

## Expected Structure

```text
agentic-platform/
├── .pre-commit-config.yaml       # Migrated from root
├── Makefile                      # Migrated from root (needs refactoring)
├── claude_mcp_config.json        # Migrated from root
├── requirements-stack.txt        # Renamed from requirements.txt
├── docs/
│   ├── personas/                 # Copied from docs/personas/
│   │   ├── 01_architect.md
│   │   ├── 02_senior_dev.md
│   │   ├── 03_product_owner.md
│   │   ├── 04_junior_dev.md
│   │   ├── 05_deployer.md
│   │   ├── 06_scribe.md
│   │   └── 07_coach.md
│   └── stories/                  # Flattened from docs/dev/stories/ or docs/stories/
│       ├── story_030_agentic_project_boilerplate.md
│       ├── story_076_claude_code_clone.md
│       └── ... (other agentic stories)
├── scripts/
│   ├── agent_cli.py              # The CLI entrypoint
│   ├── agent_console.py          # The legacy console
│   ├── agent_tui.py              # The Textual UI
│   ├── mcp_server.py             # The MCP Server
│   ├── setup_ollama_personas.sh  # Ollama setup script
│   ├── unified_agent_bridge.py   # The core bridge
│   ├── lifecycle/                # Lifecycle hooks
│   │   ├── pre_tool_use.py
│   │   └── ...
│   └── utils/
│       └── device_audit.py       # Renamed from pi_audit.py
└── src/
    └── agentic/                  # Core Python package
        ├── __init__.py
        └── ...
```

## Verification Command

Run this command to compare the actual directory structure with the expected one:

```bash
# Assuming you are in high-plains-hipster root and the new repo is at ../agentic-platform
cd ../agentic-platform && find . -maxdepth 4 -not -path '*/.*' | sort
```

## Post-Migration Checklist

- [ ] `requirements-stack.txt` exists (was `requirements.txt`).
- [ ] `scripts/utils/device_audit.py` exists (was `pi_audit.py`).
- [ ] `docs/stories/` contains the flattened list of agentic stories.