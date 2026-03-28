#!/usr/bin/env python3
"""
COPERNICUS Agent Gateway

A multi-provider, role-aware orchestrator for cloud and local AI agents.
Routes requests based on agent role (e.g., thinker, coder, architect, researcher, fast)
to appropriate providers/models, leveraging the proven StandaloneCloudAgent engine.

Enables context continuity via AC-2 "Context Handoff" (Ledger-backed RAG chunks).
"""

import sys
import sqlite3
import argparse
import time
import json
from pathlib import Path

# Add project root to path for dev_orchestrator imports
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

# cloud_agent removed — gateway dispatch routes through scripts/dispatch_claude_ollama.sh (story 600)
import utils.quality_scorer as quality_scorer

# Path to the Copernicus DB
DB_PATH = (PROJECT_ROOT / "copernicus" / "copernicus.db").resolve()

# Path to the sqlite-vec extension (Darwin ARM64)
EXTENSION_PATH = (PROJECT_ROOT / "copernicus" / "node_modules" / "sqlite-vec-darwin-arm64" / "vec0.dylib").resolve()

def get_db_connection():
    if not DB_PATH.exists():
        return None
    
    conn = sqlite3.connect(str(DB_PATH))
    if EXTENSION_PATH.exists():
        conn.enable_load_extension(True)
        conn.load_extension(str(EXTENSION_PATH))
    return conn

def get_handoff_context(context_id=None):
    """
    AC-2: Pull 'Top 5 most relevant RAG chunks' from the ledger.
    If context_id (e.g. story ID) is provided, it targets that session's last search context.
    """
    conn = get_db_connection()
    if not conn:
        return ""
    
    try:
        cursor = conn.cursor()
        # AC-2 Implementation: Pulling recent chunks as continuity context from jules_sessions
        if context_id:
            query = """
                SELECT last_search_context FROM jules_sessions 
                WHERE (id = ? OR story_id = ?) AND last_search_context IS NOT NULL 
                ORDER BY started_at DESC LIMIT 1
            """
            cursor.execute(query, (context_id, context_id))
        else:
            query = "SELECT last_search_context FROM jules_sessions WHERE last_search_context IS NOT NULL ORDER BY started_at DESC LIMIT 1"
            cursor.execute(query)
            
        row = cursor.fetchone()
        if row and row[0]:
            return f"\n[HANDOFF CONTEXT]\nPrior relevant chunks:\n{row[0]}\n"
        
        # Fallback to codebase_vec if no session context found
        query = """
            SELECT file_path, line_start, line_end, symbols, content 
            FROM codebase_vec 
            ORDER BY chunk_id DESC 
            LIMIT ?
        """
        cursor.execute(query, (5,))
        rows = cursor.fetchall()
        
        if not rows:
            return ""
            
        context = "\n[HANDOFF CONTEXT]\n"
        for r in rows:
            context += f"--- FILE: {r[0]} (Lines {r[1]}-{r[2]}) ---\nSymbols: {r[3]}\n{r[4]}\n\n"
        return context
    except Exception as e:
        return f"Handoff retrieval error: {e}"
    finally:
        conn.close()

def load_prompt_from_history(history_path: str) -> str:
    """
    Load the new_message content from a JSON history file.
    Falls back to sys.argv[1] (prompt positional arg) if not found.
    """
    try:
        with open(history_path, 'r') as f:
            payload = json.load(f)
            return payload.get('new_message', {}).get('content', '')
    except Exception:
        return ""

def main():
    parser = argparse.ArgumentParser(description="COPERNICUS Agent Gateway")
    parser.add_argument("--role", "-r", default="coder", help="Agent role (thinker, coder, architect, researcher, fast)")
    parser.add_argument("--context-id", help="Story ID or Session UUID for targeted context")
    parser.add_argument("--worktree", help="Optional: Branch name for isolated worktree execution")
    parser.add_argument("--no-stream", action="store_false", dest="stream", help="Disable streaming output")
    parser.add_argument("--mode", choices=["fast", "deep"], default="fast", help="Mode for codebase search (fast or deep)")
    parser.add_argument("--auto-select", action="store_true", help="Auto-select the best model for the role using QS")
    parser.add_argument("--history", help="Path to JSON history file containing 'new_message' content")
    parser.add_argument("prompt", nargs="?", default="", help="The user prompt or task (fallback if --history missing)")

    args = parser.parse_args()
    
    # Resolve prompt: prefer payload from history JSON
    if args.history:
        prompt = load_prompt_from_history(args.history)
        if prompt:
            args.prompt = prompt
        else:
            # Fall back to positional arg if history does not contain new_message
            prompt = args.prompt
    else:
        prompt = args.prompt

    if not prompt:
        print("Error: Prompt must be provided either as positional argument or in --history JSON.", file=sys.stderr)
        sys.exit(1)
    
    # 1. Fetch Handoff Context
    handoff = get_handoff_context(args.context_id)
    mode_instruction = f"Search Mode Override: When searching the codebase, you MUST use the '{args.mode}' mode.\n"
    full_prompt = f"{handoff}\n\n{mode_instruction}User Request: {prompt}"
    
    # 2. Resolve target role/model
    target_role_or_model = args.role
    if args.auto_select:
        best_model = quality_scorer.get_best_model(args.role)
        if best_model:
            print(f"--- [AGENT GATEWAY] Auto-selected model: {best_model} for role: {args.role} ---", file=sys.stderr)
            target_role_or_model = best_model
        else:
            print(f"--- [AGENT GATEWAY] Auto-select enabled but no history found for role: {args.role}. Falling back to default. ---", file=sys.stderr)

    # cloud_agent.py removed — use scripts/dispatch_claude_ollama.sh (story 600)
    print("Error: agent_gateway.py requires cloud_agent engine which has been removed. Use scripts/dispatch_claude_ollama.sh instead.", file=sys.stderr)
    sys.exit(1)

    # 4. Route and Execute (unreachable until story 600 wires new engine)
    print(f"--- [AGENT GATEWAY] Routing Role: {args.role} (Actual Model: {target_role_or_model}) ---", file=sys.stderr)

    start_time = time.time()
    result = None
    duration_ms = int((time.time() - start_time) * 1000)

    # 5. Log Quality Metrics
    if result is not None:
        tokens_used = len(result) // 4  # rough estimate
        tokens_per_sec = tokens_used / (duration_ms / 1000.0) if duration_ms > 0 else 0

        # We simulate scoring for the MVP; in production, this would be derived from real usage
        metrics = {
            "model_id": target_role_or_model,
            "provider": "ollama", # placeholder
            "task_type": args.role,
            "duration_ms": duration_ms,
            "tokens_used": tokens_used,
            "tokens_per_sec": tokens_per_sec,
            "cost_usd": tokens_used * 0.00001,
            "speed_score": min(1.0, tokens_per_sec / 200.0),
            "cost_score": 1.0,
            "accuracy_score": 0.9,
            "adherence_score": 0.95,
            "verification_passed": 1,
            "worktree_branch": args.worktree
        }
        quality_scorer.log_task(metrics)

if __name__ == "__main__":
    main()
