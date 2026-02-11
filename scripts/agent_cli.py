#!/usr/bin/env python3
"""
Unified Agent CLI - High Plains Hipster

A single entry point for the agentic workflow that supports multiple backends:
- Ollama (Local, Default)
- Gemini (Cloud, via AGENT_PROVIDER=gemini)
- Claude (Cloud, via AGENT_PROVIDER=anthropic - Future)

Usage:
    export AGENT_PROVIDER=gemini
    python scripts/agent_cli.py "/architect Review this code"
"""

import os
import sys

# Ensure we can import the bridge
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

try:
    from unified_agent_bridge import UnifiedAgentBridge
except ImportError:
    from scripts.unified_agent_bridge import UnifiedAgentBridge


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python scripts/agent_cli.py '/persona prompt' [story_path]")
        sys.exit(1)

    bridge = UnifiedAgentBridge()
    cmd = sys.argv[1]
    story = sys.argv[2] if len(sys.argv) > 2 else None

    bridge.execute(cmd, story)
