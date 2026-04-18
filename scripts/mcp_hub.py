import argparse
import json
import logging
import os
import select
import signal
import socket
import subprocess
import sys
import threading
import time
from pathlib import Path
from typing import Dict, List, Optional, Callable

# Add project root to path
PROJECT_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# --- Configuration Constants ---
DEFAULT_MCP_PORT = 6375
MCP_HUB_CONFIG_DIR = os.path.expanduser("~/.copernicus/mcp-hub")
os.makedirs(MCP_HUB_CONFIG_DIR, exist_ok=True)
MCP_HUB_LOG_DIR = os.path.join(os.path.expanduser("~"), ".copernicus", "logs", "mcp-hub")
os.makedirs(MCP_HUB_LOG_DIR, exist_ok=True)

# Define proxy configurations
PROXY_CONFIGS = {
    "codebase-memory": {
        "command": ["codebase-memory-mcp"],
        "strategy": "eager",
        "log_file": os.path.join(MCP_HUB_LOG_DIR, "copernicus-mcp-codebase-memory.log"),
    },
    "stitch": {
        "command": ["npx", "stitch-mcp"],
        "strategy": "lazy",
        "log_file": os.path.join(MCP_HUB_LOG_DIR, "copernicus-mcp-stitch.log"),
    },
    "context7": {
        "command": ["npx", "-y", "@context7/server"],
        "strategy": "lazy",
        "log_file": os.path.join(MCP_HUB_LOG_DIR, "copernicus-mcp-context7.log"),
    },
    "lynkr": {
        "command": ["npx", "-y", "@lynkr/server"],
        "strategy": "lazy",
        "log_file": os.path.join(MCP_HUB_LOG_DIR, "copernicus-mcp-lynkr.log"),
    },
}

class Tool:
    def __init__(self, name: str, description: str, parameters: Dict, handler: Callable):
        self.name = name
        self.description = description
        self.parameters = parameters
        self.handler = handler

    def to_dict(self):
        return {
            "name": self.name,
            "description": self.description,
            "parameters": self.parameters,
        }

def _run_script_sync(script_path: str, args: Optional[List[str]] = None) -> tuple[bool, str]:
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

# --- Native Tools (Placeholder) ---
# These will be populated from mcp_server.py and backend/mcp/lsp_diagnostics_tool.py
NATIVE_TOOLS: Dict[str, Tool] = {
    "story": Tool(
        name="story",
        description="Scaffold a new user story file with the given title",
        parameters={
            "type": "object",
            "properties": {
                "title": {
                    "type": "string",
                    "description": "The title for the new user story",
                }
            },
            "required": ["title"],
        },
        handler=lambda title: (
            {"result": _run_script_sync("scripts/utils/scaffold_story.py", ["--title", title])[1]}
            if title
            else {"error": "title is required"}
        ),
    ),
    "pi_check": Tool(
        name="pi_check",
        description="Run Raspberry Pi 3B+ compatibility audit on a file or directory",
        parameters={
            "type": "object",
            "properties": {
                "path": {
                    "type": "string",
                    "description": "File or directory path to audit (relative to project root)",
                }
            },
            "required": ["path"],
        },
        handler=lambda path: {"result": _run_script_sync("scripts/utils/pi_audit.py", [path])[1]},
    ),
    "test_webhook": Tool(
        name="test_webhook",
        description="Send a test payload to the GitHub deployment webhook on the Pi",
        parameters={"type": "object", "properties": {}},
        handler=lambda: {"result": _run_script_sync("scripts/deployment/test_webhook.py")[1]},
    ),
    "handoff": Tool(
        name="handoff",
        description="Create a handoff note for session restart with context summary",
        parameters={
            "type": "object",
            "properties": {
                "summary": {
                    "type": "string",
                    "description": "Summary of current session state and next steps",
                }
            },
            "required": ["summary"],
        },
        handler=lambda summary: (
            {"result": _run_script_sync("scripts/utils/handoff.py", [summary])[1]}
            if summary
            else {"error": "summary is required"}
        ),
    ),
    "log_error": Tool(
        name="log_error",
        description="Log a failed agentic task for later reflection and learning",
        parameters={
            "type": "object",
            "properties": {
                "message": {
                    "type": "string",
                    "description": "Description of what failed and why",
                }
            },
            "required": ["message"],
        },
        handler=lambda message: (
            {"result": _run_script_sync("scripts/utils/manage_logs.py", ["--type", "error", "--message", message])[1]}
            if message
            else {"error": "message is required"}
        ),
    ),
    "log_success": Tool(
        name="log_success",
        description="Log a successful agentic task to capture patterns",
        parameters={
            "type": "object",
            "properties": {
                "message": {
                    "type": "string",
                    "description": "Description of what succeeded",
                }
            },
            "required": ["message"],
        },
        handler=lambda message: (
            {"result": _run_script_sync("scripts/utils/manage_logs.py", ["--type", "success", "--message", message])[1]}
            if message
            else {"error": "message is required"}
        ),
    ),
    "backlog": Tool(
        name="backlog",
        description="Generate or refresh the master backlog document",
        parameters={"type": "object", "properties": {}},
        handler=lambda: {"result": _run_script_sync("scripts/utils/generate_backlog.py")[1]},
    ),
    "notebooklm_list_notebooks": Tool(
        name="notebooklm_list_notebooks",
        description="Lists available NotebookLM notebooks",
        parameters={"type": "object", "properties": {}},
        handler=lambda: {"error": "not implemented"},
    ),
    "notebooklm_ask": Tool(
        name="notebooklm_ask",
        description="Asks a question about a NotebookLM notebook",
        parameters={
            "type": "object",
            "properties": {
                "notebook_id": {"type": "string", "description": "The ID of the notebook"},
                "query": {"type": "string", "description": "The question to ask"},
            },
            "required": ["notebook_id", "query"],
        },
        handler=lambda notebook_id, query: {"error": "not implemented"},
    ),
    "notebooklm_status": Tool(
        name="notebooklm_status",
        description="Gets the status of NotebookLM integration",
        parameters={"type": "object", "properties": {}},
        handler=lambda: {"error": "not implemented"},
    ),
    "get_workspace_diagnostics": Tool(
        name="get_workspace_diagnostics",
        description="Gets diagnostics for the workspace or a specific file",
        parameters={
            "type": "object",
            "properties": {
                "file": {"type": "string", "description": "Optional: file path to get diagnostics for"},
            },
        },
        handler=lambda file=None: {"error": "not implemented"},
    ),
}


