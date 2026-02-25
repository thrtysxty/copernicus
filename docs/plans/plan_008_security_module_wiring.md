# Execution Plan 008: Security Module Wiring
**Sprint:** 1 (Copernicus-specific)
**Agent Role:** Senior Developer (TypeScript/Electron — Security)
**Story:** 102, AC §2 and §3
**Prerequisite:** Plan 007 complete (clean compile required)
**Date Authored:** 2026-02-25

---

## Context

Copernicus has a fully implemented security layer:
- `security/env-sanitizer.ts` — strips credentials from PTY environment ✅ WIRED
- `security/pty-auditor.ts` — logs all terminal I/O ✅ WIRED
- `security/pattern-detector.ts` — detects dangerous command patterns ❌ NEVER CALLED
- `security/sandbox-manager.ts` — generates OS sandbox profiles ❌ NEVER CALLED
- `security/git-guard.ts` — gates git push operations ❌ NEVER INSTANTIATED

Additionally, several IPC handlers accept user-controlled parameters with no validation.

This plan wires the dormant modules and adds input validation to critical handlers.
**Read every security file in full before writing any code.**

---

## Task 1: Read All Security Files

Before writing a single line, read these files completely and take notes on their APIs:

1. `copernicus/electron/security/pattern-detector.ts` — note: constructor, `analyse(data)` method signature, return type
2. `copernicus/electron/security/sandbox-manager.ts` — note: constructor, `generateProfile(agentId)`, how profiles are applied
3. `copernicus/electron/security/git-guard.ts` — note: `ConfirmationProvider` interface, `check(agentId, command)` signature
4. `copernicus/electron/security/env-sanitizer.ts` — already wired, read for reference
5. `copernicus/electron/security/pty-auditor.ts` — already wired, read for reference
6. `copernicus/electron/pty-manager.ts` — understand current structure before modifying
7. `copernicus/electron/main.ts` — understand IPC handler locations

---

## Task 2: Create `SecurityManager` Singleton

### File: `copernicus/electron/security/security-manager.ts` (NEW)

This file wires all security modules into a single managed singleton.

```typescript
/**
 * SecurityManager — unified security orchestration for COPERNICUS.
 *
 * Instantiates and coordinates:
 *   - PatternDetector: real-time dangerous pattern analysis
 *   - SandboxManager: OS-level process containment
 *   - GitGuard: git push gating with user confirmation
 *
 * Usage:
 *   import { securityManager } from './security-manager'
 *   securityManager.analyseCommand(agentId, data)
 */
import { PatternDetector, DetectionResult } from './pattern-detector'
import { SandboxManager } from './sandbox-manager'
import { GitGuard, ConfirmationProvider, GitGuardDecision } from './git-guard'
import { BrowserWindow, ipcMain } from 'electron'

// ------------------------------------------------------------------
// ConfirmationProvider implementation
// Uses IPC to show a confirmation dialog in the renderer
// ------------------------------------------------------------------
class IPCConfirmationProvider implements ConfirmationProvider {
  private win: BrowserWindow | null = null

  setWindow(win: BrowserWindow) {
    this.win = win
  }

  async requestConfirmation(request: import('./git-guard').GitPushRequest): Promise<GitGuardDecision> {
    if (!this.win || this.win.isDestroyed()) {
      // No window — reject by default (safe fail)
      return { approved: false, reason: 'No window available for confirmation' }
    }

    return new Promise((resolve) => {
      const responseChannel = `git-guard:response:${Date.now()}`

      // Send request to renderer
      this.win!.webContents.send('git-guard:confirm', { request, responseChannel })

      // Wait for renderer response (timeout after 30s)
      const timeout = setTimeout(() => {
        ipcMain.removeAllListeners(responseChannel)
        resolve({ approved: false, reason: 'Confirmation timed out' })
      }, 30_000)

      ipcMain.once(responseChannel, (_event, decision: GitGuardDecision) => {
        clearTimeout(timeout)
        resolve(decision)
      })
    })
  }
}

// ------------------------------------------------------------------
// SecurityManager
// ------------------------------------------------------------------
export class SecurityManager {
  readonly detector: PatternDetector
  readonly sandbox: SandboxManager
  readonly gitGuard: GitGuard
  private confirmationProvider: IPCConfirmationProvider

  constructor() {
    this.detector = new PatternDetector()
    this.sandbox = new SandboxManager()
    this.confirmationProvider = new IPCConfirmationProvider()
    this.gitGuard = new GitGuard(this.confirmationProvider)
  }

  setWindow(win: BrowserWindow) {
    this.confirmationProvider.setWindow(win)
  }

  /**
   * Analyse a data chunk being written to a PTY.
   * Returns DetectionResult — caller decides whether to block.
   */
  analyseCommand(agentId: string, data: string): DetectionResult {
    return this.detector.analyse(agentId, data)
  }

  /**
   * Check whether a git operation is permitted.
   * Blocks on git push; allows all other operations (for now).
   */
  async checkGitOperation(agentId: string, command: string): Promise<boolean> {
    return this.gitGuard.check(agentId, command)
  }

  /**
   * Apply OS sandbox to a newly spawned process.
   * Returns the sandbox command args to prepend to the spawn call,
   * or null if sandboxing is unavailable or not applicable.
   */
  getSandboxArgs(agentId: string): string[] | null {
    try {
      return this.sandbox.generateProfile(agentId)
    } catch (err) {
      console.warn(`[SecurityManager] Sandbox profile generation failed for ${agentId}:`, err)
      return null
    }
  }
}

// Module-level singleton
export const securityManager = new SecurityManager()
```

