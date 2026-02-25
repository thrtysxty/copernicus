# Execution Plan 009: Features Layer Fixes
**Sprint:** 1 (Copernicus-specific)
**Agent Role:** Senior Developer (TypeScript/Electron — Features)
**Story:** 102, AC §4
**Prerequisite:** Plan 007 complete
**Date Authored:** 2026-02-25

---

## Context

Several Electron feature modules have critical gaps:
- `workflow/engine.ts` and `workflow/states.ts` are completely empty — any import crashes
- `commands/dispatcher.ts` has hardcoded mock strings instead of real logic
- `devtime-manager.ts` has a schema that diverges from `resources/devtime_schema.sql`
- `devtime-manager.ts` has a TOCTOU race condition in session recovery
- `interop/dispatcher.ts` echoes messages back to sender with no routing
- `auth-manager.ts` parses YAML with a regex
- `github-manager.ts` has an unhandled `response.json()` failure path

**Read every file in full before modifying it.**

---

## Task 1: Scaffold `workflow/engine.ts` and `workflow/states.ts`

Both files are completely empty. Any code that imports from them will fail.
The goal is a minimal, importable scaffold — not a full implementation.
Full implementation is tracked in Story 110.

### File: `copernicus/electron/workflow/states.ts`

```typescript
/**
 * Workflow state definitions for COPERNICUS agent orchestration.
 *
 * Story 110 will implement the full transition logic.
 * This file provides the type scaffold required by engine.ts.
 */

export type WorkflowStatus =
  | 'IDLE'
  | 'RUNNING'
  | 'PAUSED'
  | 'COMPLETE'
  | 'FAILED'

export interface WorkflowState {
  id: string
  storyId: string
  agentId: string
  status: WorkflowStatus
  currentStep: number
  totalSteps: number
  createdAt: string
  updatedAt: string
  error?: string
}

export interface WorkflowTransition {
  from: WorkflowStatus
  to: WorkflowStatus
  trigger: string
}

/** Valid state transitions */
export const TRANSITIONS: WorkflowTransition[] = [
  { from: 'IDLE',    to: 'RUNNING',  trigger: 'start'  },
  { from: 'RUNNING', to: 'PAUSED',   trigger: 'pause'  },
  { from: 'RUNNING', to: 'COMPLETE', trigger: 'finish' },
  { from: 'RUNNING', to: 'FAILED',   trigger: 'error'  },
  { from: 'PAUSED',  to: 'RUNNING',  trigger: 'resume' },
  { from: 'PAUSED',  to: 'FAILED',   trigger: 'cancel' },
]

export function isValidTransition(from: WorkflowStatus, to: WorkflowStatus): boolean {
  return TRANSITIONS.some(t => t.from === from && t.to === to)
}
```

### File: `copernicus/electron/workflow/engine.ts`

```typescript
/**
 * Workflow Engine — COPERNICUS agent task orchestration.
 *
 * Current status: scaffold. Story 110 implements retry logic and
 * race condition fixes. Story 041 implements State Ledger integration.
 *
 * This file is intentionally minimal — it provides a functional
 * import boundary so dependent code does not crash.
 */
import {
  WorkflowState,
  WorkflowStatus,
  isValidTransition,
} from './states'

export class WorkflowEngine {
  private workflows = new Map<string, WorkflowState>()

  /**
   * Create a new workflow instance for a story/agent pair.
   */
  create(storyId: string, agentId: string): WorkflowState {
    const id = `wf_${storyId}_${agentId}_${Date.now()}`
    const state: WorkflowState = {
      id,
      storyId,
      agentId,
      status: 'IDLE',
      currentStep: 0,
      totalSteps: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    this.workflows.set(id, state)
    return state
  }

  /**
   * Transition a workflow to a new status.
   * Returns false if the transition is invalid.
   */
  transition(id: string, to: WorkflowStatus): boolean {
    const state = this.workflows.get(id)
    if (!state) return false

    if (!isValidTransition(state.status, to)) {
      console.warn(
        `[WorkflowEngine] Invalid transition ${state.status} → ${to} for workflow ${id}`
      )
      return false
    }

    state.status = to
    state.updatedAt = new Date().toISOString()
    return true
  }

  get(id: string): WorkflowState | undefined {
    return this.workflows.get(id)
  }

  list(): WorkflowState[] {
    return Array.from(this.workflows.values())
  }
}

// Module-level singleton
export const workflowEngine = new WorkflowEngine()
```

