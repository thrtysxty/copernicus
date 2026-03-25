#!/usr/bin/env python3
"""
COPERNICUS - MCP Server for Continue.dev (Backward Compatibility Shim)

This script acts as a shim for legacy clients expecting mcp_server.py.
It checks if the main MCP Hub is already running on port 6375.
- If the hub is running, it exits gracefully.
- If not, it starts the mcp_hub.py in stdio transport mode to serve legacy clients.
"""

import socket
import subprocess
import sys
import os
import time

MCP_HUB_PORT = 6375
MCP_HUB_SCRIPT = os.path.join(os.path.dirname(__file__), "mcp_hub.py")

def is_hub_running(host='127.0.0.1', port=MCP_HUB_PORT, timeout=1):
    """
    Checks if the MCP Hub is running by attempting to connect to its TCP port.
    """
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except (socket.timeout, ConnectionRefusedError):
        return False
    except Exception as e:
        print(f"Error checking hub status: {e}", file=sys.stderr)
        return False

def main():
    if is_hub_running():
        print(f"Copernicus MCP Hub already running on port {MCP_HUB_PORT}", file=sys.stderr)
        sys.exit(0)
    else:
        print(f"Copernicus MCP Hub not detected on port {MCP_HUB_PORT}. Starting mcp_hub.py in stdio mode...", file=sys.stderr)
        # Execute mcp_hub.py with stdio transport
        # The execvp call replaces the current process with the new one
        # This is important for correct signal handling and process management
        try:
            os.execvp(sys.executable, [sys.executable, MCP_HUB_SCRIPT, "--transport", "stdio"])
        except FileNotFoundError:
            print(f"Error: {sys.executable} or {MCP_HUB_SCRIPT} not found.", file=sys.stderr)
            sys.exit(1)
        except Exception as e:
            print(f"Error executing mcp_hub.py: {e}", file=sys.stderr)
            sys.exit(1)

if __name__ == "__main__":
    main()