class ProxyServer:
    def __init__(self, name: str, command: List[str], eager: bool = False, log_file: str = "/dev/null"):
        self.name = name
        self.command = command
        self.eager = eager
        self.process: Optional[subprocess.Popen] = None
        self.tools: Dict[str, Tool] = {}
        self.log_file = log_file
        self._lock = threading.Lock()
        self._stop_event = threading.Event()
        self._reader_thread: Optional[threading.Thread] = None

    def start(self) -> None:
        if self.is_alive():
            logging.info(f"Proxy '{self.name}' is already running.")
            return

        logging.info(f"Starting proxy '{self.name}' with command: {' '.join(self.command)}")
        try:
            with open(self.log_file, "a") as log_output:
                self.process = subprocess.Popen(
                    self.command,
                    stdin=subprocess.PIPE,
                    stdout=subprocess.PIPE,
                    stderr=log_output,  # Redirect stderr to log file
                    text=True,
                    bufsize=1,  # Line-buffered
                )
            self._reader_thread = threading.Thread(target=self._read_stdout, daemon=True)
            self._reader_thread.start()

            # MCP Handshake: Read tool list
            self._send_message({"type": "get_tools"})
            response = self._read_response()
            if response and response.get("type") == "tools_list":
                for tool_data in response.get("tools", []):
                    tool_name = f"{self.name}__{tool_data['name']}"
                    self.tools[tool_name] = Tool(
                        name=tool_name,
                        description=tool_data.get("description", ""),
                        parameters=tool_data.get("parameters", {}),
                        handler=self._create_proxy_handler(tool_data['name'])
                    )
                logging.info(f"Proxy '{self.name}' registered {len(self.tools)} tools.")
            else:
                logging.warning(f"Proxy '{self.name}' failed to receive tools list or unexpected response: {response}")
                self.stop() # Stop if handshake fails
        except FileNotFoundError:
            logging.error(f"Command not found for proxy '{self.name}': {self.command[0]}")
        except Exception as e:
            logging.error(f"Error starting proxy '{self.name}': {e}", exc_info=True)
            self.stop()

    def _read_stdout(self):
        if not self.process or not self.process.stdout:
            return
        while not self._stop_event.is_set():
            try:
                line = self.process.stdout.readline()
                if line:
                    # In a real implementation, you might parse this for events or additional responses
                    # For now, just logging to ensure we consume output
                    with open(self.log_file, "a") as log_output:
                        log_output.write(f"[{self.name} stdout]: {line}")
                elif self.process.poll() is not None: # Process exited
                    logging.info(f"Proxy '{self.name}' stdout stream closed, process exited.")
                    break
            except ValueError: # I/O operation on closed file
                logging.info(f"Proxy '{self.name}' stdout stream already closed.")
                break
            except Exception as e:
                logging.error(f"Error reading from proxy '{self.name}' stdout: {e}", exc_info=True)
                break
        logging.info(f"Proxy '{self.name}' reader thread terminated.")


    def stop(self) -> None:
        if self.process and self.process.poll() is None:
            logging.info(f"Stopping proxy '{self.name}'.")
            try:
                # Notify proxy of shutdown
                self._send_message({"type": "shutdown"})
                self.process.stdin.close()
                self._stop_event.set() # Signal reader thread to stop
                if self._reader_thread and self._reader_thread.is_alive():
                    self._reader_thread.join(timeout=5) # Give it a chance to finish
                self.process.terminate()
                self.process.wait(timeout=10)
            except Exception as e:
                logging.error(f"Error stopping proxy '{self.name}': {e}", exc_info=True)
            finally:
                self.process = None
                self.tools = {}
                self._stop_event.clear() # Reset for potential restart
        else:
            logging.info(f"Proxy '{self.name}' is not running.")


    def is_alive(self) -> bool:
        if self.process:
            return self.process.poll() is None
        return False

    def _send_message(self, message: Dict) -> None:
        if self.process and self.process.stdin:
            try:
                json_message = json.dumps(message)
                self.process.stdin.write(json_message + "\n")
                self.process.stdin.flush()
            except Exception as e:
                logging.error(f"Error sending message to proxy '{self.name}': {e}")
                self.stop()
        else:
            logging.warning(f"Attempted to send message to non-running proxy '{self.name}'.")

    def _read_response(self) -> Optional[Dict]:
        if self.process and self.process.stdout:
            try:
                line = self.process.stdout.readline()
                if line:
                    return json.loads(line)
            except json.JSONDecodeError as e:
                logging.error(f"JSON decode error from proxy '{self.name}': {e}, line: {line.strip()}")
            except Exception as e:
                logging.error(f"Error reading response from proxy '{self.name}': {e}")
        return None

    def _create_proxy_handler(self, tool_name_in_proxy: str) -> Callable:
        def handler(**kwargs):
            if not self.is_alive():
                logging.info(f"Proxy '{self.name}' is not alive, attempting to restart for tool '{tool_name_in_proxy}'.")
                self.start()
                if not self.is_alive():
                    logging.error(f"Failed to restart proxy '{self.name}' for tool '{tool_name_in_proxy}'.")
                    return {"error": f"Proxy '{self.name}' is not available."}
            
            with self._lock: # Ensure only one call at a time for stdio
                self._send_message({"type": "call_tool", "name": tool_name_in_proxy, "args": kwargs})
                response = self._read_response()
                if response and response.get("type") == "tool_response":
                    return response.get("result")
                else:
                    logging.error(f"Unexpected response for tool '{tool_name_in_proxy}' from proxy '{self.name}': {response}")
                    return {"error": "Unexpected tool response from proxy."}
        return handler


