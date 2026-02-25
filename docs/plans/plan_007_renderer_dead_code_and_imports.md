# Execution Plan 007: Renderer Dead Code, Duplicates, and Import Fixes
**Sprint:** 1 (Copernicus-specific)
**Agent Role:** Senior Developer (TypeScript/React)
**Story:** 102, AC §1
**Date Authored:** 2026-02-25

---

## Context

The Copernicus renderer has three pairs of duplicate component files. In two cases the
root-level file is either empty or unused, and App.tsx may be importing the wrong one.
There are also two orphaned Zustand stores, a type definition bug that breaks all IPC
listener cleanup, and unhandled promise rejections.

**Read every file in full before touching anything.** The import graph must be traced
before deleting anything.

---

## Task 1: Audit All Imports Before Deleting Anything

Run these greps to confirm which files are actually imported before you delete them.

```bash
cd /Users/dadmin/Projects/agentic-platform/copernicus

# Find every import of ChatPanel
grep -rn "ChatPanel" src/ --include="*.tsx" --include="*.ts"

# Find every import of FlippablePanel
grep -rn "FlippablePanel" src/ --include="*.tsx" --include="*.ts"

# Find every import of Terminal (not Terminal/)
grep -rn "from.*components/Terminal'" src/ --include="*.tsx" --include="*.ts"
grep -rn "from.*components/Terminal\"" src/ --include="*.tsx" --include="*.ts"

# Find every import of CommandPalette
grep -rn "CommandPalette" src/ --include="*.tsx" --include="*.ts"

# Find every import of the orphaned stores
grep -rn "layoutStore\|copernicusStore" src/ --include="*.tsx" --include="*.ts"
```

Record every file that imports each of the duplicates. You will need to update those
import paths.

---

## Task 2: Fix ChatPanel Duplicate (CRITICAL — causes runtime crash)

### Files involved:
- `src/renderer/components/ChatPanel.tsx` — **EMPTY** (contains only `export {}`)
- `src/renderer/components/chat/ChatPanel.tsx` — **REAL IMPLEMENTATION**

**Step 1: Read `src/renderer/App.tsx` in full.**

Find the import of ChatPanel. It currently imports from one of these paths — identify which:
```typescript
import { ChatPanel } from './components/ChatPanel'     // points to empty file
import { ChatPanel } from './components/chat/ChatPanel' // points to real file
```

**Step 2: If App.tsx imports from `./components/ChatPanel` (empty file), update it:**

```typescript
// BEFORE
import { ChatPanel } from './components/ChatPanel'
// AFTER
import { ChatPanel } from './components/chat/ChatPanel'
```

**Step 3: Delete the empty file.**

```bash
rm copernicus/src/renderer/components/ChatPanel.tsx
```

**Step 4: Verify no other file imports the deleted path.**

```bash
grep -rn "components/ChatPanel'" src/ --include="*.tsx" --include="*.ts"
```

Should return zero results.

---

## Task 3: Fix FlippablePanel Duplicate

### Files involved:
- `src/renderer/components/FlippablePanel.tsx` — uses prop drilling, never imported
- `src/renderer/components/layout/FlippablePanel.tsx` — uses store hook, actively used

**Step 1: Read both files.**

**Step 2: Confirm `layout/FlippablePanel.tsx` is the one imported in App.tsx.**

```bash
grep -n "FlippablePanel" src/renderer/App.tsx
```

**Step 3: Confirm root-level `FlippablePanel.tsx` has zero importers.**

```bash
grep -rn "from.*components/FlippablePanel'" src/ --include="*.tsx" --include="*.ts"
```

If zero results, delete it:

```bash
rm copernicus/src/renderer/components/FlippablePanel.tsx
```

---

## Task 4: Fix Terminal Duplicate

### Files involved:
- `src/renderer/components/Terminal.tsx` — complex agent-log implementation, NOT used in app
- `src/renderer/components/Terminal/Terminal.tsx` — IPC-based implementation, actively used

**Step 1: Read both files in full.**

Understand what `Terminal.tsx` (root) implements that `Terminal/Terminal.tsx` does not:
- Agent log system
- `/delegate` and `/forward` command parsing
- `@last-X` clipboard integration
- `useAgentStore` integration

**Step 2: Determine if any of the root Terminal.tsx logic should be preserved.**

If the agent log system and delegate/forward commands are wanted features, note them as
a separate story rather than deleting the logic entirely.

**Step 3: Confirm root `Terminal.tsx` has zero importers.**

```bash
grep -rn "from.*components/Terminal'" src/ --include="*.tsx" --include="*.ts"
# Exclude the Terminal/ subdirectory matches
```

**Step 4: If zero importers, move to archive rather than delete:**

```bash
mkdir -p copernicus/src/renderer/components/_archive
mv copernicus/src/renderer/components/Terminal.tsx \
   copernicus/src/renderer/components/_archive/Terminal.legacy.tsx
```

Add a comment at the top of the archived file:
```typescript
// ARCHIVED 2026-02-25 — Agent log system not yet integrated.
// Retained for reference when implementing Story 113 (agent log terminal mode).
// DO NOT IMPORT — this file is not in the build.
```

---