**Verify both files compile:**
```bash
cd copernicus && npx tsc --noEmit 2>&1 | grep "workflow"
```

---

## Task 2: Fix `commands/dispatcher.ts` — Remove Mocks

### File: `copernicus/electron/commands/dispatcher.ts`

**Step 1: Read the file in full.**

**Step 2: Fix the `command:forward` handler.**

Currently it copies a hardcoded string to clipboard. Replace with actual last PTY output
from the state ledger:

```typescript
import { stateLedger } from '../db/state-ledger'  // adjust import path as needed

ipcMain.on('command:forward', (_event, { target, args }: { target: string, args: string[] }) => {
  // Validate target
  const allowedTargets = ['claude', 'gemini', 'jules']
  if (!allowedTargets.includes(target)) {
    console.warn(`[commands/forward] Unknown target agent: ${target}`)
    return
  }

  // Retrieve the most recent event from the state ledger for context
  const recentEvents = stateLedger.getRecentEvents(5)
  const lastOutput = recentEvents
    .filter(e => e.event_type === 'pty_output')
    .map(e => e.content)
    .join('\n')
    .slice(-2000) // limit context size

  if (!lastOutput) {
    console.warn(`[commands/forward] No recent PTY output to forward`)
    return
  }

  // Write the context to the target agent's terminal
  // TODO(story-113): implement actual multi-agent routing
  console.log(`[commands/forward] Forwarding ${lastOutput.length} chars to ${target}`)
  clipboard.writeText(lastOutput)
})
```

> If `stateLedger` is not yet accessible from this file, fall back to reading the most
> recent entry from the state ledger DB directly using `better-sqlite3`.

**Step 3: Fix the `terminal:write` handler.**

Currently it only logs. Wire it to the PTY manager:

```typescript
// Remove the old handler:
// ipcMain.on('terminal:write', (_event, { terminalId, text }) => {
//   console.log(`[PTY:${terminalId}] Writing: "${text}"`)
// })

// NOTE: terminal:write is already handled in main.ts via ptyManager.write()
// If this handler in dispatcher.ts is redundant, DELETE IT.
// Check main.ts for the terminal-write handler before deciding.
```

Read `main.ts` to find the `terminal-write` or `terminal:write` handler. If it exists
there, delete the duplicate in `commands/dispatcher.ts`.

---

## Task 3: Reconcile DevTime Schema

### Files: `copernicus/electron/devtime-manager.ts` vs `copernicus/resources/devtime_schema.sql`

**Step 1: Read both files in full.**

**Step 2: Record every mismatch.** The known differences are:

| TypeScript Code | SQL File | Fix Needed |
|---|---|---|
| Table: `dev_sessions` | Table: `sessions` | Align to `dev_sessions` |
| Column: `date` | Missing | Add `date` to SQL |
| Column: `financial_category` | Column: `entity` | Align both to `financial_category` |
| Column: `duration` | Column: `duration_seconds` | Align both to `duration_seconds` |
| Missing | Column: `end_time` | Add `end_time` to TS or remove from SQL |
| Missing | Column: `rate` | Add to TS or remove from SQL |

**Step 3: Update `resources/devtime_schema.sql` to match the TypeScript implementation.**

The TypeScript code is the running implementation. Update the SQL file to match it
(not the other way around, since the TS code has actual data):

```sql
-- COPERNICUS DevTime Session Schema
-- Canonical definition. TypeScript code in electron/devtime-manager.ts must match this.

CREATE TABLE IF NOT EXISTS dev_sessions (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    date                TEXT    NOT NULL,
    start_time          TEXT    NOT NULL,
    duration_seconds    INTEGER NOT NULL DEFAULT 0,
    phase               TEXT    NOT NULL CHECK(phase IN ('Research', 'Design', 'Development', 'Testing', 'Review', 'Deployment', 'Maintenance')),
    financial_category  TEXT    NOT NULL CHECK(financial_category IN ('CapEx', 'OpEx')),
    component           TEXT    NOT NULL,
    description         TEXT,
    commits             TEXT    DEFAULT '',
    story_id            TEXT,
    capitalizable       INTEGER NOT NULL DEFAULT 0 CHECK(capitalizable IN (0, 1)),
    created_at          TEXT    NOT NULL DEFAULT (datetime('now')),
    value               REAL    NOT NULL DEFAULT 0.0
);

CREATE INDEX IF NOT EXISTS idx_dev_sessions_date ON dev_sessions(date);
CREATE INDEX IF NOT EXISTS idx_dev_sessions_story ON dev_sessions(story_id);
```

