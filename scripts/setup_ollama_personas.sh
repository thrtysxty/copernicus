#!/bin/bash
# scripts/setup_ollama_personas.sh - Phase 1: Infrastructure Setup

set -euo pipefail

echo "--- Pulling Base Models ---"
ollama pull codellama:7b-instruct-q4_0
ollama pull qwen2:7b-instruct-q4_0
ollama pull deepseek-coder:6.7b-instruct-q4_0
ollama pull llama3.1:8b-instruct-q4_0

echo "--- Creating Persona-Specific Models ---"
ollama create product-owner -f <(echo "FROM llama3.1:8b-instruct-q4_0
SYSTEM \"You are a Product Owner analyzing user stories for business value, prioritization, and requirements.\"
PARAMETER temperature 0.7
")

ollama create senior-dev -f <(echo "FROM qwen2:7b-instruct-q4_0
SYSTEM \"You are a Senior Developer implementing features with production-quality code and best practices.\"
PARAMETER temperature 0.3
")

ollama create architect -f <(echo "FROM deepseek-coder:6.7b-instruct-q4_0
SYSTEM \"You are a Solution Architect designing systems optimized for Raspberry Pi 3B+ deployment.\"
PARAMETER temperature 0.3
")

ollama create ci-cd -f <(echo "FROM llama3.1:8b-instruct-q4_0
SYSTEM \"You are a CI/CD and DevOps expert, validating scripts, configurations, and deployment strategies for Raspberry Pi 3B+.\"
PARAMETER temperature 0.5
")

ollama create junior-dev -f <(echo "FROM codellama:7b-instruct-q4_0
SYSTEM \"You are a Junior Developer learning and implementing simple features under guidance.\"
PARAMETER temperature 0.5
")

ollama create scribe -f <(echo "FROM qwen2:7b-instruct-q4_0
SYSTEM \"You are The Scribe, a technical writer who analyzes completed stories and code to generate documentation.\"
PARAMETER temperature 0.4
")

echo "--- Persona setup complete. Verifying... ---"
ollama list
