import sys
import json
import argparse
import time
import os
import subprocess
import sqlite3
import threading
from datetime import datetime
from ollama import Client as OllamaClient

# Standalone Cloud Agent System (V2.3.1)
# Development-only tool for orchestration via an active Orchestrator.
# Routes :cloud models directly to Ollama's Cloud API.

OLLAMA_CLOUD_URL = "https://ollama.com"
OLLAMA_LOCAL_URL = "http://localhost:11434"
DELL_SERVER_URL = "http://192.168.1.185:11434"

BASE_DIR = os.path.dirname(__file__)
CONFIG_PATH = os.path.join(BASE_DIR, "models.json")
LOG_PATH = os.path.join(BASE_DIR, "performance_log.json")
WORKTREE_DIR = os.path.join(BASE_DIR, "worktrees")

# Models explicitly hosted on the Dell Server (Mission-Specific)
DELL_MODELS = [
    "moondream:latest", "junior-dev:latest", "gemma3:4b", 
    "phi3:mini", "qwen2.5:3b", "qwen2.5-coder:1.5b",
    "glm-ocr:latest", "ministral:3b", "lfm2.5-thinking:1.2b",
    "smollm2:1.7b", "smollm2:135m", "qwen3-embedding:0.6b",
    "bge-m3:latest", "embeddinggemma:latest", "nomic-embed-text:latest"
]

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
            # Check if branch exists
            result = subprocess.run(["git", "rev-parse", "--verify", branch_name], capture_output=True)
            if result.returncode == 0:
                # Branch exists, just add worktree
                subprocess.run(["git", "worktree", "add", target_path, branch_name], check=True)
            else:
                # Create new branch and worktree
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
        # Default role mappings
        self.role_defaults = {
            "thinker":    "kimi-k2.5:cloud",
            "coder":      "qwen3-coder-next:cloud",
            "vision":     "qwen3-vl:235b:cloud",
            "researcher": "deepseek-v3.1:671b:cloud",
            "architect":  "glm-5:cloud",
            "fast":       "gpt-oss:20b:cloud",
        }

    def get_client_for_model(self, model_name):
        if ":cloud" in model_name:
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
                logs = []  # reset corrupted log
        logs.append(log_entry)
        with open(LOG_PATH, "w") as f:
            json.dump(logs, f, indent=2)

    def log_event(self, event_type: str, content: str, metadata: dict | None = None) -> None:
        """Write an event to the centralized comms bus (events table in copernicus.db)."""
        db_path = os.path.join(os.path.dirname(__file__), '..', 'copernicus', 'copernicus.db')
        db_path = os.path.normpath(db_path)
        if not os.path.exists(db_path):
            return  # DB not initialized yet — non-fatal
        
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
                pass  # Non-fatal — don't block streaming

        threading.Thread(target=_write, daemon=True).start()

    def run(self, model_or_role: str, prompt: str, worktree_branch: str | None = None, stream: bool = True):
        model_name = self.role_defaults.get(model_or_role, model_or_role)
        self.model = model_name
        self.role = model_or_role
        self.worktree = worktree_branch
        client, tier = self.get_client_for_model(model_name)
        # Strip internal routing suffix before sending to API
        api_model_name = (model_name or model_or_role).removesuffix(":cloud")
        
        wt_context = ""
        if worktree_branch:
            path, status = self.wt_manager.create(worktree_branch)
            if path:
                wt_context = f"\n[Worktree: {worktree_branch} at {path}]\n"
                prompt = f"NOTE: You are working in a git worktree at {path}. All proposed file changes must be based on this root.\n\n{prompt}"
            
        print(f"\n>>> [Cloud Agent: {model_name} (Tier: {tier})] <<<\n{wt_context}", file=sys.stderr)
        
        start_time = time.time()
        token_count = 0
        shoulder_tap_detected = False
        SHOULDER_TAP_TOKEN = "[[SIGNAL_ORCHESTRATOR]]"
        
        try:
            response = client.chat(
                model=api_model_name,
                messages=[{'role': 'user', 'content': prompt}],
                stream=stream
            )
            
            full_text = ""
            # Handle both streaming (Iterator[ChatResponse]) and non-streaming (ChatResponse)
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
                    self.log_event(
                        event_type='SIGNAL_ORCHESTRATOR',
                        content=f'Agent {getattr(self, "role", "unknown")} requested orchestrator intervention',
                        metadata={
                            'model': getattr(self, 'model', 'unknown'),
                            'role': getattr(self, 'role', 'unknown'),
                            'worktree': getattr(self, 'worktree', None),
                        }
                    )
                    print("\n\n⚠️  [SHOULDER TAP DETECTED] Agent is requesting Orchestrator intervention...\n", file=sys.stderr)
            
            sys.stdout.write("\n")
            duration = time.time() - start_time
            self.log_performance(model_name, tier, duration, token_count, len(prompt))
            
            if shoulder_tap_detected:
                print("\n🔔 ACTION REQUIRED: The sub-agent has reached a decision point or boundary. Handing over to an active Orchestrator.\n", file=sys.stderr)
            
            return full_text
        except Exception as e:
            print(f"\nError calling {model_name} on {tier}: {e}", file=sys.stderr)
            return None

def main():
    parser = argparse.ArgumentParser(description="Standalone Cloud Agent CLI (V2.3)")
    parser.add_argument("target", help="Model name or Role")
    parser.add_argument("prompt", help="The prompt for the agent")
    parser.add_argument("--worktree", help="Optional: Create/use a git worktree with this branch name")
    parser.add_argument("--no-stream", action="store_false", dest="stream", help="Disable streaming output")
    parser.add_argument("--list", action="store_true", help="List available models")
    
    args = parser.parse_args()
    agent = StandaloneCloudAgent()
    
    if args.list:
        print(json.dumps(agent.config, indent=2))
        return

    agent.run(args.target, args.prompt, worktree_branch=args.worktree, stream=args.stream)

if __name__ == "__main__":
    main()