## Task 5: Delete Empty CommandPalette.tsx

**Step 1: Read `src/renderer/components/CommandPalette.tsx`.**

Confirm it contains only `export {}` or is otherwise empty.

**Step 2: Check all importers.**

```bash
grep -rn "CommandPalette" src/ --include="*.tsx" --include="*.ts"
```

**Step 3: Remove any import statement for it from importing files.**

**Step 4: Delete the file.**

```bash
rm copernicus/src/renderer/components/CommandPalette.tsx
```

---

## Task 6: Delete Orphaned Zustand Stores

### Files to remove:
- `src/store/layoutStore.ts`
- `src/store/copernicusStore.ts`

**Step 1: Confirm no active imports point to these files (you ran this grep in Task 1).**

**Step 2: Read both files** to confirm they are indeed orphaned duplicates of
`src/renderer/store/layout.ts`.

**Step 3: Archive rather than delete** (same pattern as Terminal):

```bash
mv copernicus/src/store/layoutStore.ts \
   copernicus/src/renderer/components/_archive/layoutStore.legacy.ts
mv copernicus/src/store/copernicusStore.ts \
   copernicus/src/renderer/components/_archive/copernicusStore.legacy.ts
```

**Step 4: If `src/store/agentStore.ts` is actively imported by `Terminal/Terminal.tsx`
or any other active file, DO NOT move it.** If it is only used by the archived
root `Terminal.tsx`, move it too.

---

## Task 7: Fix `global.d.ts` IPC Return Type (breaks listener cleanup)

### File: `src/renderer/global.d.ts`

**Step 1: Read the file in full.**

**Step 2: Find the `ipcRenderer.on()` signature.** It currently reads:

```typescript
on(channel: string, func: (event: any, ...args: any[]) => void): void;
```

**Step 3: Change return type to `() => void`:**

```typescript
on(channel: string, func: (event: any, ...args: any[]) => void): () => void;
```

This matches what `preload.ts` actually returns — a cleanup function.

**Step 4: Read `src/renderer/App.tsx` lines 130–150.**

Find the cleanup pattern:
```typescript
const removeViewListener = ipcRenderer.on('layout:set-view', ...)
// ...
return () => {
  removeViewListener()
  removeFlipListener()
  removeSpotListener()
}
```

After the type fix, confirm TypeScript no longer complains about calling
`removeViewListener()`.

---

## Task 8: Fix Unhandled Promise in App.tsx

### File: `src/renderer/App.tsx`

**Step 1: Read the file in full.**

**Step 2: Find the `devtime:status` IPC call in `useEffect` (around lines 76–83).**

It currently looks like:
```typescript
ipcRenderer.invoke('devtime:status').then((res: any) => {
  if (!res.session) {
    setCapexType('start')
    setIsCapexOpen(true)
  } else {
    setActiveSession(res.session)
  }
})
```

**Step 3: Add error handling:**

```typescript
ipcRenderer.invoke('devtime:status')
  .then((res: any) => {
    if (!res || !res.session) {
      setCapexType('start')
      setIsCapexOpen(true)
    } else {
      setActiveSession(res.session)
    }
  })
  .catch((err: unknown) => {
    console.error('[App] devtime:status IPC failed:', err)
    // Non-fatal — app continues without active session
  })
```

**Step 4: Audit the rest of App.tsx for any other `.then()` without `.catch()`.**

Fix each one found with the same pattern.

---

## Task 9: Verify TypeScript Compiles Clean

```bash
cd /Users/dadmin/Projects/agentic-platform/copernicus
npx tsc --noEmit 2>&1
```

Fix any errors introduced by the import path changes or type fixes before committing.

---

## Task 10: Verify App Launches

```bash
npm run dev
```

Open the app. Confirm:
- Chat panel renders (not blank/crashed)
- Layout panels flip correctly
- Terminal opens
- No `Cannot find module` errors in console

---

## Completion Checklist

- [ ] `src/renderer/components/ChatPanel.tsx` deleted; App.tsx imports from `chat/ChatPanel`
- [ ] `src/renderer/components/FlippablePanel.tsx` deleted
- [ ] `src/renderer/components/Terminal.tsx` archived to `_archive/`
- [ ] `src/renderer/components/CommandPalette.tsx` deleted
- [ ] `src/store/layoutStore.ts` and `copernicusStore.ts` archived
- [ ] `global.d.ts` `ipcRenderer.on()` returns `() => void`
- [ ] `App.tsx` devtime:status has `.catch()` handler
- [ ] `npx tsc --noEmit` exits 0
- [ ] `npm run dev` launches without module errors

**Commit message:**
```
fix(renderer): remove duplicate components and fix import wiring

- Delete empty ChatPanel.tsx root-level duplicate; fix App.tsx import to chat/ChatPanel
- Delete unused FlippablePanel.tsx root-level duplicate
- Archive unused root Terminal.tsx (agent log system) for future story
- Delete empty CommandPalette.tsx; remove dead import
- Archive orphaned layoutStore.ts and copernicusStore.ts
- Fix global.d.ts ipcRenderer.on() return type from void to () => void
- Add .catch() to devtime:status IPC call in App.tsx
```
