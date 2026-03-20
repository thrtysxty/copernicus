import sys
import json
import argparse
import time
import os
import re
import shlex
import subprocess
import sqlite3
import threading
from datetime import datetime
from ollama import Client as OllamaClient

# Load ~/.secrets into environment for non-login shells (Claude Code, VS Code terminals)
_secrets_path = os.path.expanduser("~/.secrets")
if os.path.exists(_secrets_path):
    with open(_secrets_path) as _f:
        for _line in _f:
            _line = _line.strip()
            if _line and not _line.startswith('#') and '=' in _line:
                _key, _, _val = _line.lstrip('export ').partition('=')
                if _key.strip() and _key.strip() not in os.environ:
                    os.environ[_key.strip()] = _val.strip()

# Standalone Cloud Agent System (V2.4.0)
# Development-only tool for orchestration via an active Orchestrator.
# Routes :cloud models directly to Ollama's Cloud API with full tool-calling support.

OLLAMA_CLOUD_URL = os.environ.get("OLLAMA_CLOUD_HOST", os.environ.get("OLLAMA_CLOUD_URL", "https://ollama.com"))
OLLAMA_LOCAL_URL = "http://localhost:11434"
DELL_SERVER_URL = "http://192.168.1.185:11434"

EVENT_SIGNAL_ORCHESTRATOR = "SIGNAL_ORCHESTRATOR"
MODEL_SUFFIX_CLOUD = ":cloud"
BASE_DIR = os.path.dirname(__file__)
CONFIG_PATH = os.path.join(BASE_DIR, "models.json")
LOG_PATH = os.path.join(BASE_DIR, "performance_log.json")
WORKTREE_DIR = os.path.join(BASE_DIR, "worktrees")

BASH_ALLOWLIST = {"git", "python3", "node", "npx", "cat", "ls", "grep", "find", "mkdir", "cp", "mv", "echo", "pwd", "wc", "head", "tail"}

# Patterns that indicate credential material in command output — redact before returning to model
REDACT_PATTERNS = [
    re.compile(r'sk-[A-Za-z0-9\-_]{20,}'),                              # OpenAI / Anthropic key format
    re.compile(r'(?i)Bearer\s+[A-Za-z0-9\-_\.]{20,}'),                  # Bearer tokens
    re.compile(r'(?i)(?:^|\s)[A-Z_]*(?:KEY|TOKEN|SECRET|PASSWORD)[A-Z_]*\s*=\s*\S+', re.MULTILINE),  # ENV=value lines
]

# env keys safe to pass into bash tool subprocess — everything else stripped
SAFE_ENV_KEYS = {"PATH", "LANG", "TERM"}

# Models explicitly hosted on the Dell Server (Mission-Specific)
DELL_MODELS = [
    "moondream:latest", "junior-dev:latest", "gemma3:4b",
    "phi3:mini", "qwen2.5:3b", "qwen2.5-coder:1.5b",
    "glm-ocr:latest", "ministral:3b", "lfm2.5-thinking:1.2b",
    "smollm2:1.7b", "smollm2:135m", "qwen3-embedding:0.6b",
    "bge-m3:latest", "embeddinggemma:latest", "nomic-embed-text:latest"
]

# ── Tool definitions (Ollama function-calling format) ────────────────────────

TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "read_file",
            "description": "Read the contents of a file. Path is relative to the working directory.",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {"type": "string", "description": "File path relative to working directory"}
                },
                "required": ["path"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "write_file",
            "description": "Write content to a file. Creates parent directories if needed. Path is relative to the working directory.",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {"type": "string", "description": "File path relative to working directory"},
                    "content": {"type": "string", "description": "Content to write"}
                },
                "required": ["path", "content"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "list_dir",
            "description": "List files and directories at a path. Path is relative to working directory.",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {"type": "string", "description": "Directory path relative to working directory (default: '.')"}
                },
                "required": []
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "bash",
            "description": f"Run a shell command in the working directory. Allowed commands: {', '.join(sorted(BASH_ALLOWLIST))}. No pipes, no redirection.",
            "parameters": {
                "type": "object",
                "properties": {
                    "command": {"type": "string", "description": "Command to run (first token must be in allowlist)"}
                },
                "required": ["command"]
            }
        }
    }
]


