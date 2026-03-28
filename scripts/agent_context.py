#!/usr/bin/env python3
"""
agent_context.py — outputs a [AGENT CONTEXT] block for one or all agent slugs.

Usage:
  python3 scripts/agent_context.py <slug>        # single agent
  python3 scripts/agent_context.py --all         # all agents

The output is suitable for prepending to a Gemini dispatch prompt.
"""

import sys
from pathlib import Path

AGENTS_DIR = Path(__file__).parent.parent / ".copernicus" / "agents"
ALL_SLUGS = ["coder", "thinker", "architect", "researcher", "vision"]


def load_agent(slug: str) -> str:
    agent_dir = AGENTS_DIR / slug
    yaml_path = agent_dir / "agent.yaml"
    soul_path = agent_dir / "SOUL.md"

    if not agent_dir.exists():
        print(f"[agent_context] ERROR: no agent found at {agent_dir}", file=sys.stderr)
        sys.exit(1)

    parts = [f"[AGENT CONTEXT: {slug.upper()}]"]

    if yaml_path.exists():
        parts.append("## Capabilities (agent.yaml)")
        parts.append(yaml_path.read_text().strip())

    if soul_path.exists():
        parts.append("## Identity (SOUL.md)")
        parts.append(soul_path.read_text().strip())

    parts.append(f"[/AGENT CONTEXT: {slug.upper()}]")
    return "\n\n".join(parts)


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    arg = sys.argv[1]

    if arg == "--all":
        blocks = [load_agent(slug) for slug in ALL_SLUGS]
        print("\n\n---\n\n".join(blocks))
    else:
        print(load_agent(arg))


if __name__ == "__main__":
    main()
