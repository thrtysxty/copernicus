The Memory & Replay view (accessible via the Telemetry icon in the Activity Bar) shows two panels.

**Agent Memory (left panel):**
- Stores important facts and context from previous chat sessions
- Entries are ranked by importance (0–10 scale) with colour-coded badges
- Use the **Save to Memory** button in the chat panel to save a message to memory
- Memory entries persist across restarts and are available as context in future sessions
- Click **↺ Refresh** to reload the latest entries

**Session Replay (right panel):**
- Records every AI model call made during the session: prompt, context, and response
- **History column:** shows all runs (workflow or chat sessions) with timestamp and model used
- **Steps column:** shows each individual AI call within the selected run
- **Detail column:** click a step then toggle between Prompt, Context, and Response to inspect the full payload
- Useful for debugging agent behaviour, reviewing what was sent to the model, and auditing costs

**Spotlight:**
- Click the Maximize icon on either panel header to expand it to full width
- Click again to return to split view

**Telemetry view also shows:**
- LSP server status
- Active model name and provider
- Token budget and session cost breakdown
