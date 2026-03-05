#!/usr/bin/env python3
"""
Agent Git Worktree Harness - COPERNICUS
Harnesses background agents in isolated Git worktrees to prevent code collisions.
"""

import sys
import os
import subprocess
import json
import sqlite3
import shutil
import uuid
from datetime import datetime

DB_PATH = os.path.expanduser("~/Library/Application Support/copernicus/copernicus.db")

def log_event(event_type, content, metadata=None):
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

def run_git(args, cwd=None):
    res = subprocess.run(["git"] + args, cwd=cwd, capture_output=True, text=True)
    if res.returncode != 0:
        print(f"Git Error: {' '.join(args)}\n{res.stderr}")
    return res

def main():
    if len(sys.argv) < 3:
        print("Usage: python3 scripts/agent_harness.py <agent_persona> <task_description>")
        sys.exit(1)

    persona = sys.argv[1]
    task_desc = sys.argv[2]
    task_id = str(uuid.uuid4())[:8]
    branch_name = f"agent/{persona}-{task_id}"
    worktree_path = os.path.abspath(f"../temp-{persona}-{task_id}")

    print(f"--- 🛠 Harnessing {persona.upper()} in Worktree ---")
    print(f"Branch: {branch_name}")
    print(f"Path:   {worktree_path}")

    # 1. Create the worktree
    res = run_git(["worktree", "add", worktree_path, "-b", branch_name])
    if res.returncode != 0:
        log_event("HARNESS_ERROR", f"Failed to create worktree for {persona}", {"error": res.stderr})
        sys.exit(1)

    try:
        # 2. Execute the agent via shim inside the worktree
        # We pass the full path to the shim since we're in a sibling directory
        shim_path = os.path.abspath("scripts/ollama_tool_shim.py")
        cmd = ["python3", shim_path, f"/{persona} {task_desc}"]
        
        print(f"🚀 Dispatching agent...")
        log_event("AGENT_HARNESSED", f"Dispatched {persona} in isolated worktree", {"branch": branch_name, "path": worktree_path})
        
        # We use Popen so we can potentially monitor output or run in background
        proc = subprocess.Popen(cmd, cwd=worktree_path, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
        
        for line in proc.stdout:
            print(f"[{persona.upper()}] {line.strip()}")
            # If the agent signals completion, we detect it in the stream
            if "SIGNALED COMPLETION" in line:
                print(f"\n✅ TASK DETECTED AS COMPLETE")

        proc.wait()

        # 3. Commit the work in the worktree
        run_git(["add", "."], cwd=worktree_path)
        run_git(["commit", "-m", f"Agent {persona} completed task: {task_desc}"], cwd=worktree_path)

        # 4. Integrate back to main
        print(f"🔄 Integrating changes to main...")
        current_repo_path = os.getcwd()
        
        # Merge the agent branch into current HEAD
        res = run_git(["merge", branch_name], cwd=current_repo_path)
        
        if res.returncode == 0:
            print(f"✅ INTEGRATION SUCCESSFUL")
            log_event("HARNESS_MERGE_SUCCESS", f"Merged {branch_name} into main", {"persona": persona})
        else:
            print(f"⚠️ CONFLICTS DETECTED. Changes remain on branch {branch_name}")
            log_event("HARNESS_MERGE_CONFLICT", f"Conflicts merging {branch_name}", {"error": res.stderr})

    finally:
        # 5. Cleanup
        print(f"🧹 Cleaning up worktree...")
        run_git(["worktree", "remove", worktree_path, "--force"])
        if os.path.exists(worktree_path):
            shutil.rmtree(worktree_path, ignore_errors=True)

if __name__ == "__main__":
    main()
