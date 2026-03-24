# Flask Backend API Reference

Base URL: `http://localhost:5001`

All endpoints return JSON. Auth is required where noted — set `Authorization: Bearer <ANTHROPIC_API_KEY>` or the relevant provider key.

---

## Health — `/api`

### `GET /api/health`

Liveness check.

**Response:**
```json
{ "status": "ok", "version": "1.0", "timestamp": 1711234567 }
```

```bash
curl http://localhost:5001/api/health
```

---

## LLM — `/api/llm`

### `POST /api/llm/chat`

Stream a chat completion. **Auth required.** Rate limited: 30/min.

**Request:**
```json
{
  "message": "string",
  "model": "claude-sonnet-4-6",
  "provider": "anthropic",
  "session_id": "uuid",
  "system_prompt": "optional override"
}
```

**Response:** Server-Sent Events stream, each line `data: <chunk>`. Final event: `data: [DONE]`.

```bash
curl -N -X POST http://localhost:5001/api/llm/chat \
  -H "Authorization: Bearer $ANTHROPIC_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"message":"hello","model":"claude-sonnet-4-6","provider":"anthropic","session_id":"abc123"}'
```

### `GET /api/llm/context/git`

Returns recent git log for context injection into chat.

**Response:**
```json
{ "log": "string — recent commits formatted for LLM context" }
```

---

## Agents — `/api/agents`

### `GET /api/agents/context/status`

Returns context window status for the active session.

**Response:**
```json
{ "session_id": "uuid", "item_count": 12, "estimated_tokens": 4200, "limit": 8000 }
```

### `POST /api/agents/context/pin`

Pin a context item so it survives pruning.

**Request:**
```json
{ "session_id": "uuid", "item_id": "string" }
```

**Response:**
```json
{ "pinned": true }
```

### `POST /api/agents/context/relevance`

Score context items by relevance to a task.

**Request:**
```json
{ "session_id": "uuid", "keywords": ["auth", "IPC"] }
```

**Response:**
```json
{ "scores": { "item_id_1": 0.92, "item_id_2": 0.41 } }
```

### `POST /api/agents/research`

Run a RAG research query against the local index.

**Request:**
```json
{ "query": "how does the workflow engine handle decision nodes", "top_k": 5 }
```

**Response:**
```json
{ "results": [{ "content": "...", "source": "file.ts", "score": 0.87 }] }
```

### `POST /api/agents/context/reset`

Clear the context window for a session.

**Request:**
```json
{ "session_id": "uuid" }
```

**Response:**
```json
{ "reset": true }
```

### `POST /api/agents/context/handoff`

Generate a compressed handoff summary from current context.

**Request:**
```json
{ "session_id": "uuid", "max_tokens": 200 }
```

**Response:**
```json
{ "summary": "string — ≤200 token context summary" }
```

---

## Stories — `/api/stories`

### `GET /api/stories`

List all stories from the `docs/stories/` directory.

**Response:**
```json
[{ "id": "182", "title": "FlippablePanel mode prop", "status": "COMPLETE", "path": "docs/stories/story_182_..." }]
```

### `GET /api/stories/<story_id>`

Get a single story by numeric ID.

**Response:**
```json
{ "id": "182", "title": "...", "status": "APPROVED FOR IMPLEMENTATION", "content": "full markdown" }
```

**Errors:** `404` if story not found.

### `POST /api/stories`

Create a new story file.

**Request:**
```json
{ "title": "My Feature", "description": "optional", "priority": "P1" }
```

**Response:**
```json
{ "id": "533", "path": "docs/stories/story_533_my_feature.md" }
```

### `PUT /api/stories/<story_id>`

Update story fields (status, priority, assigned_to, etc.).

**Request:**
```json
{ "status": "APPROVED FOR IMPLEMENTATION" }
```

**Response:**
```json
{ "updated": true }
```

### `DELETE /api/stories/<story_id>`

Archive (move to `docs/stories/completed/`) a story.

**Response:**
```json
{ "archived": true, "path": "docs/stories/completed/story_182_..." }
```

---

## Orchestration — `/api/orchestration`

### `POST /api/orchestration/confirm-model-switch`

Confirm or reject a pending model switch initiated by the agent.

**Request:**
```json
{ "confirmation_id": "uuid", "accepted": true }
```

**Response:**
```json
{ "processed": true }
```

### `GET /api/orchestration/pending-confirmations`

List confirmations awaiting user response.

**Response:**
```json
[{ "id": "uuid", "type": "model-switch", "from": "claude-sonnet-4-6", "to": "claude-haiku-4-5-20251001" }]
```

### `POST /api/orchestration/resolve-confirmation`

Resolve a pending confirmation.

**Request:**
```json
{ "confirmation_id": "uuid", "resolution": "accepted" }
```

---

## Docs — `/api/docs`

### `POST /api/docs/generate`

Generate documentation for a given file or symbol.

**Request:**
```json
{ "file_path": "copernicus/electron/ipc/daemon-handlers.ts", "format": "markdown" }
```

**Response:**
```json
{ "content": "generated markdown docs" }
```

### `POST /api/docs/visual-audit`

Audit a component screenshot against UX_BIBLE spec.

**Request:**
```json
{ "screenshot_path": "/tmp/screenshot.png", "component": "ChatPanel" }
```

**Response:**
```json
{ "violations": [], "passed": true }
```

---

## Registry — `/api/registry`

### `GET /api/registry/models`

List all registered AI models.

**Response:**
```json
[{ "id": "claude-sonnet-4-6", "provider": "anthropic", "context_window": 200000 }]
```

### `GET /api/registry/models/<model_id>`

Get model details.

### `GET /api/registry/personas`

List available agent personas.

### `GET /api/registry/personas/<alias>`

Get persona details by alias.

### `POST /api/registry/reload`

Reload the model and persona registry from disk.

**Response:**
```json
{ "reloaded": true, "model_count": 24, "persona_count": 8 }
```

---

## Settings — `/api/settings`

### `GET /api/settings`

Get current app settings.

**Response:**
```json
{ "ollama_base_url": "", "backend_port": 5001, "log_level": "INFO", "developer_rate": 150 }
```

### `PUT /api/settings`

Update settings. Persisted to `config.env`.

**Request:**
```json
{ "ollama_base_url": "http://192.168.1.185:11434" }
```

**Response:**
```json
{ "updated": true }
```

---

## NotebookLM — `/api/notebooklm`

> 📌 Requires Stories 432–433. Endpoints are registered but return `503` until credentials are established.

### `GET /api/notebooklm/status`

Returns NotebookLM authentication status.

**Response:**
```json
{ "authenticated": false, "reason": "no credentials" }
```

### `GET /api/notebooklm/notebooks`

List accessible notebooks (requires auth).

**Response:**
```json
[{ "id": "uuid", "name": "Research Notes", "source_count": 12 }]
```

---

## Error Codes

| HTTP | Code | Meaning |
|---|---|---|
| 400 | `validation_error` | Request body failed schema validation |
| 401 | `unauthorized` | Missing or invalid API key |
| 404 | `not_found` | Resource not found |
| 429 | `rate_limited` | Per-endpoint rate limit exceeded |
| 500 | `internal_error` | Unhandled server error — check Flask logs |
| 503 | `service_unavailable` | Dependency not available (Ollama, NotebookLM) |