**Verify it compiles:**
```bash
cd copernicus && npx tsc --noEmit 2>&1 | grep "security-manager"
```

---

## Task 3: Wire PatternDetector into PTY Data Handler

### File: `copernicus/electron/pty-manager.ts`

**Step 1: Read the file in full.**

Find the `ptyProcess.onData(...)` handler. It currently does:
```typescript
ptyProcess.onData((data) => {
  this.auditor.log(id, 'OUT', data)
  if (window && !window.isDestroyed()) {
    window.webContents.send('terminal-incoming', { id, data })
  }
})
```

**Step 2: Add the import.**

```typescript
import { securityManager } from './security/security-manager'
```

**Step 3: Add pattern detection to the `write()` method** (where data goes INTO the PTY,
i.e., commands the user/agent types). Find the method that calls `ptyProcess.write(data)`.

```typescript
write(id: string, data: string): void {
  const session = this.sessions.get(id)
  if (!session) return

  // Analyse the command before writing to PTY
  const result = securityManager.analyseCommand(id, data)

  if (result.blocked) {
    // Inform the renderer that the command was blocked
    this.window?.webContents.send('terminal-blocked', {
      id,
      reason: result.reason,
      pattern: result.matchedPattern,
    })
    console.warn(`[PTY:${id}] BLOCKED command — pattern: ${result.matchedPattern}`)
    return  // Do NOT write to PTY
  }

  if (result.warned) {
    // Log the warning but allow execution
    console.warn(`[PTY:${id}] WARNING — pattern: ${result.matchedPattern}`)
  }

  session.ptyProcess.write(data)
}
```

> Note: the exact method and property names depend on what you read in the file.
> Adapt this pattern to match the actual structure.

**Step 4: Register a `terminal-blocked` channel in the preload allowlist.**

In `copernicus/electron/preload.ts`, add `'terminal-blocked'` to `ALLOWED_LISTEN_CHANNELS`.

---

## Task 4: Extend GitGuard Regex Patterns

### File: `copernicus/electron/security/git-guard.ts`

**Step 1: Read the file in full.**

Find the regex that checks for `git push`. Currently:
```typescript
if (!/\bgit\s+push\b/.test(command)) {
  return true; // non-push commands allowed
}
```

**Step 2: Extend the blocked pattern list:**