def _safe_path(root: str, rel: str) -> str | None:
    """Resolve rel against root; return None if it escapes root."""
    resolved = os.path.realpath(os.path.join(root, rel))
    if not resolved.startswith(os.path.realpath(root)):
        return None
    return resolved


def execute_tool(name: str, args: dict, root: str, verbose: bool = False) -> str:
    """Execute a tool call; return result string. Never raises."""
    try:
        if name == "read_file":
            path = _safe_path(root, args.get("path", ""))
            if not path:
                return json.dumps({"error": "Path traversal rejected"})
            if not os.path.exists(path):
                return json.dumps({"error": f"File not found: {args.get('path')}"})
            with open(path, "r", errors="replace") as f:
                content = f.read()
            if verbose:
                print(f"  [tool] read_file({args.get('path')}) → {len(content)} chars", file=sys.stderr)
            return content

        elif name == "write_file":
            path = _safe_path(root, args.get("path", ""))
            if not path:
                return json.dumps({"error": "Path traversal rejected"})
            os.makedirs(os.path.dirname(path), exist_ok=True)
            with open(path, "w") as f:
                f.write(args.get("content", ""))
            if verbose:
                print(f"  [tool] write_file({args.get('path')}) → {len(args.get('content',''))} chars written", file=sys.stderr)
            return json.dumps({"ok": True, "path": args.get("path")})

        elif name == "list_dir":
            rel = args.get("path", ".")
            path = _safe_path(root, rel)
            if not path:
                return json.dumps({"error": "Path traversal rejected"})
            if not os.path.isdir(path):
                return json.dumps({"error": f"Not a directory: {rel}"})
            entries = sorted(os.listdir(path))
            if verbose:
                print(f"  [tool] list_dir({rel}) → {len(entries)} entries", file=sys.stderr)
            return json.dumps(entries)

        elif name == "bash":
            command = args.get("command", "").strip()
            try:
                argv = shlex.split(command)
            except ValueError as e:
                return json.dumps({"error": f"Invalid command syntax: {e}"})
            if not argv:
                return json.dumps({"error": "Empty command"})
            if argv[0] not in BASH_ALLOWLIST:
                return json.dumps({"error": f"Command '{argv[0]}' not in allowlist. Allowed: {', '.join(sorted(BASH_ALLOWLIST))}"})

            # AC1 — minimal env: strip all inherited secrets; HOME points to worktree root
            safe_env = {k: os.environ.get(k, "") for k in SAFE_ENV_KEYS if os.environ.get(k)}
            safe_env["HOME"] = root
            if verbose:
                print(f"  [bash] env keys: {' '.join(sorted(safe_env.keys()))}", file=sys.stderr)

            result = subprocess.run(argv, cwd=root, capture_output=True, text=True, timeout=30, env=safe_env)
            output = (result.stdout + result.stderr).strip()

            # AC2 — redact credential patterns before returning to model
            for pattern in REDACT_PATTERNS:
                output = pattern.sub("[REDACTED]", output)

            # AC3 — warn if output references absolute paths outside worktree
            real_root = os.path.realpath(root)
            path_warning = ""
            for word in output.split():
                if word.startswith("/") and os.path.exists(word):
                    if not os.path.realpath(word).startswith(real_root):
                        path_warning = "\n[WARNING: output references path outside worktree]"
                        break

            if verbose:
                print(f"  [tool] bash({command!r}) → exit {result.returncode}, {len(output)} chars", file=sys.stderr)
            return (output if output else f"(exit {result.returncode})") + path_warning

        else:
            return json.dumps({"error": f"Unknown tool: {name}"})

    except Exception as e:
        return json.dumps({"error": str(e)})


