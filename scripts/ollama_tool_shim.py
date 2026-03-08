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
import urllib.request
from ollama import Client

# Config
OLLAMA_API_KEY = os.environ.get("OLLAMA_API_KEY")
OLLAMA_CLOUD_HOST = os.environ.get("OLLAMA_CLOUD_HOST", "https://ollama.com")
OLLAMA_LOCAL_URL = os.environ.get("OLLAMA_LOCAL_URL", "http://192.168.1.185:11434")

# AC-1: Model Capability Discovery
MODEL_METADATA = {
    'deepseek-v3.2:cloud': {'tier': 'high', 'context': 128000, 'specialty': 'complex-logic'},
    'glm-5:cloud': {'tier': 'high', 'context': 64000, 'specialty': 'architectural-planning'},
    'devstral-small-2:24b': {'tier': 'med', 'context': 32000, 'specialty': 'precise-coding'},
    'qwen2.5-coder:1.5b': {'tier': 'low', 'context': 8000, 'specialty': 'formatting-fast'}
}

TOOL_DEFINITION_PROMPT = """
You have access to the following tools. To use a tool, output a JSON block in this format:
[TOOL: <name> arguments: {<args>}]

Available Tools:
1. read_file(path: string) - Read a file's content.
2. write_file(path: string, content: string) - Write content to a file.
3. search_codebase(query: string) - Perform a local RAG search.
4. dispatch(model: string, prompt: string) - Request a specific model to handle a sub-task. Use model names from /models:capabilities.
5. mcp_call(tool_name: string, arguments: object) - Call a local MCP tool.

STRICT EXECUTION PROTOCOL:
1. You are an industrial sub-agent within the COPERNICUS IDE.
2. NEVER provide general advice, tutorials, or unrelated platform examples.
3. ONLY act on the provided source code and repository context.
4. If information is missing, you MUST use a tool to find it.
5. NEVER use placeholders (e.g., // ...). Provide complete code implementation.
6. MANDATORY REASONING: Before calling a tool or selecting a model, output a [MODEL REASONING] block explaining your choice.
"""

