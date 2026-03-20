Settings are accessed via the gear icon in the Activity Bar.

**Settings sections:**

- **Auth** — Add and manage API keys for all providers (Anthropic, OpenAI, Google, Ollama, OpenRouter, DeepInfra). Status dots show which providers are connected.

- **Models** — Set default AI models for chat, code, and workflow roles. Configure the embedding engine and priority order for codebase search.

- **Local AI** — Start and stop the bundled BitNet inference server. Shows server status and port.

- **Appearance** — Switch between dark themes, toggle CRT overlay effect, adjust font size.

- **Git** — Set your GitHub Personal Access Token and default Git identity.

- **RAG** — Configure codebase indexing behaviour and semantic search settings.

- **MCP** — Add Model Context Protocol servers for extended AI tool capabilities.

- **Context** — Configure how much context (file content, history) is sent to the AI.

- **Templates** — Manage system prompt templates for different roles and workflows.

- **Personas** — Create and edit AI persona profiles with custom system prompts.

- **Extensions** — Enable or disable IDE extensions and integrations.

- **Environment** — Set environment variables used by the IDE and agent runners.

- **Hardware** — Configure remote inference server URLs (Ollama on R210ii, custom endpoints).

**Saving settings:**
- Most settings save automatically on change
- A green toast notification confirms each save
- Some changes (appearance, hardware) take effect immediately; model changes apply on next chat session
