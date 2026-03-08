#!/usr/bin/env python3
import logging
logger = logging.getLogger(__name__)
"""
Claude Ollama CLI Bridge

This script serves as a lightweight CLI for interacting with local Ollama models.
It routes commands to specific personas (e.g., /architect, /senior-dev) and injects
repository context (git status, file list) into the prompt.

Usage:
    python3 scripts/claude_ollama_cli.py "/architect Review the architecture"
    or
    python3 scripts/claude_ollama_cli.py /architect Review the architecture
"""

import sys
import subprocess
import re
import sqlite3
import os

DB_PATH = "copernicus/copernicus.db"

def get_semantic_context(query, top_k=5):
    """Retrieves semantic context from the local codebase index if available."""
    if not os.path.exists(DB_PATH):
        return ""
    
    # Path to the sqlite-vec extension (Darwin ARM64)
    extension_path = os.path.join(os.getcwd(), "copernicus/node_modules/sqlite-vec-darwin-arm64/vec0.dylib")
    
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        
        # Load the vector extension if it exists
        if os.path.exists(extension_path):
            conn.enable_load_extension(True)
            conn.load_extension(extension_path)
        
        cursor = conn.cursor()
        cursor.execute("SELECT file_path, content FROM codebase_vec WHERE content LIKE ? LIMIT ?", (f'%{query}%', top_k))
        rows = cursor.fetchall()
        
        if not rows:
            return ""
            
        context = "Relevant Code Snippets (Local Index):\n"
        for r in rows:
            context += f"--- FILE: {r[0]} ---\n{r[1]}\n\n"
        return context
    except Exception as e:
        return f"Index search error: {e}"
    finally:
        if conn: conn.close()

def get_git_context():
    """Retrieves basic git context (status and file list)."""
    try:
        # Get git status
        status = subprocess.check_output(
            ["git", "status", "--short"], text=True
        ).strip()
        if not status:
            status = "Clean working directory"

        # Get file list (limit to top 50 files to avoid context overflow)
        # Using git ls-files to get tracked files
        try:
            files_output = subprocess.check_output(
                ["git", "ls-files"], text=True
            ).strip()
            files = files_output.split("\n") if files_output else []
        except subprocess.CalledProcessError:
            files = []

        file_list_str = "\n".join(files[:50])
        if len(files) > 50:
            file_list_str += f"\n... (and {len(files) - 50} more files)"

        return f"Git Status:\n{status}\n\nFile List:\n{file_list_str}"
    except subprocess.CalledProcessError:
        return "Not a git repository."


def parse_input(input_text):
    """Parses the input text to extract persona and prompt."""
    # Match /persona followed by space or end of string
    match = re.match(r"^/([\w-]+)(?:\s+(.*))?$", input_text, re.DOTALL)
    if match:
        persona = match.group(1)
        prompt = match.group(2) if match.group(2) else ""
        return persona, prompt
    else:
        # Default persona if none specified
        return "senior-dev", input_text


def main():
    if len(sys.argv) < 2:
        print('Usage: python3 scripts/claude_ollama_cli.py "/persona prompt"')
        sys.exit(1)

    # Join all arguments to support unquoted input
    input_text = " ".join(sys.argv[1:])

    persona, user_prompt = parse_input(input_text)

    # Attempt to resolve persona to its default model via Registry API (Story 226 AC-5)
    model_to_run = persona
    try:
        import urllib.request
        import json
        with urllib.request.urlopen(f"http://localhost:5001/api/registry/personas/{persona}", timeout=1) as response:
            if response.status == 200:
                p_data = json.loads(response.read().decode())
                model_to_run = p_data.get('defaultModel', persona)
    except Exception:
        logger.error("Unexpected error", exc_info=True) # FALLBACK — registry unreachable, use persona alias as model name

    if not user_prompt.strip():
        # Interactive mode or just empty prompt?
        # For now, just warn
        print(f"Warning: No prompt provided for persona '{persona}'.")

    context = get_git_context()
    semantic = get_semantic_context(user_prompt)
    full_prompt = f"Context:\n{context}\n\n{semantic}\n\nTask:\n{user_prompt}"

    print(f"--- Routing to Persona: {persona} (Model: {model_to_run}) ---")

    try:
        # Check if ollama is installed
        subprocess.check_call(
            ["ollama", "--version"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )

        # Execute ollama run with the resolved model and prompt
        subprocess.run(["ollama", "run", model_to_run, full_prompt], check=True)

    except FileNotFoundError:
        print(
            "Error: 'ollama' command not found. Please ensure Ollama is installed and in your PATH."
        )
        sys.exit(1)
    except subprocess.CalledProcessError as e:
        print(f"Error executing model: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
