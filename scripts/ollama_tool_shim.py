#!/usr/bin/env python3
"""
Ollama Tool Shim - COPERNICUS (Official Library Edition)

Standardized routing for Hybrid-Hybrid orchestration:
- High-Intel: Directly to https://ollama.com via Bearer Token.
- Tactical: To local Dell R210ii sidekick.
"""

import sys
import os
import json
import subprocess
import re
from ollama import Client

# Config
OLLAMA_API_KEY = os.environ.get("OLLAMA_API_KEY")
OLLAMA_CLOUD_HOST = os.environ.get("OLLAMA_CLOUD_HOST", "https://ollama.com")
OLLAMA_LOCAL_URL = os.environ.get("OLLAMA_LOCAL_URL", "http://192.168.1.185:11434")

TOOL_DEFINITION_PROMPT = """
You have access to the following tools. To use a tool, output a JSON block in this format:
[TOOL: <name> arguments: {<args>}]

Available Tools:
1. read_file(path: string) - Read a file's content.
2. write_file(path: string, content: string) - Write content to a file.
3. search_codebase(query: string) - Perform a local RAG search.
4. mcp_call(tool_name: string, arguments: object) - Call a local MCP tool.

STRICT EXECUTION PROTOCOL:
1. You are an industrial sub-agent within the COPERNICUS IDE.
2. NEVER provide general advice, tutorials, or unrelated platform examples.
3. ONLY act on the provided source code and repository context.
4. If information is missing, you MUST use a tool to find it.
5. NEVER use placeholders (e.g., // ...). Provide complete code implementation.
"""

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
        cmd = ["python3", "scripts/claude_ollama_cli.py", f"/senior-dev {query}"]
        res = subprocess.run(cmd, capture_output=True, text=True)
        return res.stdout
        
    elif tool_name == "mcp_call":
        mcp_tool = arguments.get("tool_name")
        return f"MCP tool '{mcp_tool}' called successfully (Mock Output)."
        
    return f"Unknown tool: {tool_name}"

# Persona Routing Matrix
# Key: (Model, URL_Source, Is_Cloud)
PERSONA_ROUTING = {
    "researcher": ("deepseek-v3.2:cloud",     OLLAMA_CLOUD_HOST, True),
    "architect":  ("glm-5:cloud",             OLLAMA_CLOUD_HOST, True),
    "thinker":    ("kimi-k2.5:cloud",         OLLAMA_CLOUD_HOST, True),
    "coder":      ("qwen3-coder-next:cloud",  OLLAMA_CLOUD_HOST, True),
    "expert":     ("cogito-2.1:cloud",        OLLAMA_CLOUD_HOST, True),
    "sentinel":   ("devstral-small-2:24b",    OLLAMA_CLOUD_HOST, True),
    "scribe":     ("qwen2.5-coder:1.5b",      OLLAMA_LOCAL_URL,  False),
    "junior-dev": ("qwen2.5-coder:1.5b",      OLLAMA_LOCAL_URL,  False),
    "ui-dev":     ("qwen2.5:3b",              OLLAMA_LOCAL_URL,  False),
    "reviewer":   ("phi3:mini",               OLLAMA_LOCAL_URL,  False)
}

def main():
    if len(sys.argv) < 2:
        print("Usage: python3 scripts/ollama_tool_shim.py '<prompt>' [--persona <name>]")
        sys.exit(1)

    user_prompt = sys.argv[1]
    
    persona = "junior-dev" # default
    for p in PERSONA_ROUTING.keys():
        if f"/{p}" in user_prompt:
            persona = p
            user_prompt = user_prompt.replace(f"/{p}", "").strip()
            break

    model, target_url, is_cloud = PERSONA_ROUTING.get(persona)
    
    # Initialize Official Client
    headers = {'Authorization': f'Bearer {OLLAMA_API_KEY}'} if is_cloud else {}
    client = Client(host=target_url, headers=headers)

    system_prompt = f"OPERATIONAL MODE: {persona.upper()} SUB-AGENT. PROJECT: COPERNICUS IDE.\n{TOOL_DEFINITION_PROMPT}"

    print(f"--- Routing to Ollama ({model}) via {target_url} (Persona: {persona}) ---")
    
    try:
        response = client.chat(model=model, messages=[
            {'role': 'system', 'content': system_prompt},
            {'role': 'user', 'content': user_prompt}
        ])
        content = response['message']['content']
        
        # Tool-calling loop
        tool_match = re.search(r"\[TOOL:\s*(\w+)\s*arguments:\s*(\{.*?\})\]", content, re.DOTALL)
        if tool_match:
            name = tool_match.group(1)
            try:
                args = json.loads(tool_match.group(2))
                result = execute_tool(name, args)
                print(f"✅ Tool result received. Re-prompting {model}...")
                
                follow_up = f"Tool '{name}' result:\n\n{result}\n\nApply the strict execution protocol to this result."
                final_response = client.chat(model=model, messages=[
                    {'role': 'system', 'content': system_prompt},
                    {'role': 'user', 'content': user_prompt},
                    {'role': 'assistant', 'content': content},
                    {'role': 'user', 'content': follow_up}
                ])
                print(final_response['message']['content'])
            except Exception as e:
                print(f"Error parsing tool arguments: {e}")
                print(content)
        else:
            print(content)
            
    except Exception as e:
        print(f"Error in Ollama communication: {e}")

if __name__ == "__main__":
    main()
