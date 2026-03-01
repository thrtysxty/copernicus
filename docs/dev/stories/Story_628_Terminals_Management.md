# Story 628 — Terminals & Management Interfaces

**Status:** COMPLETE
**Assigned To:** Senior Dev (Claude)
**Blocked By:** —
**Sprint:** A — Delivered first; unblocks Story 625
**Priority:** P0 — Blocker
**Commit:** `1af39d2`

---

## Goal

Fix the `posix_spawnp` terminal crash that prevents all PTY sessions from spawning,
correct the Jules PTY rotate/slide interaction, and replace the bare GitHub page load
with a proper management interface.

---

## Environment Setup

```bash
cd copernicus && npm install
npx tsc --noEmit   # verify zero errors before touching anything
```

**IMPORTANT:** Do not run `npm run dev` or `electron .` — long-running processes
cause Jules tasks to time out. Type-check only.

---

## Root Cause Analysis

### AC-1: `posix_spawnp` Terminal Crash

**File:** `copernicus/electron/security/sandbox-manager.ts`

`generateMacOSProfile()` returns `['/usr/bin/sandbox-exec', '-f', <profilePath>]`
whenever a macOS sandbox template exists at `resources/sandbox/macos-agent.sb.template`.
`sandbox-exec` was deprecated in macOS 14 (Sonoma) and is absent on macOS 15+
(Darwin 24+, Sequoia and later). When PTYManager calls `pty.spawn('/usr/bin/sandbox-exec', ...)`,
`node-pty` throws `posix_spawnp: No such file or directory` because the executable
no longer exists on the host OS.

### AC-2: Jules PTY — Rotate Button Wires Webview Slide

**File:** `copernicus/src/renderer/components/jules/JulesPanel.tsx`

`JulesPanel` implements a `translateX(-50%)` slide between `sessions` and `browser`
modes. The Globe button in `JulesSessionList` already called `onOpenBrowser()` correctly
but also rendered a `<span>jules.google.com</span>` text label making it appear as a
separate URL control. The text label was removed; the icon-only Globe button is the
rotate trigger.

### AC-3: Jules PTY — Authentication

**File:** `copernicus/src/renderer/components/jules/JulesPanel.tsx`

`partition="persist:jules"` was already present on the `<webview>` element at line 229.
No change required. ✅ Pre-existing.

### AC-4: GitHub Management Interface

**File:** `copernicus/src/renderer/components/github/GithubDashboard.tsx`

`github:list-repos` and `github:user` were already handled by `GithubManager`
(registered in `copernicus/electron/github-manager.ts`). The new handlers
(`github:set-trust`, `github:add-repo`, `github:remove-repo`, `github:get-trust-list`)
were added to `main.ts` using `handleIpc()` and persist data in `settingsStore`
under keys `github:trusted-repos` and `github:tracked-repos`.

---

## Implementation — What Was Built

### `copernicus/electron/security/sandbox-manager.ts`

Added existence check at the top of `generateMacOSProfile()` before template lookup:

```typescript
const sandboxExec = '/usr/bin/sandbox-exec';
if (!fs.existsSync(sandboxExec)) {
  console.warn('[SandboxManager] sandbox-exec unavailable (macOS 15+/Darwin 24+), skipping macOS sandboxing');
  return [];
}
```

### `copernicus/src/renderer/components/jules/JulesPanel.tsx`

Removed `<span>jules.google.com</span>` from Globe button. Changed button className
from `flex items-center gap-1 text-[9px] ...` to a simple icon-only style matching
the Refresh button beside it.

### `copernicus/electron/main.ts`

Added four handlers in the `// GitHub Handlers` section (line ~741), all wrapped in
`handleIpc()`:

| Channel | Behaviour |
|---------|-----------|
| `github:set-trust` | Adds/removes `repoName` from `github:trusted-repos` in `settingsStore` |
| `github:add-repo` | Appends `repoName` to `github:tracked-repos` (idempotent) |
| `github:remove-repo` | Removes from both trusted and tracked lists |
| `github:get-trust-list` | Returns `{ trusted: string[], tracked: string[] }` |

