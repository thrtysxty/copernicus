# story_733: E2E Chat with LLM Mock

**Status:** READY
**Priority:** P0 — RC gate

## Narrative
**As a** Copernicus user,
**I want** to send a chat message and receive a response,
**So that** the full chat loop is verified end-to-end before release.

## Context

`chat:send` IPC handler → Flask backend → LLM router → response. The E2E test uses a mock backend
(COPERNICUS_BACKEND_URL pointing to a pytest fixture server) to avoid real API calls.
Alternatively, use `window.evaluate()` to invoke `chat:send` directly and stub the response
at the IPC layer — whichever approach produces a deterministic test.

## Acceptance Criteria

### Setup
1. Story file `story_951.md` (Status: READY) written to `e2eHome/workspace/docs/stories/`
2. `stories:sync` invoked to load it
3. Story card `story-card-story_951` visible on kanban

### Chat Send
4. `chat:send` IPC invoked via `window.evaluate()` with payload `{ message: "What is story_951 about?", sessionId: "test-session" }`
5. IPC returns `{ ok: true, data: ... }` — no error, no crash

### UI Response
6. If a chat panel element exists (`[data-testid="chat-message"]` or similar), at least one message visible after send
7. App body remains visible — no crash, no blank screen

### Screenshot
8. `window.screenshot({ path: screenshotPath('chat-llm-e2e'), fullPage: true })`

## Files in Scope
- `e2e/chat-llm.spec.ts` (new)

## Frozen Surfaces
- `electron/ipc/chat-handlers.ts` — do not modify
- `chat:send` channel name — use exactly as defined

## Blocked By
- None

## Blocks
- story_737 (RC gate)

## Gate
```
npx playwright test e2e/chat-llm.spec.ts 2>&1 | tail -10
```

## Definition of Done
- [ ] `e2e/chat-llm.spec.ts` created
- [ ] `chat:send` IPC call succeeds (ok: true)
- [ ] App body visible after send — no crash
- [ ] Playwright test passes