class MCPHub:
    def __init__(self, port: int, transport: str, start_proxies: bool = True):
        self.port = port
        self.transport = transport
        self.native_tools = NATIVE_TOOLS # Will be populated
        self.proxies: Dict[str, ProxyServer] = {}
        self.all_tools: Dict[str, Tool] = {}
        self._running = threading.Event()
        self._server_thread: Optional[threading.Thread] = None

        self._initialize_proxies(start_eager=start_proxies)

    def _initialize_proxies(self, start_eager: bool = True):
        for name, config in PROXY_CONFIGS.items():
            proxy = ProxyServer(
                name=name,
                command=config["command"],
                eager=(config["strategy"] == "eager"),
                log_file=config["log_file"]
            )
            self.proxies[name] = proxy
            if proxy.eager and start_eager:
                proxy.start() # Start eager proxies immediately

    def _register_tools(self, start_lazy=True):
        self.all_tools.clear()
        # Register native tools first
        self.all_tools.update(self.native_tools)

        # Register proxy tools, preferring native on collision
        for proxy_name, proxy in self.proxies.items():
            # If lazy, try to start it to get its tools, but don't fail if it doesn't start
            if start_lazy and not proxy.is_alive() and not proxy.eager:
                logging.info(f"Attempting to start lazy proxy '{proxy_name}' to get its tools...")
                proxy.start()
            
            for tool_name, tool in proxy.tools.items():
                if tool_name not in self.all_tools:
                    self.all_tools[tool_name] = tool
                else:
                    logging.warning(f"Tool name collision for '{tool_name}'. Native tool takes precedence over proxy '{proxy_name}' tool.")

        logging.info(f"Registered {len(self.all_tools)} total tools.")

    def start(self, start_lazy=True):
        self._register_tools(start_lazy=start_lazy)
        self._running.set()
        if self.transport == "tcp":
            logging.info(f"Starting MCP Hub (TCP) on port {self.port}...")
            self._server_thread = threading.Thread(target=self._run_tcp_server, daemon=True)
            self._server_thread.start()
        elif self.transport == "stdio":
            logging.info("Starting MCP Hub (STDIO)...")
            self._run_stdio_server()
        else:
            logging.error(f"Unknown transport: {self.transport}")
            sys.exit(1)
        logging.info("MCP Hub is running.")
        try:
            while self._running.is_set():
                time.sleep(1) # Keep main thread alive
        except KeyboardInterrupt:
            logging.info("MCP Hub received KeyboardInterrupt. Shutting down.")
        finally:
            self.stop()

    def stop(self):
        logging.info("Stopping MCP Hub...")
        self._running.clear()
        for proxy in self.proxies.values():
            proxy.stop()
        if self._server_thread and self._server_thread.is_alive():
            logging.info("Waiting for TCP server thread to stop...")
            self._server_thread.join(timeout=5)
            if self._server_thread.is_alive():
                logging.warning("TCP server thread did not stop gracefully.")
        logging.info("MCP Hub stopped.")

    def _run_tcp_server(self):
        server_sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        server_sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try:
            server_sock.bind(('127.0.0.1', self.port))
            server_sock.listen(5)
            server_sock.setblocking(False)
            logging.info(f"TCP server listening on 127.0.0.1:{self.port}")

            while self._running.is_set():
                readable, _, _ = select.select([server_sock], [], [], 1.0)
                if readable:
                    client_sock, addr = server_sock.accept()
                    logging.info(f"Accepted connection from {addr}")
                    client_thread = threading.Thread(
                        target=self._handle_tcp_client,
                        args=(client_sock,),
                        daemon=True
                    )
                    client_thread.start()
        except Exception as e:
            if self._running.is_set():
                logging.error(f"TCP server error: {e}", exc_info=True)
        finally:
            server_sock.close()
            logging.info("TCP server socket closed.")

    def _handle_tcp_client(self, client_sock: socket.socket):
        client_sock.settimeout(1.0)
        try:
            # Use makefile for convenient line-based reading/writing
            f_in = client_sock.makefile('r', buffering=1, encoding='utf-8')
            f_out = client_sock.makefile('w', buffering=1, encoding='utf-8')
            with client_sock, f_in, f_out:
                while self._running.is_set():
                    try:
                        line = f_in.readline()
                        if not line:
                            break
                        request = json.loads(line)
                        response = self._handle_request(request)
                        f_out.write(json.dumps(response) + "\n")
                        f_out.flush()
                    except (socket.timeout, TimeoutError):
                        continue
                    except json.JSONDecodeError:
                        logging.error("TCP client: Invalid JSON received")
                        break
                    except Exception as e:
                        if self._running.is_set():
                            logging.error(f"TCP client error: {e}")
                        break
        except Exception as e:
            if self._running.is_set():
                logging.error(f"Error initializing TCP client handler: {e}")
        logging.info("TCP client connection closed.")

    def _run_stdio_server(self):
        while self._running.is_set():
            try:
                line = sys.stdin.readline()
                if not line:
                    break # EOF
                
                request = json.loads(line)
                response = self._handle_request(request)
                
                json_response = json.dumps(response)
                sys.stdout.write(json_response + "\n")
                sys.stdout.flush()

            except json.JSONDecodeError:
                logging.error(f"STDIO: Invalid JSON received: {line.strip()}")
                sys.stdout.write(json.dumps({"error": "Invalid JSON"}) + "\n")
                sys.stdout.flush()
            except Exception as e:
                logging.error(f"STDIO: Error handling request: {e}", exc_info=True)
                sys.stdout.write(json.dumps({"error": str(e)}) + "\n")
                sys.stdout.flush()

    def _handle_request(self, request: Dict) -> Dict:
        request_type = request.get("type")
        if request_type == "get_tools":
            tools_list = [tool.to_dict() for tool in self.all_tools.values()]
            return {"type": "tools_list", "tools": tools_list}
        elif request_type == "call_tool":
            tool_name = request.get("name")
            args = request.get("args", {})
            tool = self.all_tools.get(tool_name)
            if tool:
                try:
                    result = tool.handler(**args)
                    return {"type": "tool_response", "result": result}
                except Exception as e:
                    logging.error(f"Error executing tool '{tool_name}': {e}", exc_info=True)
                    return {"type": "tool_response", "error": str(e)}
            else:
                return {"type": "tool_response", "error": f"Tool '{tool_name}' not found."}
        elif request_type == "shutdown":
            logging.info(f"Received shutdown request via {self.transport}.")
            self._running.clear()
            return {"type": "status", "message": "Shutting down."}
        else:
            return {"error": "Unknown request type."}


    def print_status(self):
        logging.info("--- MCP Hub Status ---")
        logging.info(f"Bound Port: {self.port}")
        logging.info(f"Transport: {self.transport}")
        logging.info(f"Total Tools: {len(self.all_tools)}")
        logging.info("Active Proxies:")
        for name, proxy in self.proxies.items():
            status = "Running" if proxy.is_alive() else "Stopped"
            logging.info(f"  - {name}: {status} (Eager: {proxy.eager})")
            if proxy.is_alive():
                logging.info(f"    Tools provided: {len(proxy.tools)}")
        logging.info("----------------------")

    def list_tools(self):
        logging.info("--- MCP Hub Tools List ---")
        for tool_name, tool in self.all_tools.items():
            source = "Native"
            for proxy_name, proxy in self.proxies.items():
                if tool_name in proxy.tools:
                    source = f"Proxy ({proxy_name})"
                    break
            logging.info(f"- {tool_name} (Source: {source})")
            logging.info(f"  Description: {tool.description}")
            logging.info(f"  Parameters: {json.dumps(tool.parameters)}")
        logging.info("--------------------------")

    def print_config(self):
        port = self.port
        host = "127.0.0.1"

        # Claude Code format
        print("--- Claude Code Configuration (TCP Transport) ---")
        claude_config = {
            "mcpServers": {
                "copernicus": {
                    "transport": "tcp",
                    "host": host,
                    "port": port
                }
            }
        }
        print(json.dumps(claude_config, indent=2))
        print("\n")

        # Gemini CLI format
        print("--- Gemini CLI Configuration (~/.gemini/settings.json mcpServers format) ---")
        gemini_cli_config = {
            "mcpServers": {
                "copernicus": {
                    "transport": "tcp",
                    "host": host,
                    "port": port
                }
            }
        }
        print(json.dumps(gemini_cli_config, indent=2))
        print("\n")

        # Continue.dev format
        print("--- Continue.dev Configuration (.continue/config.json mcpServers format) ---")
        continue_dev_config = {
            "mcpServers": {
                "copernicus": {
                    "transport": "tcp",
                    "host": host,
                    "port": port
                }
            }
        }
        print(json.dumps(continue_dev_config, indent=2))
        print("\n")

        # Generic format (host + port only)
        print("--- Generic Configuration (Host:Port) ---")
        print(f"{host}:{port}")
        print("\n")