```typescript
// Patterns that require GitGuard review
const GATED_PATTERNS = [
  /\bgit\s+push\b/,                          // any push
  /\bgit\s+push\s+.*--force\b/,              // force push (also caught by above)
  /\bgit\s+push\s+.*-f\b/,                   // force push shorthand
  /\bgit\s+remote\s+add\b/,                  // adding unknown remotes
  /\bgit\s+config\s+user\./,                 // identity spoofing
  /\bgit\s+config\s+--global/,               // global config changes
]

public async check(agentId: string, command: string): Promise<boolean> {
  const requiresReview = GATED_PATTERNS.some(pattern => pattern.test(command))

  if (!requiresReview) {
    return true // Operation is not gated
  }
  // ... existing review logic continues
}
```

**Step 3: Verify the compile.**

```bash
cd copernicus && npx tsc --noEmit 2>&1 | grep "git-guard"
```

---

## Task 5: Add IPC Validation to Critical Handlers

### File: `copernicus/electron/main.ts`

**Step 1: Read `main.ts` in full.**

Identify the exact location of these handlers:
- `stories:update`
- `stories:hydrate`
- `terminal-create`
- `makefile:run`
- `system:make`

**Step 2: Add validation helpers at the top of main.ts (after imports):**

```typescript
// ---------------------------------------------------------------------------
// Input validation helpers
// ---------------------------------------------------------------------------

/** Validate a story ID — must be story_NNN or similar safe pattern */
function isValidStoryId(id: unknown): id is string {
  return typeof id === 'string' && /^story_\d{3,}(_[\w-]+)?$/.test(id)
}

/** Validate a Makefile target against the allowlist */
const ALLOWED_MAKE_TARGETS = new Set([
  'dev', 'dev-backend', 'dev-frontend',
  'test', 'test-e2e', 'build', 'lint', 'lint-fix', 'clean',
  'deploy', 'db-deploy', 'db-migrate',
  'agent', 'dashboard', 'backlog', 'import-data',
  'docker-build', 'docker-up', 'docker-down',
])

function isAllowedMakeTarget(target: unknown): target is string {
  return typeof target === 'string' && ALLOWED_MAKE_TARGETS.has(target.trim())
}

/** Validate that a directory path is within the workspace */
function isSafeWorkingDir(cwd: unknown): cwd is string {
  if (typeof cwd !== 'string') return false
  const resolved = path.resolve(cwd)
  const homeDir = os.homedir()
  const rootDir = path.resolve(ROOT_PATH)
  return resolved.startsWith(rootDir) || resolved.startsWith(homeDir)
}
```

**Step 3: Update `stories:update` handler:**

```typescript
ipcMain.handle('stories:update', (_event, id: unknown, status: unknown) => {
  if (!isValidStoryId(id)) {
    console.warn(`[security] stories:update blocked — invalid id: ${id}`)
    return { error: 'Invalid story ID format' }
  }
  if (typeof status !== 'string' || status.length > 50) {
    return { error: 'Invalid status' }
  }
  storiesManager.updateStoryStatus(id, status)
})
```

**Step 4: Update `stories:hydrate` handler:**

```typescript
ipcMain.handle('stories:hydrate', (_event, id: unknown) => {
  if (!isValidStoryId(id)) {
    console.warn(`[security] stories:hydrate blocked — invalid id: ${id}`)
    return
  }
  console.log(`[SYSTEM] Hydrating story: ${id}`)
  win?.webContents.send('editor:open', id)
})
```

**Step 5: Update `terminal-create` handler:**

```typescript
ipcMain.on('terminal-create', (_event, { id, cols, rows, cwd }: {
  id: unknown, cols: unknown, rows: unknown, cwd: unknown
}) => {
  if (typeof id !== 'string') return
  const safeCwd = (isSafeWorkingDir(cwd) ? cwd : os.homedir()) as string
  const safeCols = typeof cols === 'number' && cols > 0 && cols < 500 ? cols : 80
  const safeRows = typeof rows === 'number' && rows > 0 && rows < 200 ? rows : 24
  if (win) {
    ptyManager.create(id, safeCols, safeRows, safeCwd, win)
  }
})
```

**Step 6: Update `makefile:run` handler:**

```typescript
ipcMain.handle('makefile:run', (_event, target: unknown) => {
  if (!isAllowedMakeTarget(target)) {
    console.warn(`[security] makefile:run blocked — target: ${target}`)
    return { error: `Target '${target}' is not permitted` }
  }
  return new Promise((resolve) => {
    const child = spawn('make', [target.trim()], {
      cwd: ROOT_PATH,
      shell: false,  // NO shell: true
    })
    // ... rest of existing output handling unchanged
  })
})
```

