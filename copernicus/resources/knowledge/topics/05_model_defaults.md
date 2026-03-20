Model defaults let you assign specific AI models to different IDE functions.

**Setting defaults:**
1. Open Settings → Models
2. You will see three role selectors:
   - **Architect / Planning** — used for chat, story writing, and planning tasks
   - **Coder** — used for code generation and inline suggestions
   - **Workflow** — used by the workflow builder when running agent nodes
3. Select a model from the dropdown for each role
4. Changes save immediately

**Embedding engine:**
- Controls which model is used for semantic codebase search
- Default: Ollama with nomic-embed-text (local, free)
- Alternatives: OpenAI text-embedding-3-small, Google text-embedding-004
- Requires the chosen provider to have a valid API key

**Embedding priority:**
- Drag providers in the priority list to set fallback order
- COPERNICUS tries providers in order until one succeeds

**Switching models mid-session:**
- Click the model name in the status bar or use the model selector in the chat panel header
- Switching models mid-conversation inserts a context handoff marker in the chat
