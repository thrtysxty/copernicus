# Execution Plan 005: LLM Chat Service Integration
**Sprint:** 2
**Agent Role:** Senior Developer (TypeScript/React)
**Story:** 101 (H-3), Story 109
**Prerequisite:** Plans 001 and 002 complete
**Date Authored:** 2026-02-25

---

## Context

The `ChatPanel.tsx` component sends messages to `console.log` instead of any LLM.
The `llm.ts` service stub exists but is not wired. The `@help` context injection calls
an IPC handler (`fs:read-file`) that is not registered in `main.ts`. The model selector
has no `onClick`. File/story attachment buttons have no handlers.

This plan wires the LLM service, registers the missing IPC handlers, and connects the UI
controls. It does NOT implement a full streaming pipeline — it implements a working
synchronous round-trip that can be upgraded to streaming in a follow-up story.

**Read every file in full before modifying.**

---

## Task 1: Audit Existing LLM Service Stub

**Step 1: Read `copernicus/src/renderer/services/llm.ts` in full.**

Note: what interface it exports, what arguments it takes, what it returns,
what API it calls (Anthropic SDK? OpenRouter? Both?), and what is stubbed vs. implemented.

**Step 2: Read `copernicus/electron/models/model-registry.ts` in full.**

Note: how models are defined, what fields each model has (id, provider, name),
and how the registry is exported.

**Step 3: Read `copernicus/electron/auth-manager.ts` lines 1–80.**

Note: how `getApiKey(provider)` works and what providers it supports.

**Step 4: Read `copernicus/src/renderer/components/chat/ChatPanel.tsx` in full.**

Note: every `TODO`, every `console.log` that should be a real call, every button
with no `onClick`, the `model` state variable, the `context` variable, and the
`enrichedContent` variable.

---

## Task 2: Register Missing IPC Handlers in `main.ts`

### File: `copernicus/electron/main.ts`

**Step 1: Find the block where `ipcMain.handle(...)` calls are grouped.**

**Step 2: Add the `fs:read-file` handler.**

This is required by `@help` context injection in `ChatPanel.tsx:50-57`.

```typescript
import * as fs from 'fs'
import * as path from 'path'

// Handler for @-mention context injection
ipcMain.handle('fs:read-file', async (_event, relativePath: unknown) => {
  // Validate input type
  if (typeof relativePath !== 'string') {
    throw new Error('fs:read-file: path must be a string')
  }

  // Validate path is within project root
  const resolved = path.resolve(ROOT_PATH, relativePath)
  if (!resolved.startsWith(path.resolve(ROOT_PATH))) {
    throw new Error(`fs:read-file: path traversal denied for '${relativePath}'`)
  }

  // Only allow reading .md files (context injection use case)
  if (!resolved.endsWith('.md')) {
    throw new Error(`fs:read-file: only .md files are permitted`)
  }

  try {
    return fs.readFileSync(resolved, 'utf-8')
  } catch (err) {
    throw new Error(`fs:read-file: cannot read '${relativePath}': ${err}`)
  }
})
```

**Step 3: Add the `llm:chat` handler.**

This is the bridge between the renderer chat UI and the LLM backend.

```typescript
ipcMain.handle('llm:chat', async (_event, payload: unknown) => {
  // Type guard
  if (
    typeof payload !== 'object' ||
    payload === null ||
    typeof (payload as Record<string, unknown>).message !== 'string' ||
    typeof (payload as Record<string, unknown>).model !== 'string'
  ) {
    throw new Error('llm:chat: invalid payload — expected { message: string, model: string, context?: string }')
  }

  const { message, model, context } = payload as {
    message: string
    model: string
    context?: string
  }

  // Validate message length
  if (message.length > 32000) {
    throw new Error('llm:chat: message exceeds 32,000 character limit')
  }

  // Get API key for the requested model's provider
  const registry = getModelRegistry()  // import from models/model-registry
  const modelConfig = registry.getModel(model)
  if (!modelConfig) {
    throw new Error(`llm:chat: unknown model '${model}'`)
  }

  const apiKey = authManager.getApiKey(modelConfig.provider)
  if (!apiKey) {
    throw new Error(`llm:chat: no API key found for provider '${modelConfig.provider}'`)
  }

  // Build the message list
  const messages = []
  if (context) {
    messages.push({ role: 'system', content: context })
  }
  messages.push({ role: 'user', content: message })

  // Dispatch to provider
  // TODO(story-109): implement real provider dispatch
  // For now, return a stub response so the UI is wired end-to-end
  return {
    content: `[${model}] Received: "${message.slice(0, 100)}${message.length > 100 ? '...' : ''}"`,
    model,
    provider: modelConfig.provider,
  }
})
```

> Note: the stub response ensures the UI is wired before real API calls are implemented.
> A follow-up story will replace the stub with real Anthropic/OpenRouter SDK calls.

**Step 4: Add `fs:read-file` and `llm:chat` to the preload allowlist.**

In `copernicus/electron/preload.ts`, add both channels to `ALLOWED_INVOKE_CHANNELS`:

```typescript
'fs:read-file',
'llm:chat',
```

---

## Task 3: Wire `ChatPanel.tsx` to Real IPC

### File: `copernicus/src/renderer/components/chat/ChatPanel.tsx`

**Step 1: Read the file in full (you already did this in Task 1).**

**Step 2: Replace the `console.log` stub with a real IPC call.**

Find the section that currently does:
```typescript
// Placeholder for LLM streaming integration (waiting for llm.ts service)
console.log(`[CHAT] Sending to ${model} with context:`, context, enrichedContent)
```