def main():
    parser = argparse.ArgumentParser(description="Copernicus MCP Hub")
    parser.add_argument("--port", type=int, default=DEFAULT_MCP_PORT,
                        help=f"Port for TCP transport (default: {DEFAULT_MCP_PORT})")
    parser.add_argument("--transport", type=str, default="tcp", choices=["tcp", "stdio"],
                        help="Transport protocol (default: tcp)")
    parser.add_argument("--status", action="store_true", help="Print hub status and exit.")
    parser.add_argument("--list-tools", action="store_true", help="Print all registered tools and exit.")
    parser.add_argument("--print-config", action="store_true", help="Print ready-to-paste client config and exit.")
    
    args = parser.parse_args()

    # Allow environment variable to override port
    port = int(os.environ.get("COPERNICUS_MCP_PORT", args.port))

    # Handle --print-config separately, as it doesn't need to start the hub
    if args.print_config:
        # Create a dummy hub instance to access print_config logic
        # This hub won't actually start or initialize proxies
        dummy_hub = MCPHub(port=port, transport=args.transport, start_proxies=False)
        dummy_hub.print_config()
        sys.exit(0)

    # --status and --list-tools don't need eager proxies running
    informational = args.status or args.list_tools
    hub = MCPHub(port=port, transport=args.transport, start_proxies=not informational)

    if args.status:
        hub.print_status()
        sys.exit(0)
    elif args.list_tools:
        hub.list_tools()
        sys.exit(0)
    
    # Register signal handlers for graceful shutdown
    signal.signal(signal.SIGINT, lambda s, f: hub.stop())
    signal.signal(signal.SIGTERM, lambda s, f: hub.stop())

    hub.start()

if __name__ == "__main__":
    main()
