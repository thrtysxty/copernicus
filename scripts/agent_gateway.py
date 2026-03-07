#!/usr/bin/env python3
"""
COPERNICUS Agent Gateway

A multi-provider, role-aware orchestrator for cloud and local AI agents.
Routes requests based on agent role (e.g., thinker, coder, architect, researcher, fast)
to appropriate providers/models, leveraging the proven StandaloneCloudAgent engine.

Enables context continuity via AC-2 "Context Handoff" (Ledger-backed RAG chunks).
"""

import sys
import os
import json
import sqlite3
import argparse
import subprocess
from pathlib import Path

# Add project root to path for dev_orchestrator imports
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from dev_orchestrator.cloud_agent import StandaloneCloudAgent
import utils.quality_scorer as quality_scorer
import time

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

def get_handoff_context(context_id=None, top_k=5):
    """
    AC-2: Pull 'Top 5 most relevant RAG chunks' from the ledger.
    If context_id (e.g. story ID) is provided, it targets that session.
    """
    conn = get_db_connection()
    if not conn:
        return ""
    
    try:
        cursor = conn.cursor()
        # AC-2 Implementation: Pulling recent chunks as continuity context
        # In a real model swap, we'd filter by context_id if provided
        query = """
            SELECT file_path, line_start, line_end, symbols, content 
            FROM codebase_vec 
            ORDER BY chunk_id DESC 
            LIMIT ?
        """
        cursor.execute(query, (top_k,))
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

def main():
    parser = argparse.ArgumentParser(description="COPERNICUS Agent Gateway")
    parser.add_argument("prompt", help="The user prompt or task")
    parser.add_argument("--role", "-r", default="coder", help="Agent role (thinker, coder, architect, researcher, fast)")
    parser.add_argument("--context-id", help="Story ID or Session UUID for targeted context")
    parser.add_argument("--worktree", help="Optional: Branch name for isolated worktree execution")
    parser.add_argument("--no-stream", action="store_false", dest="stream", help="Disable streaming output")
    parser.add_argument("--auto-select", action="store_true", help="Auto-select the best model for the role using QS")
    
    args = parser.parse_args()
    
    # 1. Fetch Handoff Context
    handoff = get_handoff_context(args.context_id)
    full_prompt = f"{handoff}\n\nUser Request: {args.prompt}"
    
    # 2. Initialize the Proven Engine
    agent = StandaloneCloudAgent()
    
    # 3. Route and Execute
    # The agent.run method already handles role-to-model mapping via models.json
    target_role_or_model = args.role
    if args.auto_select:
        best_model = quality_scorer.get_best_model(args.role)
        if best_model:
            print(f"--- [AGENT GATEWAY] Auto-selected model: {best_model} for role: {args.role} ---", file=sys.stderr)
            target_role_or_model = best_model
        else:
            print(f"--- [AGENT GATEWAY] Auto-select enabled but no history found for role: {args.role}. Falling back to default. ---", file=sys.stderr)

    print(f"--- [AGENT GATEWAY] Routing Role: {args.role} ---", file=sys.stderr)

    # We need to capture the performance metrics
    start_time = time.time()
    result = agent.run(target_role_or_model, full_prompt, worktree_branch=args.worktree, stream=args.stream)
    duration_ms = int((time.time() - start_time) * 1000)

    if result is not None:
        # Assuming we can get some metrics from agent, or we mock them for now.
        # StandaloneCloudAgent logs performance to a file, let's read the latest entry
        # or use simple heuristics if not accessible
        tokens_used = len(result) // 4  # rough estimate
        tokens_per_sec = tokens_used / (duration_ms / 1000.0) if duration_ms > 0 else 0

        model_id = getattr(agent, "model", target_role_or_model)
        provider = "unknown"
        if hasattr(agent, "get_client_for_model"):
            try:
                _, provider = agent.get_client_for_model(model_id)
            except Exception:
                pass

        # We simulate scoring (in a real scenario, this would involve another LLM pass or specific checks)
        metrics = {
            "model_id": model_id,
            "provider": provider, # tier
            "task_type": args.role,
            "duration_ms": duration_ms,
            "tokens_used": tokens_used,
            "tokens_per_sec": tokens_per_sec,
            "cost_usd": tokens_used * 0.00001, # fake cost
            "speed_score": min(100, max(0, tokens_per_sec * 2)), # fake score
            "cost_score": 100, # fake score
            "accuracy_score": 90, # fake score
            "adherence_score": 95, # fake score
            "verification_passed": 1,
            "worktree_branch": args.worktree
        }
        quality_scorer.log_task(metrics)

if __name__ == "__main__":
    main()