Replace with:

```typescript
try {
  const response = await ipcRenderer.invoke('llm:chat', {
    message: enrichedContent,
    model,
    context: context || undefined,
  })

  setMessages(prev => [
    ...prev,
    { role: 'user', content: currentInput, timestamp: Date.now() },
    { role: 'assistant', content: response.content, model: response.model, timestamp: Date.now() },
  ])
} catch (err) {
  setMessages(prev => [
    ...prev,
    { role: 'user', content: currentInput, timestamp: Date.now() },
    { role: 'error', content: `Error: ${err instanceof Error ? err.message : String(err)}`, timestamp: Date.now() },
  ])
} finally {
  setCurrentInput('')
  setIsLoading(false)
}
```

> The exact state update depends on your `messages` state shape. Read the existing
> state type definition before writing this — do not assume field names.

**Step 3: Wire the model selector `onClick`.**

Find the model selector `<div>` (currently a styled but inert element).

Add a state variable for the dropdown:
```typescript
const [showModelMenu, setShowModelMenu] = useState(false)
```

Change the model display div:
```typescript
<div
  className="flex items-center bg-zinc-900 border border-copernicus-steel rounded px-1.5 py-0.5 cursor-pointer hover:border-copernicus-phosphor transition-colors group"
  onClick={() => setShowModelMenu(v => !v)}
>
  <span className="text-[9px] text-copernicus-phosphor">{model}</span>
  <ChevronDown size={10} className="text-zinc-600 group-hover:text-copernicus-phosphor" />
</div>
```

Add the dropdown menu (positioned absolutely, appears when `showModelMenu` is true):
```typescript
{showModelMenu && (
  <div className="absolute bottom-8 left-0 bg-zinc-900 border border-copernicus-steel rounded shadow-lg z-50 min-w-[160px]">
    {AVAILABLE_MODELS.map(m => (
      <button
        key={m.id}
        className="block w-full text-left px-3 py-1.5 text-[10px] text-zinc-300 hover:bg-zinc-800 hover:text-copernicus-phosphor"
        onClick={() => { setModel(m.id); setShowModelMenu(false) }}
      >
        {m.name}
      </button>
    ))}
  </div>
)}
```

Define `AVAILABLE_MODELS` at the top of the component file (import from a shared
location if model registry is accessible to renderer; otherwise hardcode for now):

```typescript
const AVAILABLE_MODELS = [
  { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6' },
  { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash' },
  { id: 'gpt-4o', name: 'GPT-4o' },
]
```

**Step 4: Fix `_setModel` → `setModel` rename.**

The current code has:
```typescript
const [model, _setModel] = useState('claude-sonnet-4-6')
```

Rename to:
```typescript
const [model, setModel] = useState('claude-sonnet-4-6')
```

**Step 5: TypeScript — ensure no new errors.**

```bash
cd copernicus && npx tsc --noEmit 2>&1 | grep -E "error TS" | head -20
```

---

## Task 4: Add Loading State to Chat UI

The chat currently has no loading indicator. Add one to show the user the request
is in flight.

**Step 1: Find or create a `isLoading` state variable in `ChatPanel.tsx`.**

```typescript
const [isLoading, setIsLoading] = useState(false)
```

**Step 2: Set `isLoading = true` before the IPC call and `false` in the `finally` block.**

**Step 3: Disable the send button while loading.**

Find the send button (or Enter key handler). Add `disabled={isLoading}`:

```typescript
<button
  disabled={isLoading || !currentInput.trim()}
  onClick={handleSend}
  className="... disabled:opacity-50 disabled:cursor-not-allowed"
>
  {isLoading ? '...' : 'Send'}
</button>
```

---

## Task 5: Manual End-to-End Verification

**Step 1: Start the Copernicus app in dev mode.**

```bash
cd copernicus && npm run dev
```

**Step 2: Open the Chat panel.**

**Step 3: Type a message and send it.**

Expected:
- Message appears in chat history
- Loading indicator shows briefly
- A stub response appears (e.g. `[claude-sonnet-4-6] Received: "..."`)
- No console errors

**Step 4: Type `@help` in the message.**

Expected:
- `@help` is replaced with the contents of `docs/help/USER_GUIDE.md` before sending
- If the file doesn't exist, a console error is logged but the send still proceeds with
  the original text (the current `catch` block in ChatPanel handles this)

**Step 5: Click the model selector.**

Expected:
- Dropdown appears with 3 model options
- Selecting a model updates the displayed model name
- Dropdown closes

---

## Completion Checklist

- [ ] `ipcMain.handle('fs:read-file', ...)` registered in `main.ts`
- [ ] `ipcMain.handle('llm:chat', ...)` registered in `main.ts`
- [ ] Both channels added to preload allowlist
- [ ] `ChatPanel.tsx` sends messages via `ipcRenderer.invoke('llm:chat', ...)`
- [ ] Model selector dropdown is functional
- [ ] `_setModel` renamed to `setModel`
- [ ] Loading state prevents duplicate sends
- [ ] `npx tsc --noEmit` passes
- [ ] Manual end-to-end test passes (stub response returned and displayed)

**Commit message:**
```
feat(sprint-2): wire LLM chat service and model selector

- Register fs:read-file and llm:chat IPC handlers in main.ts (H-3)
- Add both channels to preload allowlist
- Connect ChatPanel.tsx to llm:chat IPC instead of console.log
- Implement model selector dropdown (was inert styled element)
- Add isLoading state and disabled send button during requests
- Fix _setModel → setModel naming

Note: llm:chat returns stub responses pending Story 109 real provider dispatch.
```
