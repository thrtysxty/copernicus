COPERNICUS has two search modes accessible from the Search drawer (magnifier icon or Ctrl+Shift+F).

**Text search:**
- Searches file contents with literal string matching
- Supports regex, case-sensitive, and whole-word toggles
- Results update as you type (300ms debounce)
- Click a result to jump to the file and line

**Semantic search:**
- Uses vector embeddings to find conceptually related code — not just exact matches
- Useful for queries like "where is authentication handled?" or "find the function that sends IPC events"
- Requires an embedding provider configured in Settings → Models
- Results update with a 600ms debounce (slightly slower than text search)

**Codebase indexing:**
- The codebase is indexed automatically when COPERNICUS opens a project
- Index status shows in the status bar (bottom right)
- Re-indexing happens incrementally as files change
- If the index shows "No embedding provider", go to Settings → Models → Embedding Engine and select a provider

**Search tips:**
- Use text search for exact symbol names or error messages
- Use semantic search for concepts, behaviours, or "find something like X"
- Toggling case-sensitive or regex immediately re-runs the current query
