# Semantic Codebase Search

Copernicus indexes your codebase for semantic search — ask questions in natural language, get relevant code locations.

## How It Works

1. **LSP-aware chunking** — `typescript-language-server` provides function and class boundaries. Chunks align to real code structures, not arbitrary line splits.
2. **768-dimensional embeddings** — Stored in `sqlite-vec` alongside everything else. No external vector store needed.
3. **Provider waterfall** — Ollama (free, local) → Google → OpenAI. Falls back automatically. Works fully offline if Ollama is running.
4. **Incremental re-indexing** — chokidar watches for file changes. Only modified files are re-embedded.
5. **Hybrid search** — Vector similarity combined with symbol name boosting. Results ranked by relevance and recency.

## Indexing

The codebase indexer runs automatically when you open a project. You can also trigger manual re-index from the Command Palette (`Cmd+P` → "Reindex Codebase").

## Querying

Use the search bar or ask in chat:
- "Where is authentication handled?"
- "Find all API routes"
- "Show me the database schema"

Results show file path, symbol name, and a relevance score. Click to jump to the location in the editor.
