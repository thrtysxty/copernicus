#!/usr/bin/env python3
import logging
logger = logging.getLogger(__name__)
"""
Agent Git Worktree Harness for Concurrent Execution (Story 230)
Creates an isolated Git Worktree for agent tasks, manages lifecycle, and integrates results.
"""

import sys
import os
import subprocess
import sqlite3
import json
import argparse
from datetime import datetime

def get_repo_root():
    try:
        # Get the absolute path to the repository root
        return subprocess.check_output(['git', 'rev-parse', '--show-toplevel'], text=True).strip()
    except subprocess.CalledProcessError:
        logger.error("Error occurred", exc_info=True)
        sys.exit(1)

def run_git(args, cwd=None):
    return subprocess.run(['git'] + args, cwd=cwd, capture_output=True, text=True)

def main():
    parser = argparse.ArgumentParser(description="Agent Git Worktree Harness")
    parser.add_argument("task_id", help="Task ID (e.g., 123)")
    parser.add_argument("agent_name", help="Agent Name (e.g., devstral)")
    parser.add_argument("prompt", help="Prompt for the agent")
    parser.add_argument("--model", help="Optional model override")
    args = parser.parse_args()

    repo_root = get_repo_root()
    branch_name = f"agent/{args.agent_name}-{args.task_id}"
    # Create worktree in a directory adjacent to the repo root
    worktree_path = os.path.abspath(os.path.join(os.path.dirname(repo_root), f"temp-{args.task_id}"))
    db_path = os.path.join(repo_root, "copernicus", "copernicus.db")

    print(f"--- Harness: Creating worktree for {args.agent_name} (Task: {args.task_id}) ---")
    print(f"--- Branch: {branch_name} ---")
    print(f"--- Path:   {worktree_path} ---")

    # AC-1: Worktree Isolation
    res = run_git(['worktree', 'add', worktree_path, '-b', branch_name], cwd=repo_root)
    if res.returncode != 0:
        print(f"Error creating worktree: {res.stderr}")
        sys.exit(1)

    try:
        # Run ollama_tool_shim.py inside the worktree
        # The shim exists in the worktree at the same relative path
        shim_path = os.path.join(worktree_path, "scripts", "ollama_tool_shim.py")
        
        shim_prompt = args.prompt
        if args.model:
            shim_prompt = f"/model:{args.model} {args.prompt}"
        
        shim_cmd = [sys.executable, shim_path, shim_prompt]
        
        print(f"--- Harness: Executing agent in worktree ---")
        # Monitor output for completion signal
        process = subprocess.Popen(shim_cmd, cwd=worktree_path, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
        
        completion_signaled = False
        full_output = ""
        for line in process.stdout:
            print(line, end="")
            full_output += line
            if "[[signal_completion]]" in line:
                completion_signaled = True
        
        process.wait()

        # AC-2: Lifecycle
        if completion_signaled:
            print(f"\n--- Harness: Completion signaled. Committing changes... ---")
            run_git(['add', '.'], cwd=worktree_path)
            run_git(['commit', '-m', f"feat(agent): task {args.task_id} completed by {args.agent_name}"], cwd=worktree_path)
            
            # Merge main into agent branch to ensure it can be integrated cleanly
            print("--- Harness: Merging main into agent branch... ---")
            merge_res = run_git(['merge', 'main'], cwd=worktree_path)
            
            conn = sqlite3.connect(db_path)
            cursor = conn.cursor()
            
            if merge_res.returncode == 0:
                print("--- Harness: Merge success. Writing AGENT_WORK_READY event. ---")
                cursor.execute(
                    "INSERT INTO events (type, content, metadata, agent_id) VALUES (?, ?, ?, ?)",
                    ('AGENT_WORK_READY', f'Task {args.task_id} ready for integration', json.dumps({'branch': branch_name, 'worktree': worktree_path}), args.agent_name)
                )
                conn.commit()
                conn.close()
                
                # AC-3: Cleanup
                print("--- Harness: Cleaning up worktree. ---")
                run_git(['worktree', 'remove', worktree_path], cwd=repo_root)
                print("--- Harness: Worktree removed successfully. ---")
            else:
                # AC-4: Conflict Resolution Protocol
                print("--- Harness: Merge conflict detected! Writing NEEDS_MANUAL_RESOLUTION event. ---")
                cursor.execute(
                    "INSERT INTO events (type, content, metadata, agent_id) VALUES (?, ?, ?, ?)",
                    ('NEEDS_MANUAL_RESOLUTION', f'Conflict in task {args.task_id}', json.dumps({'branch': branch_name, 'worktree': worktree_path, 'conflicts': merge_res.stdout + merge_res.stderr}), args.agent_name)
                )
                conn.commit()
                conn.close()
                print(f"--- Harness: Worktree preserved at: {worktree_path} ---")
        else:
            print("\n--- Harness: Agent finished without signaling completion. ---")
            print("--- Harness: Cleaning up worktree (forced). ---")
            run_git(['worktree', 'remove', '--force', worktree_path], cwd=repo_root)

    except Exception as e:
        print(f"Error in harness: {e}")
        # Attempt cleanup on error
        if os.path.exists(worktree_path):
            run_git(['worktree', 'remove', '--force', worktree_path], cwd=repo_root)
        sys.exit(1)

if __name__ == "__main__":
    main()
