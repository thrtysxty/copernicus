#!/bin/bash
set -euo pipefail

# --- Arguments ---
PROMPT="${1:-"Please review this file."}"
FILE_PATH="${2:-}"
# Use the third argument for the model, or default to 'scribe' if it's empty or not provided.
MODEL="${3:-scribe}"
 
if ! command -v ollama &> /dev/null; then
    echo "[!] 'ollama' command not found. Please install Ollama CLI."
    echo "    See: https://ollama.com"
    exit 1
fi
 
if [ -z "$FILE_PATH" ]; then
    echo "[!] File path not provided."
    echo "Usage: make ollama-ask PROMPT=\"Your question\" FILE=\"path/to/file\" [MODEL=model_name]"
    exit 1
fi
 
# --- Context and Persona File Paths ---
PROJECT_ROOT=$(pwd)
AGENTS_MD_PATH="$PROJECT_ROOT/AGENTS.md"
CONTEXT_MD_PATH="$PROJECT_ROOT/.claude/project-context.md"
 
# --- Load Content and Context ---
FILE_CONTENT=$(cat "$FILE_PATH" 2>/dev/null || echo "File not found: $FILE_PATH")
AGENTS_MD_CONTENT=$(cat "$AGENTS_MD_PATH" 2>/dev/null || true)
CONTEXT_MD_CONTENT=$(cat "$CONTEXT_MD_PATH" 2>/dev/null || true)
 
# --- Construct the Full Prompt ---
FULL_PROMPT=""
 
# 1. Add General Project Context
[ -n "$CONTEXT_MD_CONTENT" ] && {
    FULL_PROMPT+="## Project Context\n\n$CONTEXT_MD_CONTENT\n\n---\n\n"
}
 
# 2. Add Agent Instructions
[ -n "$AGENTS_MD_CONTENT" ] && {
    FULL_PROMPT+="## Agent Instructions (AGENTS.md)\n\n$AGENTS_MD_CONTENT\n\n---\n\n"
}

# 4. Add the specific file content for the task
FULL_PROMPT+="## Task Context: File '$FILE_PATH'\n"
FULL_PROMPT+="---\n$FILE_CONTENT\n---\n\n"

# 4. Add the user's specific instruction
FULL_PROMPT+="## Task\n\n$PROMPT"
 
echo "=== Asking Ollama model '$MODEL' about '$FILE_PATH'... ==="
# The prompt is passed as the final argument to `ollama run`
ollama run "$MODEL" "$FULL_PROMPT"