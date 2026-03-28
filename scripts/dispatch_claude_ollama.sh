#!/bin/bash

# Source secrets to load OLLAMA_API_KEY
source ~/.secrets

# Set Anthropic environment variables for Ollama
export ANTHROPIC_BASE_URL=https://ollama.com
export ANTHROPIC_AUTH_TOKEN=$OLLAMA_API_KEY

# Default model
MODEL="devstral-small-2:cloud"

# Parse arguments
PROMPT_FILE=""
while (( "$#" )); do
  case "$1" in
    --model)
      if [ -n "$2" ] && [ "${2:0:1}" != "-" ]; then
        MODEL="$2"
        shift 2
      else
        echo "Error: Argument for --model is missing" >&2
        exit 1
      fi
      ;;
    -*) # unsupported flags
      echo "Error: Unsupported flag $1" >&2
      exit 1
      ;;
    *) # preserve positional arguments
      if [ -z "$PROMPT_FILE" ]; then
        PROMPT_FILE="$1"
      else
        echo "Error: Only one prompt file can be specified. Extra argument: $1" >&2
        exit 1
      fi
      shift
      ;;
  esac
done

if [ -z "$PROMPT_FILE" ]; then
  echo "Error: Prompt file not specified." >&2
  exit 1
fi

if [ ! -f "$PROMPT_FILE" ]; then
  echo "Error: Prompt file '$PROMPT_FILE' not found." >&2
  exit 1
fi

# Run claude command
claude -p "$(cat "$PROMPT_FILE")" --model "$MODEL" 2>&1
