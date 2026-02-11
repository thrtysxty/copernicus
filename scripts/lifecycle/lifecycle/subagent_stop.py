#!/usr/bin/env python3
"""
Lifecycle hook: SubagentStop
Updates subagent status to COMPLETED when Claude finishes it.
Receives JSON via stdin with agent_id.
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

        # Look up telemetry ID from mapping
        mapping_file = os.path.join(PROJECT_ROOT, ".claude", "agent_mapping.json")

        try:
            with open(mapping_file, "r") as f:
                mappings = json.load(f)
            telemetry_id = mappings.get(agent_id)

            if telemetry_id:
                telemetry.update_status(telemetry_id, "COMPLETED")
                # Remove from mapping
                del mappings[agent_id]
                with open(mapping_file, "w") as f:
                    json.dump(mappings, f)
        except (FileNotFoundError, json.JSONDecodeError):
            pass  # No mapping found, skip

        # Return success
        print(json.dumps({"continue": True}))

    except Exception as e:
        # Log error but don't block
        print(json.dumps({"continue": True, "error": str(e)}), file=sys.stderr)
        sys.exit(0)


if __name__ == "__main__":
    main()
