# Getting Started

## First Launch

When you first open Copernicus, the **Genesis Wizard** walks you through:

1. **API Keys** — Enter credentials for providers you want to use. At minimum, you need one LLM provider key (Anthropic, OpenAI, or Google). Ollama works without a key.
2. **Repo Connection** — Point Copernicus at a Git repository. It indexes the codebase for semantic search.
3. **Story Backlog** — Optionally, describe your project and Copernicus generates an initial epic with stories.

## Configuration Files

- **`~/.secrets`** — API keys (Anthropic, OpenAI, Google, etc.). Copy from `secrets.example`.
- **`~/Library/Application Support/copernicus/config.env`** (macOS) or **`~/.config/copernicus/config.env`** (Linux) — Non-secret config: backend port, Ollama URL, log level.

## Starting Up

```bash
# First-time setup
bash scripts/dev-setup.sh

# Start backend + IDE
make dev

# Type check
make tsc
```

## Provider Setup

Each provider has its own auth flow in Settings → Auth:

- **Anthropic** — Enter API key directly
- **OpenAI** — Enter API key directly
- **Google** — Enter API key directly
- **OpenRouter** — Enter API key or use OAuth
- **Ollama** — No key needed. Detects running models at `localhost:11434` (or configure `OLLAMA_BASE_URL`)
