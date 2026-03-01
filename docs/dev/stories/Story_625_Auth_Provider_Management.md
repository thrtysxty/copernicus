# Story 625 — Auth & Provider Management Infrastructure

**Status:** APPROVED FOR IMPLEMENTATION
**Assigned To:** Gemini
**Blocked By:** Story 628 (Jules PTY auth requires stable terminal sessions)
**Sprint:** A — Second in sequence
**Priority:** P0

---

## Goal

Establish a reliable authentication flow for all external providers: fix Wizard OAuth
failures, wire authentication fields for every provider in Settings, implement provider
revocation from the UI, and make the Embedding provider priority list drag-and-drop.

---

## Environment Setup

```bash
cd copernicus && npm install
npx tsc --noEmit   # verify zero errors before touching anything
```

---

## Context

**`auth:revoke` IPC already exists** at `copernicus/electron/main.ts:499`:
```typescript
ipcMain.handle('auth:revoke', (_, provider: string) =>
  handleIpc(() => authManager.revokeApiKey(provider)))
```
And it is in `SEND_CHANNELS`. No new IPC handler is needed for revocation — only the UI
trigger is missing.

The Wizard sends preferences via `save-preferences` IPC. The Wizard's OAuth flow opens
webviews/external URLs. The `401 Invalid Client` on Google OAuth and the pre-authenticated
`claude.ai` page loading mean the OAuth `client_id` / redirect URI configured in the
Wizard is either missing or misconfigured at the application level.

---

## Acceptance Criteria

### AC-1: Wizard — Claude.ai Pre-Auth

**File:** `copernicus/src/renderer/components/wizard/Wizard.tsx`

The Wizard opens a webview (or external browser) to `claude.ai` for Anthropic OAuth.
If the user is already signed in to claude.ai, the webview should detect the existing
session and surface the API key or OAuth token rather than prompting a fresh login.

Ensure the webview for claude.ai uses `partition="persist:claude"` so cookies persist
between wizard restarts. If the Wizard currently opens via `app:open-external`, switch
to an in-app webview panel for the Anthropic auth step only.

### AC-2: Wizard — Google OAuth `401 Invalid Client`

**File:** `copernicus/src/renderer/components/wizard/Wizard.tsx`
**File:** `copernicus/electron/main.ts` (OAuth redirect handler)

The Google OAuth step receives `401 Invalid Client`. Root cause: the OAuth consent screen
must list `copernicus://oauth` (or `http://localhost:PORT`) as an approved redirect URI,
and the app must listen for that redirect.

Implement a localhost redirect server in the Wizard flow:
1. On "Connect Google" click: generate PKCE code verifier + challenge.
2. Open `https://accounts.google.com/o/oauth2/v2/auth` with `redirect_uri=http://localhost:PORT`.
3. Start a one-shot HTTP server in the main process (`app:start-oauth-listener` IPC) that
   captures the `?code=` param, exchanges it for tokens, then closes.
4. Push `oauth:google-complete` event to renderer via `win.webContents.send()`.

Add `oauth:google-complete` to `RECEIVE_CHANNELS` in `preload.ts`. The handler in
`main.ts` must use `handleIpc()`.

### AC-3: Settings — Providers Authentication Fields

**File:** `copernicus/src/renderer/components/settings/sections/ProvidersSection.tsx`

Every provider row must have:
- **API Key field** — masked input (`type="password"`) that reads from `auth:get-api-key`
  on mount and writes via `auth:store-api-key` on blur/save.
- **Base URL field** — text input (optional, shown for Ollama and OpenRouter by default).
- **Status indicator** — a coloured dot: green = key present, amber = key missing,
  red = last auth check failed.
- **Revoke button** — calls `auth:revoke` with the provider ID. On success, clears the
  key field and resets status dot to amber.

Use the `useIpcError` hook for all IPC calls — no bare `window.ipcRenderer.invoke`.

### AC-4: Settings — Embedding Provider Priority (Drag-and-Drop)

**File:** `copernicus/src/renderer/components/settings/sections/ProvidersSection.tsx`
(or a new `EmbeddingSection.tsx` if the Embedding tab is separate)

Replace the current single-arrow / multi-click priority buttons with HTML5 native
drag-and-drop reordering:
- Each provider row has `draggable={true}`.
- `onDragStart` stores the provider id in `dataTransfer`.
- `onDrop` on a target row reorders the list in local state and persists via
  `settings:save` IPC call with key `embeddingProviderOrder`.
- No external DnD library — native HTML5 only (per AGENTS.md convention).

### AC-5: Provider Revocation

The revoke button from AC-3 calls `invoke('auth:revoke', providerId)`. After success:
- Clear the API key input field in the UI.
- Set the status dot to amber.
- Show a toast: `useToastStore.getState().addToast('Provider access revoked', 'success')`.

---

## Files to Modify

| File | Change |
|------|--------|
| `copernicus/src/renderer/components/wizard/Wizard.tsx` | Persist webview session; localhost redirect flow |
| `copernicus/electron/main.ts` | `app:start-oauth-listener` handler; `oauth:google-complete` push |
| `copernicus/electron/preload.ts` | Add `oauth:google-complete` to `RECEIVE_CHANNELS`; `app:start-oauth-listener` to `SEND_CHANNELS` |
| `copernicus/src/renderer/components/settings/sections/ProvidersSection.tsx` | Auth fields, status dot, revoke button, drag-and-drop order |

## Files NOT to Modify

- `copernicus/electron/auth-manager.ts` — `revokeApiKey` already implemented.
- Any file not listed above.

---

## Definition of Done

1. `cd copernicus && npx tsc --noEmit` passes with zero errors.
2. All new `ipcMain.handle()` channels use `handleIpc()` and are in `SEND_CHANNELS`.
3. `oauth:google-complete` is in `RECEIVE_CHANNELS`.
4. No bare `window.ipcRenderer.invoke` — all renderer IPC via `useIpcError`.
5. No external DnD library added to `package.json`.

---

## Blocks

— (no downstream blockers)

## Blocked By

- Story 628 (Jules PTY auth requires stable PTY)

## Documentation Impact

- `docs/AUTH_FLOW.md` — Document localhost PKCE redirect flow, partition strategy.
- `docs/USER_GUIDE.md` — Managing and revoking provider access, drag-and-drop order.