**Step 4: Update `devtime-manager.ts`** to change `duration` column references to
`duration_seconds` throughout (if they differ — check carefully).

**Step 5: Verify the TypeScript CREATE TABLE statement matches the SQL file.**

They must be identical in column names and CHECK constraints.

---

## Task 4: Fix DevTime TOCTOU Race Condition

### File: `copernicus/electron/devtime-manager.ts`

**Step 1: Read the `recoverSession` method (around lines 49–57).**

Current code:
```typescript
private recoverSession() {
  if (fs.existsSync(this.LOCK_PATH)) {
    try {
      const data = JSON.parse(fs.readFileSync(this.LOCK_PATH, 'utf8'))
      this.startSession(data, true)
    } catch (e) {
      console.error("Failed to recover session", e)
    }
  }
}
```

**Step 2: Remove the TOCTOU race by eliminating `existsSync`:**

```typescript
private recoverSession(): void {
  try {
    const raw = fs.readFileSync(this.LOCK_PATH, 'utf8')
    const data: unknown = JSON.parse(raw)

    // Validate recovered data has required fields
    if (
      typeof data !== 'object' || data === null ||
      !('financial_category' in data) ||
      !('component' in data) ||
      !('phase' in data)
    ) {
      console.warn('[DevTime] Lock file has invalid structure — clearing')
      fs.unlinkSync(this.LOCK_PATH)
      return
    }

    this.startSession(data as SessionData, true)
    console.log('[DevTime] Recovered session from lock file')
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      // No lock file — normal startup
      return
    }
    console.error('[DevTime] Failed to recover session:', err)
    // Attempt to clean up corrupted lock file
    try { fs.unlinkSync(this.LOCK_PATH) } catch { /* ignore */ }
  }
}
```

---

## Task 5: Fix InteropDispatcher Routing

### File: `copernicus/electron/interop/dispatcher.ts`

**Step 1: Read the file in full.**

**Step 2: Replace the echo-back with a real routing stub.**

The current handler sends messages back to the same window that sent them.
Replace with a routing approach that:
1. Validates the target agent
2. Logs the intent to the state ledger
3. Finds the correct window/terminal for the target agent

```typescript
import { ipcMain, BrowserWindow } from 'electron'
import { stateLedger } from '../db/state-ledger'  // adjust path as needed

const KNOWN_AGENTS = new Set(['claude', 'gemini', 'jules', 'default'])

class InteropDispatcher {
  /**
   * Route a task delegation to the target agent's terminal.
   * If the target agent is in the same window, sends via IPC.
   * If the target agent is in a different window, broadcasts.
   */
  delegate(sourceWindow: BrowserWindow, target: string, task: string): void {
    if (!KNOWN_AGENTS.has(target)) {
      console.warn(`[Interop] Unknown target agent: '${target}'`)
      sourceWindow.webContents.send('agent:error', {
        message: `Unknown agent: ${target}`,
      })
      return
    }

    // Log the delegation intent to the state ledger
    try {
      stateLedger.logIntent(
        `DELEGATE: ${task}`,
        'pending',
        target
      )
    } catch (err) {
      console.warn('[Interop] Failed to log intent:', err)
    }

    // Broadcast to all windows — each terminal picks up its own agent messages
    BrowserWindow.getAllWindows().forEach(win => {
      if (!win.isDestroyed()) {
        win.webContents.send('agent:input', { target, content: task })
      }
    })

    console.log(`[Interop] DELEGATE → ${target}: "${task.slice(0, 80)}"`)
  }

  broadcast(event: string, payload: unknown): void {
    BrowserWindow.getAllWindows().forEach(win => {
      if (!win.isDestroyed()) {
        win.webContents.send(event, payload)
      }
    })
  }
}

export const dispatcher = new InteropDispatcher()

// Register IPC handlers
ipcMain.on('agent:delegate', (event, { target, task }: { target: unknown, task: unknown }) => {
  if (typeof target !== 'string' || typeof task !== 'string') {
    console.warn('[Interop] agent:delegate received invalid payload')
    return
  }

  const senderWindow = BrowserWindow.fromWebContents(event.sender)
  if (!senderWindow) return

  dispatcher.delegate(senderWindow, target, task)
})
```

