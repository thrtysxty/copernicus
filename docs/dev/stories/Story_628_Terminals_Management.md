# Story 628 — Terminals & Management Interfaces

**Status:** APPROVED FOR IMPLEMENTATION
**Assigned To:** Jules
**Blocked By:** —
**Sprint:** A — Resolve first; unblocks Story 625
**Priority:** P0 — Blocker

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

**Fix:** In `generateMacOSProfile()`, add an existence check for `sandbox-exec` before
proceeding. Return `[]` (no sandboxing) if it is not present.

```typescript
// copernicus/electron/security/sandbox-manager.ts
// Add at the top of generateMacOSProfile(), before template check:
private generateMacOSProfile(agentId: string, workspaceRoot: string): string[] {
  const sandboxExec = '/usr/bin/sandbox-exec'
  if (!fs.existsSync(sandboxExec)) {
    console.warn('[SandboxManager] sandbox-exec unavailable (macOS 15+), skipping sandboxing')
    return []
  }
  // ... rest of existing method unchanged
}
```

### AC-2: Jules PTY — Rotate Button Wires Webview Slide

**File:** `copernicus/src/renderer/components/jules/JulesPanel.tsx`

`JulesPanel` already implements a `translateX(-50%)` slide between `sessions` and `browser`
modes. The rotate button must call `setMode('browser')` (slide in) when on the sessions
face, and `setMode('sessions')` (slide back) when on the browser face. The separate "URL"
button in the header must be removed; its action (opening the Jules web UI) must become
the rotate/globe button action.

Inspect the current header in `JulesSessionList` (rendered inside the front face). Remove
the standalone URL/external-link button. Ensure the globe/rotate button calls
`onOpenBrowser()`. Verify that `JulesBrowserPanel` shows the Jules web UI at the
correct URL (read from `auth:get-api-key` for `jules` baseUrl, or a reasonable default).

### AC-3: Jules PTY — Authentication

**File:** `copernicus/src/renderer/components/jules/JulesPanel.tsx`
**File:** `copernicus/electron/main.ts` (Jules webview partition)

The `<webview>` in `JulesBrowserPanel` must use `partition="persist:jules"` so that the
Google session cookie survives restarts. Verify this partition is already set; if not,
add it. No changes to CSP or webPreferences are needed for the partition alone.

### AC-4: GitHub Management Interface

**File:** `copernicus/src/renderer/components/github/GithubDashboard.tsx`

Replace the current bare GitHub URL load with a proper management view. The component
already exists. Implement the following sections using the existing `GithubDashboard`
component (do not create a new file):

- **Repos tab:** List repos returned by `github:list-repos` IPC (add handler if absent).
  Each row shows: name, visibility, trust toggle (checkbox → calls `github:set-trust`).
- **Access tab:** "Add repo" input + button → calls `github:add-repo`. "Remove" button on
  each row → calls `github:remove-repo`.
- **Invite / Share tab:** Static text with the user's GitHub profile URL and a copy button.

All new IPC handlers in `main.ts` must use `handleIpc()`. All new channels must be added
to `SEND_CHANNELS` in `preload.ts`.

---

## Acceptance Criteria

- [ ] Terminals spawn without `posix_spawnp` error on macOS 15+ (Darwin 24+).
- [ ] `generateMacOSProfile()` returns `[]` when `/usr/bin/sandbox-exec` is absent.
- [ ] Jules PTY tab rotate button slides the webview panel in; pressing it again (or the
      close/back button) slides back to sessions.
- [ ] The redundant URL button is removed from the Jules PTY header.
- [ ] Jules browser webview uses `partition="persist:jules"`.
- [ ] GitHub tab shows a management interface (not a bare page load).
- [ ] `npx tsc --noEmit` passes with zero errors after all changes.
- [ ] All new IPC channels use `handleIpc()` and are in `preload.ts SEND_CHANNELS`.

---

## Files to Modify

| File | Change |
|------|--------|
| `copernicus/electron/security/sandbox-manager.ts` | Add `sandbox-exec` existence guard |
| `copernicus/src/renderer/components/jules/JulesPanel.tsx` | Rotate button + remove URL button + partition |
| `copernicus/src/renderer/components/github/GithubDashboard.tsx` | Management UI |
| `copernicus/electron/main.ts` | Add `github:list-repos`, `github:set-trust`, `github:add-repo`, `github:remove-repo` IPC handlers |
| `copernicus/electron/preload.ts` | Add new GitHub channels to `SEND_CHANNELS` |

## Files NOT to Modify

- `copernicus/electron/pty-manager.ts` — PTY logic is correct; the bug is in SandboxManager.
- `copernicus/electron/security/env-sanitizer.ts` — env passthrough is correct.
- Any file not listed above.

---

## Definition of Done

1. `cd copernicus && npx tsc --noEmit` passes with zero errors.
2. All new `ipcMain.handle()` channels are in `preload.ts SEND_CHANNELS`.
3. No forbidden patterns (bare `ipcMain.handle`, bare `window.ipcRenderer.invoke`).
4. Only the files listed above are modified.

---

## Blocks

- Story 625 (Jules PTY auth depends on stable PTY sessions)

## Blocked By

— (no dependencies)

## Documentation Impact

- `docs/TERMINAL_GUIDE.md` — document sandbox-exec deprecation note and Darwin 24+ behaviour.
- `docs/USER_GUIDE.md` — GitHub management interface section.
