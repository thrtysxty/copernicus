#!/usr/bin/env python3
"""
Lifecycle hook: SubagentStart
Registers a new subagent with the telemetry system when Claude spawns it.
Receives JSON via stdin with agent_id, session_id, etc.
"""

import sys
import json
import os

# Add project root to path for imports
PROJECT_ROOT = os.path.dirname(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
)
sys.path.insert(0, PROJECT_ROOT)

from src.agentic.telemetry import telemetry  # noqa: E402


def main():
    try:
        data = json.load(sys.stdin)
        agent_id = data.get("agent_id", "unknown")
        session_id = data.get("session_id")

        # Register the subagent
        telemetry_id = telemetry.register_agent(
            name=f"subagent-{agent_id[:8]}",
            role="Claude Subagent",
            task=f"Subagent spawned (ID: {agent_id})",
            parent_id=session_id,
        )

        # Store mapping for later status update
        mapping_file = os.path.join(PROJECT_ROOT, ".claude", "agent_mapping.json")
        os.makedirs(os.path.dirname(mapping_file), exist_ok=True)

        try:
            with open(mapping_file, "r") as f:
                mappings = json.load(f)
        except (FileNotFoundError, json.JSONDecodeError):
            mappings = {}

        mappings[agent_id] = telemetry_id
        with open(mapping_file, "w") as f:
            json.dump(mappings, f)

        # Return success
        print(json.dumps({"continue": True}))

    except Exception as e:
        # Log error but don't block
        print(json.dumps({"continue": True, "error": str(e)}), file=sys.stderr)
        sys.exit(0)


if __name__ == "__main__":
    main()