---

## Task 6: Fix `auth-manager.ts` GitHub YAML Parsing

### File: `copernicus/electron/auth-manager.ts`

**Step 1: Check if `js-yaml` is in `package.json` dependencies.**

```bash
grep "js-yaml" copernicus/package.json
```

If not present, add it:
```bash
cd copernicus && npm install js-yaml
npm install --save-dev @types/js-yaml
```

**Step 2: Read `auth-manager.ts` lines 105–131.**

**Step 3: Replace the regex-based GitHub token extraction:**

```typescript
// BEFORE (regex, fragile):
const match = content.match(/oauth_token:\s+(\S+)/)
if (match) return match[1]

// AFTER (yaml parser):
import * as yaml from 'js-yaml'

try {
  const hosts = yaml.load(content) as Record<string, Record<string, string>>
  // gh hosts.yml structure: { "github.com": { oauth_token: "...", ... } }
  for (const host of Object.values(hosts)) {
    if (host && typeof host.oauth_token === 'string') {
      return host.oauth_token
    }
  }
} catch (parseErr) {
  console.error('[AuthManager] Failed to parse gh hosts.yml:', parseErr)
}
```

---

## Task 7: Fix `github-manager.ts` JSON Parse Error

### File: `copernicus/electron/github-manager.ts`

**Step 1: Read lines 25–35.**

**Step 2: Wrap the `response.json()` call:**

```typescript
// BEFORE:
if (!response.ok) {
  const error = await response.json()
  throw new Error(error.message || `GitHub API error: ${response.status}`)
}

// AFTER:
if (!response.ok) {
  let errorMessage = `GitHub API error: ${response.status}`
  try {
    const error = await response.json()
    if (error && typeof error.message === 'string') {
      errorMessage = error.message
    }
  } catch {
    // Response body was not JSON — use status-based message
  }
  throw new Error(errorMessage)
}
```

---

## Completion Checklist

- [ ] `workflow/states.ts` exports `WorkflowStatus`, `WorkflowState`, `TRANSITIONS`, `isValidTransition`
- [ ] `workflow/engine.ts` exports `WorkflowEngine` class and `workflowEngine` singleton
- [ ] `npx tsc --noEmit` shows no errors related to workflow imports
- [ ] `commands/dispatcher.ts` `command:forward` reads from state ledger (no hardcoded mock)
- [ ] `commands/dispatcher.ts` duplicate `terminal:write` handler removed
- [ ] `resources/devtime_schema.sql` matches TypeScript `CREATE TABLE` column names exactly
- [ ] `devtime-manager.ts` session recovery uses single `try/catch` with no `existsSync`
- [ ] `interop/dispatcher.ts` `agent:delegate` validates target, logs to state ledger, broadcasts to all windows
- [ ] `auth-manager.ts` uses `js-yaml` for GitHub token extraction
- [ ] `github-manager.ts` `response.json()` wrapped in try/catch
- [ ] `npx tsc --noEmit` exits 0

**Commit message:**
```
feat(features): scaffold workflow engine, fix dispatcher mocks, repair schema drift

- Scaffold workflow/engine.ts and workflow/states.ts state machine (Story 110 basis)
- Remove hardcoded mock from commands/dispatcher.ts command:forward
- Remove duplicate terminal:write handler from commands/dispatcher.ts
- Reconcile devtime_schema.sql with TypeScript CREATE TABLE (was out of sync)
- Fix TOCTOU race in devtime-manager recoverSession() — remove existsSync
- Replace interop/dispatcher echo-back with real broadcast routing + ledger logging
- Replace regex YAML parsing in auth-manager with js-yaml
- Wrap response.json() in try/catch in github-manager
```