class ContextManager:
    def __init__(self, capacity=32000):
        self.capacity = capacity
        self.threshold = 0.8 * capacity

    def count_tokens(self, text):
        """Heuristic: 4 characters per token."""
        return len(text) // 4

    def prune_context(self, messages):
        total_tokens = sum(self.count_tokens(m['content']) for m in messages)
        
        if total_tokens <= self.threshold:
            return messages

        print(f"⚠️ Context window capacity exceeded ({total_tokens} tokens). Pruning...")

        # Separate system prompt (Fixed)
        system_msg = [m for m in messages if m['role'] == 'system']
        other_msgs = [m for m in messages if m['role'] != 'system']

        # Identification logic for RAG results
        rag_indices = [i for i, m in enumerate(other_msgs) if "Tool 'search_codebase' result:" in m['content']]
        
        if rag_indices:
            print(f"🔧 Pruning oldest RAG result to free space.")
            other_msgs.pop(rag_indices[0])
        else:
            if len(other_msgs) > 2:
                print(f"🔧 Pruning oldest chat turn.")
                other_msgs = other_msgs[2:]
            else:
                other_msgs = other_msgs[1:]

        return system_msg + other_msgs

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
            
    elif tool_name == "write_file":
        path = arguments.get("path")
        content = arguments.get("content")
        if not path or content is None: return "Error: path and content required"
        try:
            with open(path, "w") as f:
                f.write(content)
            return f"Successfully wrote to {path}"
        except Exception as e:
            return f"Error writing file: {e}"

    elif tool_name == "search_codebase":
        query = arguments.get("query")
        if not query: return "Error: query required"
        cmd = ["python3", "scripts/claude_ollama_cli.py", f"/senior-dev {query}"]
        res = subprocess.run(cmd, capture_output=True, text=True)
        return res.stdout

    elif tool_name == "dispatch":
        model = arguments.get("model")
        prompt = arguments.get("prompt")
        if not model or not prompt: return "Error: model and prompt required"
        # Recursively call the shim with model override
        cmd = ["python3", "scripts/ollama_tool_shim.py", f"/model:{model} {prompt}"]
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
    "coder":      ("devstral-small-2:24b",    OLLAMA_CLOUD_HOST, True),
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

    # Command: /models:capabilities
    if user_prompt.strip() == "/models:capabilities":
        print(json.dumps(MODEL_METADATA, indent=2))
        sys.exit(0)
    
    # Model override via /model:name
    model_override = None
    model_match = re.search(r"/model:([\w\-\:\.]+)", user_prompt)
    if model_match:
        model_override = model_match.group(1)
        user_prompt = user_prompt.replace(model_match.group(0), "").strip()
    
    persona = "junior-dev" # default
    for p in PERSONA_ROUTING.keys():
        if f"/{p}" in user_prompt:
            persona = p
            user_prompt = user_prompt.replace(f"/{p}", "").strip()
            break

    model, target_url, is_cloud = PERSONA_ROUTING.get(persona)
    # Apply override if provided
    if model_override:
        new_model = model_override
        # AC-3: Permission-Based Switching
        current_tier = MODEL_METADATA.get(model, {}).get('tier', 'low')
        new_tier = MODEL_METADATA.get(new_model, {}).get('tier', 'low')

        if new_tier == 'high' and current_tier != 'high':
            print(f"🔒 HIGH-TIER SWITCH DETECTED: {model} -> {new_model}")
            print(f"⏳ Waiting for human-in-the-loop confirmation...")
            try:
                # Call local backend for confirmation using urllib.request
                url = "http://localhost:5001/api/orchestration/confirm-model-switch"
                data = json.dumps({"model": new_model, "reason": "Orchestrator request"}).encode('utf-8')
                req = urllib.request.Request(url, data=data, headers={'Content-Type': 'application/json'})
                with urllib.request.urlopen(req, timeout=65) as response:
                    res_data = json.loads(response.read().decode('utf-8'))
                    if not res_data.get('approved'):
                        print("❌ Switch REJECTED by user. Aborting task.")
                        sys.exit(1)
                print("✅ Switch APPROVED. Proceeding.")
            except Exception as e:
                print(f"⚠️ Confirmation service unavailable: {e}. Defaulting to REJECT.")
                sys.exit(1)

        model = new_model
        # Determine target and is_cloud based on metadata or name
        is_cloud = ":cloud" in model or model in MODEL_METADATA
        target_url = OLLAMA_CLOUD_HOST if is_cloud else OLLAMA_LOCAL_URL


    ctx_mgr = ContextManager(capacity=MODEL_METADATA.get(model, {}).get('context', 32000))
    
    # Initialize Official Client
    headers = {'Authorization': f'Bearer {OLLAMA_API_KEY}'} if is_cloud else {}
    client = Client(host=target_url, headers=headers)

    system_prompt = f"OPERATIONAL MODE: {persona.upper()} SUB-AGENT. PROJECT: COPERNICUS IDE. ACTIVE_MODEL: {model}.\n{TOOL_DEFINITION_PROMPT}"

    print(f"--- Routing to Ollama ({model}) via {target_url} (Persona: {persona}) ---")
    
    try:
        messages = [
            {'role': 'system', 'content': system_prompt},
            {'role': 'user', 'content': user_prompt}
        ]
        
        # Initial prune check
        messages = ctx_mgr.prune_context(messages)
        
        response = client.chat(model=model, messages=messages)
        content = response['message']['content']
        
        # Tool-calling loop (AC-2 mandate Reasoning)
        # We allow up to 10 turns for the loop
        for _ in range(10):
            tool_match = re.search(r"\[TOOL:\s*(\w+)\s*arguments:\s*(\{.*?\})\]", content, re.DOTALL)
            if not tool_match:
                break
                
            name = tool_match.group(1)
            try:
                args = json.loads(tool_match.group(2))
                result = execute_tool(name, args)
                print(f"✅ Tool result received. Re-prompting {model}...")
                
                messages.append({'role': 'assistant', 'content': content})
                follow_up = f"Tool '{name}' result:\n\n{result}\n\nApply the strict execution protocol to this result. Ensure you provide [MODEL REASONING] before any further tool calls or final output."
                messages.append({'role': 'user', 'content': follow_up})
                
                # Active pruning before re-prompt
                messages = ctx_mgr.prune_context(messages)
                
                response = client.chat(model=model, messages=messages)
                content = response['message']['content']
            except Exception as e:
                print(f"Error parsing tool arguments: {e}")
                break
        
        print(content)
            
    except Exception as e:
        print(f"Error in Ollama communication: {e}")

if __name__ == "__main__":
    main()
