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
import sqlite3
from datetime import datetime
from ollama import Client

# Config
OLLAMA_API_KEY = os.environ.get("OLLAMA_API_KEY")
OLLAMA_CLOUD_HOST = os.environ.get("OLLAMA_CLOUD_HOST", "https://ollama.com")
OLLAMA_LOCAL_URL = os.environ.get("OLLAMA_LOCAL_URL", "http://192.168.1.185:11434")
DB_PATH = os.path.expanduser("~/Library/Application Support/copernicus/copernicus.db")

MODEL_METADATA = {
    'deepseek-v3.2:cloud': {'tier': 'high', 'context': 128000, 'specialty': 'complex-logic'},
    'glm-5:cloud': {'tier': 'high', 'context': 64000, 'specialty': 'architectural-planning'},
    'devstral-small-2:24b': {'tier': 'med', 'context': 32000, 'specialty': 'precise-coding'},
    'qwen2.5-coder:1.5b': {'tier': 'low', 'context': 8000, 'specialty': 'formatting-fast'}
}

# Structure Grounding
REPO_INDEX_PATH = "repo_index.json"
STRUCTURE_CONTEXT = ""
if os.path.exists(REPO_INDEX_PATH):
    try:
        with open(REPO_INDEX_PATH, "r") as f:
            idx = json.load(f)
            clusters = idx.get("logical_clusters", {})
            cluster_str = "\n".join([f"- {k}: `{v}`" for k, v in clusters.items()])
            STRUCTURE_CONTEXT = f"""
PROJECT STRUCTURE GROUNDING:
This is an Electron-based project. Key logical clusters:
{cluster_str}

CRITICAL: Never assume a standard `/src` root. Always use the full path relative to the project root.
If you are unsure of a file's location, use `get_repo_map()` or `list_directory`.
"""
    except:
        pass

TOOL_DEFINITION_PROMPT = f"""
{STRUCTURE_CONTEXT}

You have access to the following tools. To use a tool, output a JSON block in this format:
[TOOL: <name> arguments: {{<args>}}]

Available Tools:
1. read_file(path: string) - Read a file's content.
2. write_file(path: string, content: string) - Write content to a file.
3. search_codebase(query: string) - Perform a local RAG search.
4. dispatch(model: string, prompt: string) - Request a specific model to handle a sub-task. Use model names from /models:capabilities.
5. mcp_call(tool_name: string, arguments: object) - Call a local MCP tool.
6. get_repo_map() - Returns a full JSON index of the repository structure. Use this to resolve path ambiguities.
7. signal_completion(summary: string) - Use this tool when your assigned task is 100% complete and verified.

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

        system_msg = [m for m in messages if m['role'] == 'system']
        other_msgs = [m for m in messages if m['role'] != 'system']

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

def log_event(event_type, content, metadata=None):
    """Logs an event to the Copernicus database."""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO events (type, content, metadata, created_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)",
            (event_type, content, json.dumps(metadata) if metadata else "{}")
        )
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"Error logging event: {e}")

def execute_tool(tool_name, arguments, agent_id="default"):
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
            os.makedirs(os.path.dirname(path), exist_ok=True)
            with open(path, "w") as f:
                f.write(content)
            log_event("FILE_WRITE", f"{agent_id} wrote to {path}", {"path": path})
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
        cmd = ["python3", "scripts/ollama_tool_shim.py", f"/model:{model} {prompt}"]
        res = subprocess.run(cmd, capture_output=True, text=True)
        return res.stdout
        
    elif tool_name == "mcp_call":
        mcp_tool = arguments.get("tool_name")
        return f"MCP tool '{mcp_tool}' called successfully (Mock Output)."

    elif tool_name == "get_repo_map":
        if os.path.exists(REPO_INDEX_PATH):
            with open(REPO_INDEX_PATH, "r") as f:
                return f.read()
        return "Error: repo_index.json not found."

    elif tool_name == "signal_completion":
        summary = arguments.get("summary", "No summary provided.")
        log_event("TASK_COMPLETE", f"Agent {agent_id} completed task.", {"summary": summary})
        print(f"\n✅ {agent_id.upper()} SIGNALED COMPLETION: {summary}")
        return "COMPLETED"
        
    return f"Unknown tool: {tool_name}"

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

    if user_prompt.strip() == "/models:capabilities":
        print(json.dumps(MODEL_METADATA, indent=2))
        sys.exit(0)
    
    model_override = None
    model_match = re.search(r"/model:([\w\-\:\.]+)", user_prompt)
    if model_match:
        model_override = model_match.group(1)
        user_prompt = user_prompt.replace(model_match.group(0), "").strip()
    
    persona = "junior-dev" 
    for p in PERSONA_ROUTING.keys():
        if f"/{p}" in user_prompt:
            persona = p
            user_prompt = user_prompt.replace(f"/{p}", "").strip()
            break

    model, target_url, is_cloud = PERSONA_ROUTING.get(persona)
    
    if model_override:
        model = model_override
        is_cloud = ":cloud" in model or model in MODEL_METADATA
        target_url = OLLAMA_CLOUD_HOST if is_cloud else OLLAMA_LOCAL_URL

    ctx_mgr = ContextManager(capacity=MODEL_METADATA.get(model, {}).get('context', 32000))
    headers = {'Authorization': f'Bearer {OLLAMA_API_KEY}'} if is_cloud else {}
    client = Client(host=target_url, headers=headers)

    system_prompt = f"OPERATIONAL MODE: {persona.upper()} SUB-AGENT. PROJECT: COPERNICUS IDE. ACTIVE_MODEL: {model}.\n{TOOL_DEFINITION_PROMPT}"

    print(f"--- Routing to Ollama ({model}) via {target_url} (Persona: {persona}) ---")
    log_event("AGENT_DISPATCH", f"Dispatched {persona} using {model}", {"prompt": user_prompt})
    
    messages = [
        {'role': 'system', 'content': system_prompt},
        {'role': 'user', 'content': user_prompt}
    ]
    
    try:
        max_turns = 100 # INCREASED: High runway for async tasks
        turn = 0
        while turn < max_turns:
            messages = ctx_mgr.prune_context(messages)
            response = client.chat(model=model, messages=messages)
            content = response['message']['content']
            messages.append({'role': 'assistant', 'content': content})
            
            tool_match = re.search(r"\[TOOL:\s*(\w+)\s*arguments:\s*({.*?})\]", content, re.DOTALL)
            if not tool_match:
                print(content)
                break
                
            name = tool_match.group(1)
            try:
                args = json.loads(tool_match.group(2))
                result = execute_tool(name, args, agent_id=persona)
                
                if result == "COMPLETED":
                    break
                    
                follow_up = f"Tool '{name}' result:\n\n{result}\n\nApply the strict execution protocol."
                messages.append({'role': 'user', 'content': follow_up})
                print(f"✅ Turn {turn+1}: Tool {name} result received.")
            except Exception as e:
                print(f"Error parsing tool arguments: {e}")
                print(content)
                break
            
            turn += 1
            
    except Exception as e:
        print(f"Error in Ollama communication: {e}")

if __name__ == "__main__":
    main()