class WorktreeManager:
    def __init__(self, path=WORKTREE_DIR):
        self.path = path
        if not os.path.exists(self.path):
            os.makedirs(self.path)

    def create(self, branch_name):
        """Creates a git worktree for the given branch."""
        target_path = os.path.join(self.path, branch_name)
        if os.path.exists(target_path):
            return target_path, "EXISTS"

        try:
            result = subprocess.run(["git", "rev-parse", "--verify", branch_name], capture_output=True)
            if result.returncode == 0:
                subprocess.run(["git", "worktree", "add", target_path, branch_name], check=True)
            else:
                subprocess.run(["git", "worktree", "add", "-b", branch_name, target_path], check=True)
            return target_path, "CREATED"
        except subprocess.CalledProcessError as e:
            print(f"Worktree Error: {e}", file=sys.stderr)
            return None, "ERROR"


class StandaloneCloudAgent:
    def __init__(self):
        self.api_key = os.environ.get("OLLAMA_API_KEY")
        self.load_config()
        self.wt_manager = WorktreeManager()
        self.role = "cloud_agent"
        self.model = "unknown"
        self.worktree = None

    def load_config(self):
        try:
            with open(CONFIG_PATH, "r") as f:
                self.config = json.load(f)
        except (FileNotFoundError, json.JSONDecodeError) as e:
            print(f"WARNING: Could not load models.json: {e}", file=sys.stderr)
            self.config = {"cloud_models": []}

        self.role_defaults = {
            "thinker":    "deepseek-v3.1:671b-cloud",
            "coder":      "devstral-2:123b-cloud",
            "vision":     "qwen3-vl:235b-cloud",
            "researcher": "deepseek-v3.1:671b-cloud",
            "architect":  "nemotron-3-super:cloud",
            "fast":       "gpt-oss:20b-cloud",
            "gemini":     "gemini-3-flash-preview:cloud",
            "large":      "mistral-large-3:675b-cloud",
        }

        try:
            import urllib.request
            with urllib.request.urlopen("http://localhost:5001/api/registry/personas", timeout=1) as response:
                if response.status == 200:
                    personas = json.loads(response.read().decode())
                    for p in personas:
                        alias = p.get('alias')
                        if alias:
                            self.role_defaults[alias] = p.get('defaultModel', self.role_defaults.get(alias))
                        role = p.get('role')
                        if role:
                            self.role_defaults[role] = p.get('defaultModel', self.role_defaults.get(role))
        except Exception:
            pass

    def get_client_for_model(self, model_name):
        if MODEL_SUFFIX_CLOUD in model_name:
            if not self.api_key:
                print("WARNING: OLLAMA_API_KEY not set — cloud request will be rejected (401)", file=sys.stderr)
            headers = {"Authorization": f"Bearer {self.api_key}"} if self.api_key else {}
            return OllamaClient(host=OLLAMA_CLOUD_URL, headers=headers), "CLOUD"
        if model_name in DELL_MODELS:
            return OllamaClient(host=DELL_SERVER_URL), "DELL_SERVER"
        return OllamaClient(host=OLLAMA_LOCAL_URL), "LOCAL"

    def log_performance(self, model_name, tier, duration, tokens, prompt_len):
        log_entry = {
            "timestamp": datetime.now().isoformat(),
            "model": model_name,
            "tier": tier,
            "duration_sec": round(duration, 3),
            "tokens": tokens,
            "tokens_per_sec": round(tokens / duration, 2) if duration > 0 else 0,
            "prompt_len": prompt_len
        }
        logs = []
        if os.path.exists(LOG_PATH):
            try:
                with open(LOG_PATH, "r") as f:
                    logs = json.load(f)
            except (json.JSONDecodeError, OSError):
                logs = []
        logs.append(log_entry)
        with open(LOG_PATH, "w") as f:
            json.dump(logs, f, indent=2)

    def log_event(self, event_type: str, content: str, metadata: dict | None = None) -> None:
        db_path = os.path.join(os.path.dirname(__file__), '..', 'copernicus', 'copernicus.db')
        db_path = os.path.normpath(db_path)
        if not os.path.exists(db_path):
            return

        def _write():
            try:
                conn = sqlite3.connect(db_path, timeout=5)
                conn.execute(
                    "INSERT INTO events (type, content, metadata, agent_id) VALUES (?, ?, ?, ?)",
                    (event_type, content, json.dumps(metadata or {}), getattr(self, 'role', 'cloud_agent'))
                )
                conn.commit()
                conn.close()
            except Exception:
                pass

        threading.Thread(target=_write, daemon=True).start()

    def run(self, model_or_role: str, prompt: str, worktree_branch: str | None = None,
            stream: bool = True, use_tools: bool = True, verbose: bool = False):
        model_name = self.role_defaults.get(model_or_role, model_or_role)
        self.model = model_name
        self.role = model_or_role
        self.worktree = worktree_branch
        client, tier = self.get_client_for_model(model_name)
        api_model_name = (model_name or model_or_role).removesuffix(MODEL_SUFFIX_CLOUD)

        # Resolve working root — worktree path if provided, else repo root
        work_root = os.path.dirname(BASE_DIR)  # repo root
        if worktree_branch:
            path, _ = self.wt_manager.create(worktree_branch)
            if path:
                work_root = path
                prompt = (
                    f"You are working in a git worktree at {path} (branch: {worktree_branch}).\n"
                    f"Use your file tools to read, write, and inspect the repo. "
                    f"All file paths are relative to {path}.\n\n"
                    f"{prompt}"
                )
                print(f"\n>>> [Cloud Agent: {model_name} (Tier: {tier}) | Worktree: {worktree_branch}] <<<\n", file=sys.stderr)
            else:
                print(f"\n>>> [Cloud Agent: {model_name} (Tier: {tier}) | Worktree FAILED] <<<\n", file=sys.stderr)
        else:
            print(f"\n>>> [Cloud Agent: {model_name} (Tier: {tier})] <<<\n", file=sys.stderr)

        # One-shot mode (--no-tools)
        if not use_tools:
            return self._run_oneshot(client, api_model_name, model_name, tier, prompt, stream)

        # Agentic tool-calling loop
        return self._run_tool_loop(client, api_model_name, model_name, tier, prompt, work_root, stream, verbose)

    def _run_oneshot(self, client, api_model_name, model_name, tier, prompt, stream):
        """Original one-shot behaviour, preserved for --no-tools."""
        max_retries = 3
        delays = [5, 15, 45]
        for attempt in range(max_retries + 1):
            try:
                start_time = time.time()
                response = client.chat(
                    model=api_model_name,
                    messages=[{'role': 'user', 'content': prompt}],
                    stream=stream
                )
                token_count = 0
                full_text = ""
                SHOULDER_TAP_TOKEN = "[[SIGNAL_ORCHESTRATOR]]"
                shoulder_tap_detected = False
                chunks = response if stream else [response]
                for chunk in chunks:
                    msg = getattr(chunk, 'message', None)
                    content = getattr(msg, 'content', None) or getattr(msg, 'thinking', None) or ''
                    sys.stdout.write(content)
                    sys.stdout.flush()
                    full_text += content
                    token_count += 1
                    if SHOULDER_TAP_TOKEN in full_text and not shoulder_tap_detected:
                        shoulder_tap_detected = True
                        self.log_event('SIGNAL_ORCHESTRATOR',
                            f'Agent {self.role} requested orchestrator intervention',
                            {'model': self.model, 'role': self.role, 'worktree': self.worktree})
                        print("\n\n⚠️  [SHOULDER TAP DETECTED] Agent is requesting Orchestrator intervention...\n", file=sys.stderr)
                sys.stdout.write("\n")
                self.log_performance(model_name, tier, time.time() - start_time, token_count, len(prompt))
                if shoulder_tap_detected:
                    print("\n🔔 ACTION REQUIRED: Sub-agent reached a decision point. Handing over to Orchestrator.\n", file=sys.stderr)
                return full_text
            except Exception as e:
                status_code = getattr(e, 'status_code', None)
                if status_code in (429, 500, 503) and attempt < max_retries:
                    print(f"\n[Retry {attempt+1}/{max_retries}] {model_name} returned {status_code}. Retrying in {delays[attempt]}s...", file=sys.stderr)
                    time.sleep(delays[attempt])
                    continue
                print(f"\nError calling {model_name} on {tier}: {e}", file=sys.stderr)
                if attempt >= max_retries:
                    print(f"CRITICAL: All {max_retries} retries exhausted.", file=sys.stderr)
                    sys.exit(1)
                return None

    def _run_tool_loop(self, client, api_model_name, model_name, tier, prompt, work_root, stream, verbose):
        """Agentic tool-calling loop — up to 25 turns."""
        messages = [{'role': 'user', 'content': prompt}]
        MAX_TURNS = 25
        start_time = time.time()
        total_tokens = 0

        for turn in range(MAX_TURNS):
            try:
                response = client.chat(
                    model=api_model_name,
                    messages=messages,
                    tools=TOOLS,
                    stream=False
                )
            except Exception as e:
                status_code = getattr(e, 'status_code', None)
                if status_code in (429, 500, 503):
                    print(f"\n[Tool loop] Rate limit on turn {turn+1}. Waiting 15s...", file=sys.stderr)
                    time.sleep(15)
                    continue
                print(f"\nError on turn {turn+1}: {e}", file=sys.stderr)
                break

            msg = response.message
            total_tokens += 1

            # Append assistant message (content may be empty if only tool_calls)
            assistant_entry: dict = {'role': 'assistant', 'content': msg.content or ''}
            if msg.tool_calls:
                assistant_entry['tool_calls'] = [
                    {
                        'id': getattr(tc, 'id', f'call_{i}'),
                        'type': 'function',
                        'function': {
                            'name': tc.function.name,
                            'arguments': (json.loads(tc.function.arguments)
                                          if isinstance(tc.function.arguments, str)
                                          else tc.function.arguments) or {}
                        }
                    }
                    for i, tc in enumerate(msg.tool_calls)
                ]
            messages.append(assistant_entry)

            # No tool calls → model is done
            if not msg.tool_calls:
                final = msg.content or ''
                if stream:
                    # Stream the final answer token-by-token (simulate — already have full text)
                    sys.stdout.write(final)
                    sys.stdout.flush()
                else:
                    sys.stdout.write(final)
                sys.stdout.write("\n")
                self.log_performance(model_name, tier, time.time() - start_time, total_tokens, len(prompt))
                return final

            # Execute each tool call
            if verbose:
                print(f"\n  [turn {turn+1}] {len(msg.tool_calls)} tool call(s)", file=sys.stderr)

            for tc in msg.tool_calls:
                fn_name = tc.function.name
                fn_args = tc.function.arguments
                if isinstance(fn_args, str):
                    try:
                        fn_args = json.loads(fn_args)
                    except json.JSONDecodeError:
                        fn_args = {}

                result = execute_tool(fn_name, fn_args, work_root, verbose=verbose)
                messages.append({'role': 'tool', 'content': result})

        # Hit max turns
        print(f"\n⚠️  [Cloud Agent] Max turns ({MAX_TURNS}) reached. Returning last content.", file=sys.stderr)
        last_content = next((m['content'] for m in reversed(messages) if m['role'] == 'assistant' and m.get('content')), '')
        self.log_performance(model_name, tier, time.time() - start_time, total_tokens, len(prompt))
        return last_content


def main():
    parser = argparse.ArgumentParser(description="Standalone Cloud Agent CLI (V2.4)")
    parser.add_argument("target", help="Model name or Role")
    parser.add_argument("prompt", help="The prompt for the agent")
    parser.add_argument("--worktree", help="Create/use a git worktree with this branch name")
    parser.add_argument("--no-stream", action="store_false", dest="stream", help="Disable streaming output")
    parser.add_argument("--no-tools", action="store_false", dest="use_tools", help="Disable tool calling (one-shot mode)")
    parser.add_argument("--verbose", action="store_true", help="Log tool calls and results to stderr")
    parser.add_argument("--list", action="store_true", help="List available models")

    args = parser.parse_args()
    agent = StandaloneCloudAgent()

    if args.list:
        print(json.dumps(agent.config, indent=2))
        return

    agent.run(args.target, args.prompt,
              worktree_branch=args.worktree,
              stream=args.stream,
              use_tools=args.use_tools,
              verbose=args.verbose)


if __name__ == "__main__":
    main()
