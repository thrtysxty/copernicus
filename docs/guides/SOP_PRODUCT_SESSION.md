# Product Session SOP (CLI Workflow)

## Overview
This document outlines the standard operating procedure for product sessions using the local CLI-based agentic workflow. This replaces the previous IDE extension-heavy workflow (Continue.dev, Gemini Code Assist) to optimize resource usage on development machines.

## Prerequisites
- **Ollama** installed and running.
- **Python 3** installed.
- **Git** repository context available.

## Setup
1.  **Install Ollama:**
    -   Download from [ollama.com](https://ollama.com).
    -   Run the application.
2.  **Download Models:**
    -   Run `./scripts/setup_ollama_personas.sh` to pull and configure the required models (`qwen2.5-coder`, `deepseek-r1`, etc.).

## Workflow
Instead of using IDE chat interfaces, all agent interactions are performed via the CLI.

### 1. Start a Session
Open your terminal and navigate to the project root.

### 2. Interact with Personas
Use the `scripts/claude_ollama_cli.py` script to send prompts to specific personas. The script automatically includes Git status and file lists in the context.

**Syntax:**
```bash
python3 scripts/claude_ollama_cli.py "/<persona> <prompt>"
```

**Available Personas:**
-   `/architect`: High-level system design and architectural decisions. (Uses `deepseek-r1:8b`)
-   `/senior-dev`: Implementation, code review, and best practices. (Uses `qwen2.5-coder:7b`)
-   `/product-owner`: User stories, requirements, and prioritization. (Uses `llama3.1:8b`)
-   `/junior-dev`: Simple coding tasks and learning. (Uses `qwen2.5-coder:1.5b`)
-   `/scribe`: Documentation generation. (Uses `qwen2.5-coder:1.5b`)

**Examples:**
```bash
# Ask the Architect about the system design
python3 scripts/claude_ollama_cli.py "/architect Review the current module structure."

# Ask the Senior Dev to review a file
python3 scripts/claude_ollama_cli.py "/senior-dev Optimize the loop in src/utils.py."

# Ask the Product Owner to prioritize backlog
python3 scripts/claude_ollama_cli.py "/product-owner Review the backlog for critical items."
```

### 3. IDE Configuration
-   **Disable/Uninstall** heavyweight AI extensions (Continue.dev, Gemini Code Assist) to free up RAM.
-   Use the CLI for all AI assistance.

## Troubleshooting
-   **"Ollama not found"**: Ensure Ollama is running in the background.
-   **"Model not found"**: Run `./scripts/setup_ollama_personas.sh` again to ensure models are pulled.