### `copernicus/electron/preload.ts`

Added to `SEND_CHANNELS`:
```
'github:set-trust', 'github:add-repo', 'github:remove-repo', 'github:get-trust-list'
```

### `copernicus/src/renderer/components/github/GithubDashboard.tsx`

Full rebuild. Three-tab layout:

- **Repos tab** — Lists GitHub API repos (`github:list-repos`) with per-row trust
  toggle (Shield/ShieldOff icon → `github:set-trust`). Trust state loaded from
  `github:get-trust-list` on mount alongside user and repo data.
- **Access tab** — Text input + Add button → `github:add-repo`. Tracked repo list
  with Shield indicator for trusted repos and Trash button → `github:remove-repo`.
- **Invite / Share tab** — Profile URL display with clipboard copy button (uses
  `navigator.clipboard`, no IPC needed). Descriptive text about trusted repo access.

Toast notifications via `useToastStore` on trust/add/remove actions.

---

## Deviations from Architect Spec

| Spec said | What was built | Reason |
|-----------|---------------|--------|
| Add `github:list-repos` to `main.ts` | Left in `GithubManager` — already registered | `GithubManager.registerHandlers()` registers it at startup; duplicate registration would throw |
| AC-3 — add `partition="persist:jules"` | Pre-existing at `JulesPanel.tsx:229` | No change needed |
| `github:list-repos` in "Files to Modify: main.ts" | Only new channels added to `main.ts` | Existing handler untouched |

---

## Acceptance Criteria

- [x] Terminals spawn without `posix_spawnp` error on macOS 15+ (Darwin 24+).
- [x] `generateMacOSProfile()` returns `[]` when `/usr/bin/sandbox-exec` is absent.
- [x] Jules PTY Globe button slides the webview panel in; X/back button slides back.
- [x] The redundant `jules.google.com` URL text removed from Jules PTY header.
- [x] Jules browser webview uses `partition="persist:jules"` (pre-existing — verified).
- [x] GitHub tab shows Repos / Access / Invite management interface.
- [x] All new IPC channels use `handleIpc()` and are in `preload.ts SEND_CHANNELS`.
- [x] `npx tsc --noEmit` passes with zero errors (resolved via Story 631 alongside).

---

## Files Modified

| File | Change |
|------|--------|
| `copernicus/electron/security/sandbox-manager.ts` | `sandbox-exec` existence guard |
| `copernicus/src/renderer/components/jules/JulesPanel.tsx` | Globe button text label removed |
| `copernicus/src/renderer/components/github/GithubDashboard.tsx` | Three-tab management UI |
| `copernicus/electron/main.ts` | 4 new `handleIpc()`-wrapped GitHub handlers |
| `copernicus/electron/preload.ts` | 4 new channels in `SEND_CHANNELS` |

## Files NOT Modified

- `copernicus/electron/pty-manager.ts` — PTY logic correct; bug was in SandboxManager.
- `copernicus/electron/security/env-sanitizer.ts` — env passthrough verified correct.
- `copernicus/electron/github-manager.ts` — existing handlers left in place.

---

## Definition of Done

1. [x] `cd copernicus && npx tsc --noEmit` passes with zero errors.
2. [x] All new `ipcMain.handle()` channels wrapped in `handleIpc()`.
3. [x] All new channels in `preload.ts SEND_CHANNELS`.
4. [x] No bare `ipcMain.handle` or bare `window.ipcRenderer.invoke` introduced.

---

## Blocks

- Story 625 (Jules PTY auth depends on stable PTY sessions)

## Blocked By

— (no dependencies)

## Documentation Impact

- `docs/TERMINAL_GUIDE.md` — document `sandbox-exec` deprecation and Darwin 24+ fallback behaviour.
- `docs/USER_GUIDE.md` — GitHub management interface: Repos trust, Access tracking, Invite/Share tab.
