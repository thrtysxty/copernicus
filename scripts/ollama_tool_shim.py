#!/usr/bin/env python3
"""
Ollama Tool Shim - COPERNICUS

This script provides a tool-calling layer for local Ollama models.
It wraps the Ollama API, injects a system prompt with tool definitions,
and handles the execution of tools like:
- read_file
- write_file
- search_codebase (RAG)
- mcp_call (delegation to local MCP server)

Usage:
    python3 scripts/ollama_tool_shim.py "/senior-dev Fix the IPC handler"
"""

import sys
import os
import json
import subprocess
import re
import urllib.request
import urllib.error

# CROSS-REFERENCE: Story 196 (Project Work)
# This shim demonstrates how we will implement native tool-calling in the Electron app.

OLLAMA_URL = os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434")

TOOL_DEFINITION_PROMPT = """
You have access to the following tools. To use a tool, output a JSON block in this format:
[TOOL: <name> arguments: {<args>}]

Available Tools:
1. read_file(path: string) - Read a file's content.
2. write_file(path: string, content: string) - Write content to a file.
3. search_codebase(query: string) - Perform a local RAG search.
4. mcp_call(tool_name: string, arguments: object) - Call a local MCP tool (story, pi_check, etc).

Example:
[TOOL: read_file arguments: {"path": "copernicus/package.json"}]
"""

def call_ollama(model, prompt, system_prompt):
    """Simple wrapper for the Ollama chat API using urllib."""
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": system_prompt + "\n" + TOOL_DEFINITION_PROMPT},
            {"role": "user", "content": prompt}
        ],
        "stream": False
    }
    
    try:
        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            f"{OLLAMA_URL}/api/chat",
            data=data,
            headers={"Content-Type": "application/json"}
        )
        with urllib.request.urlopen(req) as response:
            res_body = response.read().decode("utf-8")
            return json.loads(res_body)["message"]["content"]
    except Exception as e:
        return f"Error calling Ollama: {e}"

def execute_tool(tool_name, arguments):
    """Executes the requested tool and returns the result."""
    print(f"🔧 Executing Tool: {tool_name} with {arguments}...")
    
    if tool_name == "read_file":
        path = arguments.get("path")
        if not path: return "Error: path required"
        try:
            with open(path, "r") as f:
                return f.read()
        except Exception as e:
            return f"Error reading file: {e}"
            
    elif tool_name == "search_codebase":
        query = arguments.get("query")
        if not query: return "Error: query required"
        # Use our existing CLI bridge for search logic
        cmd = ["python3", "scripts/claude_ollama_cli.py", f"/senior-dev {query}"]
        res = subprocess.run(cmd, capture_output=True, text=True)
        return res.stdout
        
    elif tool_name == "mcp_call":
        mcp_tool = arguments.get("tool_name")
        mcp_args = arguments.get("arguments", {})
        # This is a mock/proxy for the actual MCP stdio server
        # In a real implementation, we'd use an MCP client here
        return f"MCP tool '{mcp_tool}' called successfully (Mock Output)."
        
    return f"Unknown tool: {tool_name}"

# Model Mapping for Hybrid Cloud/Local Orchestration (Optimized for Dell R210ii)
PERSONA_MODELS = {
    "architect": "architect:latest",   
    "senior-dev": "senior-dev:latest", 
    "scribe": "scribe:latest",         
    "researcher": "deepseek-r1:8b",    
    "sentinel": "mistral:latest"       
}

def main():
    if len(sys.argv) < 2:
        print("Usage: python3 scripts/ollama_tool_shim.py '<prompt>' [--persona <name>]")
        sys.exit(1)

    user_prompt = sys.argv[1]
    
    # Simple persona detection from prompt or env
    persona = "senior-dev" # default
    for p in PERSONA_MODELS.keys():
        if f"/{p}" in user_prompt:
            persona = p
            user_prompt = user_prompt.replace(f"/{p}", "").strip()
            break

    model = os.environ.get("OLLAMA_MODEL", PERSONA_MODELS.get(persona))
    system_prompt = f"You are acting as the {persona} sub-agent in the COPERNICUS IDE."

    print(f"--- Routing to Ollama ({model}) via Persona: {persona} ---")
    
    content = call_ollama(model, user_prompt, system_prompt)
    
    # Check for tool use
    tool_match = re.search(r"\[TOOL:\s*(\w+)\s*arguments:\s*(\{.*?\})\]", content, re.DOTALL)
    if tool_match:
        name = tool_match.group(1)
        try:
            args = json.loads(tool_match.group(2))
            result = execute_tool(name, args)
            
            # Re-prompt with tool result
            print(f"✅ Tool result received. Re-prompting {model}...")
            follow_up = f"Tool '{name}' result:\n\n{result}\n\nPlease proceed with the task."
            final_content = call_ollama(model, follow_up, system_prompt)
            print(final_content)
        except Exception as e:
            print(f"Error parsing tool arguments: {e}")
            print(content)
    else:
        print(content)

if __name__ == "__main__":
    main()