Apply same validation to `system:make`.

---

## Task 6: Register `git-guard:confirm` IPC Channels

The `IPCConfirmationProvider` we wrote in Task 2 sends a `git-guard:confirm` event to
the renderer and listens for a response. These channels must be in the preload allowlist.

### File: `copernicus/electron/preload.ts`

Add to the appropriate sets:
```typescript
// Add to ALLOWED_LISTEN_CHANNELS
'git-guard:confirm',

// Add to ALLOWED_SEND_CHANNELS (renderer responds to git-guard confirm)
// Note: response channel is dynamic (git-guard:response:TIMESTAMP)
// This requires a prefix-based allowlist or a dedicated response channel
```

> **Architectural note:** Dynamic response channels (`git-guard:response:${Date.now()}`)
> cannot be statically whitelisted. Two options:
> 1. Use a fixed response channel `git-guard:response` and enforce one-at-a-time confirmation
> 2. Add prefix validation: if channel starts with `git-guard:response:` allow it
>
> Implement option 1 (simpler, safe):

```typescript
// Replace dynamic channel with fixed channel in IPCConfirmationProvider:
const responseChannel = 'git-guard:response'

// In ALLOWED_SEND_CHANNELS in preload:
'git-guard:response',
```

---

## Task 7: Wire SecurityManager into main.ts

### File: `copernicus/electron/main.ts`

**Step 1: Add import at top:**

```typescript
import { securityManager } from './security/security-manager'
```

**Step 2: After the main window is created, set the window on the security manager:**

Find the `app.whenReady()` block. After `createWindow()`:

```typescript
app.whenReady().then(() => {
  createWindow()
  securityManager.setWindow(win!)  // ADD THIS
  // ... rest of existing code
})
```

---

## Task 8: Validate `agentId` in SandboxManager

### File: `copernicus/electron/security/sandbox-manager.ts`

**Step 1: Read the file in full.**

Find the `generateProfile(agentId)` method, specifically where `agentId` is joined
into the file path.

**Step 2: Add validation at the start of `generateProfile`:**

```typescript
generateProfile(agentId: string): string[] {
  // Validate agentId before using in path operations
  if (!/^[a-z0-9_-]+$/i.test(agentId)) {
    throw new Error(`Invalid agentId for sandbox profile: '${agentId}'`)
  }
  // ... rest of existing logic unchanged
}
```

---

## Completion Checklist

- [ ] `copernicus/electron/security/security-manager.ts` created and compiles
- [ ] `PatternDetector` called in `ptyManager.write()` before every PTY write
- [ ] Commands matching dangerous patterns are blocked and renderer is notified via `terminal-blocked`
- [ ] `GitGuard` instantiated via `SecurityManager`; gated patterns extended to include `--force`, `remote add`, `config user`
- [ ] `IPCConfirmationProvider` implemented using fixed `git-guard:response` channel
- [ ] `stories:update` and `stories:hydrate` validate `id` format
- [ ] `terminal-create` validates and clamps `cwd`, `cols`, `rows`
- [ ] `makefile:run` and `system:make` validate against `ALLOWED_MAKE_TARGETS`
- [ ] `sandbox-manager.ts` validates `agentId` before path join
- [ ] `securityManager.setWindow(win)` called after window creation in `main.ts`
- [ ] `npx tsc --noEmit` exits 0

**Commit message:**
```
security(sprint-1): wire dormant security modules into execution paths

- Create SecurityManager singleton orchestrating PatternDetector, SandboxManager, GitGuard
- Wire PatternDetector into pty-manager write() — dangerous patterns are now blocked
- Implement IPCConfirmationProvider for GitGuard user confirmation dialog
- Extend GitGuard gated patterns: --force, remote add, config user
- Add IPC input validation: stories:update, terminal-create, makefile:run
- Validate agentId in SandboxManager before path operations
- Wire securityManager.setWindow() in app.whenReady()
```
