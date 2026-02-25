#!/usr/bin/env python3
"""
COPERNICUS - MCP Server for Continue.dev

Provides utility tools for the agentic workflow:
- story: Scaffold a new user story file
- pi_check: Run Raspberry Pi compatibility audit
- test_webhook: Send test payload to deployment webhook
- handoff: Create session handoff note
- log_error: Log a failed task for reflection
- log_success: Log a successful task

Usage:
    # Run directly (for testing)
    python scripts/mcp_server.py

    # Via uv (for Continue.dev)
    uv run scripts/mcp_server.py

Requirements:
    pip install mcp fastmcp
    # or: uv add mcp fastmcp
"""

import subprocess
import sys
from pathlib import Path

# Add project root to path
PROJECT_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

try:
    from mcp.server import Server
    from mcp.server.stdio import stdio_server
    from mcp.types import Tool, TextContent
except ImportError:
    print("MCP library not installed. Run: pip install mcp", file=sys.stderr)
    sys.exit(1)


# Create the MCP server
server = Server("highplains-tools")


def run_script(script_path: str, args: list[str] | None = None) -> tuple[bool, str]:
    """
    Run a Python script and return (success, output).
    """
    cmd = [sys.executable, str(PROJECT_ROOT / script_path)]
    if args:
        cmd.extend(args)

    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            cwd=str(PROJECT_ROOT),
            timeout=60,
        )
        output = result.stdout + result.stderr
        return result.returncode == 0, output.strip()
    except subprocess.TimeoutExpired:
        return False, "Script timed out after 60 seconds"
    except Exception as e:
        return False, f"Error running script: {e}"


@server.list_tools()
async def list_tools() -> list[Tool]:
    """List available tools."""
    return [
        Tool(
            name="story",
            description="Scaffold a new user story file with the given title",
            inputSchema={
                "type": "object",
                "properties": {
                    "title": {
                        "type": "string",
                        "description": "The title for the new user story",
                    }
                },
                "required": ["title"],
            },
        ),
        Tool(
            name="pi_check",
            description="Run Raspberry Pi 3B+ compatibility audit on a file or directory",
            inputSchema={
                "type": "object",
                "properties": {
                    "path": {
                        "type": "string",
                        "description": "File or directory path to audit (relative to project root)",
                    }
                },
                "required": ["path"],
            },
        ),
        Tool(
            name="test_webhook",
            description="Send a test payload to the GitHub deployment webhook on the Pi",
            inputSchema={
                "type": "object",
                "properties": {},
            },
        ),
        Tool(
            name="handoff",
            description="Create a handoff note for session restart with context summary",
            inputSchema={
                "type": "object",
                "properties": {
                    "summary": {
                        "type": "string",
                        "description": "Summary of current session state and next steps",
                    }
                },
                "required": ["summary"],
            },
        ),
        Tool(
            name="log_error",
            description="Log a failed agentic task for later reflection and learning",
            inputSchema={
                "type": "object",
                "properties": {
                    "message": {
                        "type": "string",
                        "description": "Description of what failed and why",
                    }
                },
                "required": ["message"],
            },
        ),
        Tool(
            name="log_success",
            description="Log a successful agentic task to capture patterns",
            inputSchema={
                "type": "object",
                "properties": {
                    "message": {
                        "type": "string",
                        "description": "Description of what succeeded",
                    }
                },
                "required": ["message"],
            },
        ),
        Tool(
            name="backlog",
            description="Generate or refresh the master backlog document",
            inputSchema={
                "type": "object",
                "properties": {},
            },
        ),
    ]


@server.call_tool()
async def call_tool(name: str, arguments: dict) -> list[TextContent]:
    """Execute a tool and return the result."""

    if name == "story":
        title = arguments.get("title", "")
        if not title:
            return [TextContent(type="text", text="Error: title is required")]

        success, output = run_script(
            "scripts/utils/scaffold_story.py", ["--title", title]
        )
        status = "Created" if success else "Failed"
        return [TextContent(type="text", text=f"{status}: {output}")]

    elif name == "pi_check":
        path = arguments.get("path", ".")
        success, output = run_script("scripts/utils/pi_audit.py", [path])
        return [TextContent(type="text", text=output)]

    elif name == "test_webhook":
        success, output = run_script("scripts/deployment/test_webhook.py", [])
        status = "Webhook test sent" if success else "Webhook test failed"
        return [TextContent(type="text", text=f"{status}\n{output}")]

    elif name == "handoff":
        summary = arguments.get("summary", "")
        if not summary:
            return [TextContent(type="text", text="Error: summary is required")]

        success, output = run_script("scripts/utils/handoff.py", [summary])
        return [TextContent(type="text", text=output)]

    elif name == "log_error":
        message = arguments.get("message", "")
        if not message:
            return [TextContent(type="text", text="Error: message is required")]

        success, output = run_script(
            "scripts/utils/manage_logs.py", ["--type", "error", "--message", message]
        )
        return [TextContent(type="text", text=output)]

    elif name == "log_success":
        message = arguments.get("message", "")
        if not message:
            return [TextContent(type="text", text="Error: message is required")]

        success, output = run_script(
            "scripts/utils/manage_logs.py", ["--type", "success", "--message", message]
        )
        return [TextContent(type="text", text=output)]

    elif name == "backlog":
        success, output = run_script("scripts/utils/generate_backlog.py", [])
        status = "Backlog generated" if success else "Backlog generation failed"
        return [TextContent(type="text", text=f"{status}\n{output}")]

    else:
        return [TextContent(type="text", text=f"Unknown tool: {name}")]


async def main():
    """Run the MCP server."""
    async with stdio_server() as (read_stream, write_stream):
        await server.run(
            read_stream, write_stream, server.create_initialization_options()
        )


if __name__ == "__main__":
    import asyncio

    asyncio.run(main())
