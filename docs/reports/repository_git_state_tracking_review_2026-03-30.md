# Repository and Git State Tracking Review

**Date:** 2026-03-30
**Scope:** Copernicus IDE - Complete codebase analysis of repository and git state tracking mechanisms

---

## Executive Summary

The Copernicus IDE implements a multi-layered repository and git state tracking system that spans the frontend (Zustand stores), backend (Electron main process), IPC layer, and persistent storage (SQLite + JSON). This review documents how repository state is captured, synchronized, and propagated throughout the application.

---

## 1. State Storage Architecture

### 1.1 Frontend State (Zustand Stores)

**File:** `copernicus/src/renderer/store/layout.ts` (lines 122-124, 152-154, 295-297)

The primary frontend state store tracks:
- `workingDir: string` - Current workspace directory path
- `gitBranch: string` - Current git branch (default: 'main')
- `isGitDirty: boolean` - Whether working tree has uncommitted changes

```typescript
// From layout.ts lines 295-297
workingDir: '',
gitBranch: 'main',
isGitDirty: true,

// Actions
setWorkingDir: (dir) => set({ workingDir: dir }),
setGitBranch: (branch) => set({ gitBranch: branch }),
setGitDirty: (dirty) => set({ isGitDirty: dirty }),
```

**Persistence:** State is persisted via Zustand's `persist` middleware with name `'copernicus-layout-storage'`.

### 1.2 Backend State (Electron Main)

**File:** `copernicus/electron/settings-store.ts`

The `SettingsStore` class persists to `copernicus-settings.json` in the user's app data directory:
- `workspace?: string` - Active workspace path
- `recentProjects?: { name: string; path: string; lastOpened: string }[]` - Recent project history

**File:** `copernicus/electron/stories.ts`

The `StoriesManager` tracks:
- `projectRoot: string` - Root of the current project
- `storiesPath: string` - Path to `docs/stories` folder

**File:** `copernicus/electron/worktree/WorktreeManager.ts`

Manages agent worktrees with SQLite persistence:
- `repoRoot: string` - Repository root path
- `worktreesDir: string` - Path to `.agent-worktrees` subdirectory
- Database table: `agent_worktrees` with fields: id, branch, story_id, node_id, worktree_path, status, merge_mode, commit_sha, commit_count

### 1.3 Database State (SQLite)

**File:** `copernicus/electron/db/state-ledger.ts`

The StateLedger SQLite database tracks:
- `projects` table - Project paths and metadata
- `stories` table - Story records with file paths
- `agent_worktrees` table - Worktree state
- `workflow_snapshots` table - Workflow state linked to git SHAs
- `agent_memory` table - Memory entries tied to projectId
- `agent_work_log` table - Work logs with projectId

---

## 2. Git State Tracking Mechanisms

### 2.1 Git Status Polling

**File:** `copernicus/src/renderer/components/layout/StatusBar.tsx` (lines 78-99)

The StatusBar polls git state every 5 seconds:

```typescript
useEffect(() => {
  const pollGit = async () => {
    try {
      const branchRes = await invoke('git:current-branch')
      const branch = unwrapIpc<string>(branchRes as any) ?? 'unknown'

      const statusRes = await invoke('git:status')
      const status = unwrapIpc<any[]>(statusRes as any) ?? []

      const isDirty = status.length > 0

      useLayoutStore.getState().setGitBranch(branch)
      useLayoutStore.getState().setGitDirty(isDirty)
    } catch (e) {
      // Ignore polling errors
    }
  }

  pollGit()
  const interval = setInterval(pollGit, 5000)
  return () => clearInterval(interval)
}, [invoke])
```

### 2.2 Git Panel Component

**File:** `copernicus/src/renderer/components/git/GitPanel.tsx`

The GitPanel displays:
- File status list with staging/unstaging
- Diff viewer for selected files
- Branch selector via `BranchSelector` component
- Open Pull Requests from GitHub
- Commit interface

State is refreshed via `refresh()` function after operations (lines 32-45).

### 2.3 Git Handlers (IPC)

**File:** `copernicus/electron/ipc/git-handlers.ts`

Available git operations:
- `git:check-repo` - Check if path is inside a git worktree
- `git:init-repo` - Initialize a new git repository
- `git:status` - Get working tree status (porcelain format)
- `git:stage` / `git:unstage` - Stage/unstage files
- `git:commit` - Create commits with message
- `git:current-branch` - Get current branch name
- `git:list-branches` / `git:branches` - List branches
- `git:checkout` / `git:new-branch` - Branch operations
- `git:diff-file` - Get diff for specific file
- `github:list-prs` - List open pull requests

All handlers use `cwd()` derived from `settingsStore.get<string>('workspace')` (line 12).

### 2.4 Git Security Guard

**File:** `copernicus/electron/security/git-guard.ts`

The `GitGuard` class provides:
- Hard block on destructive commands (`push --force`, `remote add`, `config user`)
- Interactive confirmation for `git push` commands
- Security audit integration via `security_audit.py`
- Session-based allowlist for approved commands

---

## 3. Workspace/Repository Switching

### 3.1 Workspace Switch Handler

**File:** `copernicus/electron/ipc/app-handlers.ts` (lines 215-242)

The `app:switch-workspace` handler:
1. Validates path exists
2. Checks for `.git` directory (logs warning if missing)
3. Updates recent projects list
4. Sets `workspace` and `workingDir` in settings
5. Updates `fsManager` root path
6. Updates `storiesManager` project root
7. Triggers codebase indexing
8. Restarts LSP for new workspace
9. Notifies renderer via `app:workspace-changed` event

### 3.2 Root Path Handler

**File:** `copernicus/electron/ipc/app-handlers.ts` (lines 365-382)

The `app:set-root-path` handler:
- Updates settings store
- Sets FS manager root
- Sets stories manager project root
- Starts codebase indexing
- Restarts LSP
- Auto-initializes git if not present
- Broadcasts `app:workspace-changed` to all windows

### 3.3 Frontend Workspace Reset

**File:** `copernicus/src/renderer/store/layout.ts` (lines 229-232, 451-458)

The `resetForWorkspaceSwitch` action clears:
- `openFiles: []`
- `activeFilePath: null`
- `activeView: 'planner'`
- `isSessionEnded: false`
- Increments `workspaceKey` to trigger re-mounts

---

## 4. Worktree Management

### 4.1 Worktree State Tracking

**File:** `copernicus/electron/worktree/WorktreeManager.ts`

The WorktreeManager tracks agent worktrees:
- Stores worktrees in `.agent-worktrees/{branch}`
- Database persistence with status: `active`, `completed`, `merged`, `failed`
- Polls every 30 seconds for commit activity
- Automatically merges `yolo` mode worktrees on completion

### 4.2 Worktree Handlers

**File:** `copernicus/electron/ipc/worktree-handlers.ts`

IPC channels:
- `worktree:list` - List all worktrees
- `worktree:create` - Create new worktree
- `worktree:diff` - Get diff vs main
- `worktree:merge` - Merge worktree
- `worktree:remove` - Remove worktree
- `worktree:poll` - Trigger polling

### 4.3 Worktree Store

**File:** `copernicus/src/renderer/store/worktreeStore.ts`

Frontend Zustand store for worktree state with interface:
- `worktrees: AgentWorktree[]`
- `activeCount`, `completedCount`, `mergedCount`
- `create`, `refresh`, `remove`, `merge` actions

---

## 5. Snapshot and Recovery System

### 5.1 Workflow Snapshots

**File:** `copernicus/electron/workflow/snapshot-manager.ts`

The `SnapshotManager` captures workflow state with git context:
- Captures current git SHA with each workflow snapshot
- Validates SHA format: `/^[0-9a-f]{40}$/`
- `rewind()` method checks for dirty working tree before checkout
- Prevents rewind if uncommitted changes exist

---

## 6. Memory and Work Logging

### 6.1 Memory Service

**File:** `copernicus/electron/memory/memoryService.ts`

The `MemoryService` tracks work with project context:
- `addMemory()` - Stores events tied to `projectId`
- `logWork()` - Logs work events with `projectId` and `bankId`
- Triggers retrospective check on `session_start` events

### 6.2 Git Commit Logging

**File:** `copernicus/electron/ipc/git-handlers.ts` (lines 50-72)

On commit, the system:
1. Executes git commit
2. Retrieves commit SHA via `git rev-parse HEAD`
3. Gets changed files via `git diff-tree`
4. Logs work via `memoryService.logWork()` with:
   - `eventType: 'git_commit'`
   - `meta: { sha, message, files }`

---

## 7. IPC Channel Registry

### 7.1 Git-Related Channels

**File:** `copernicus/electron/preload.ts` (lines 71-72, 80-81)

SEND_CHANNELS includes:
- `git:status`, `git:stage`, `git:unstage`, `git:commit`
- `git:branches`, `git:checkout`, `git:new-branch`, `git:diff-file`
- `github:list-prs`
- `git:current-branch`, `git:list-branches`
- `worktree:list`, `worktree:create`, `worktree:diff`, `worktree:merge`, `worktree:remove`, `worktree:poll`

LISTEN_CHANNELS includes:
- `worktree:completed`, `worktree:merged`
- `app:workspace-changed`

### 7.2 Security Channels

- `security:git-push-request` - Listen for push confirmation requests
- `security:git-push-response` - Send push confirmation decisions

---

## 8. Stories and Project Association

### 8.1 Stories Manager

**File:** `copernicus/electron/stories.ts`

The `StoriesManager`:
- Sets project root on initialization
- Watches `docs/stories` folder for changes
- Syncs stories from disk to SQLite on file changes
- Broadcasts `stories:updated` events to renderer
- `isRepoTargeted()` returns `storiesPath !== ''`

### 8.2 Story Status Changes

Story status transitions trigger:
- Security audit on `COMPLETE` status
- Documentation generation on `DOCUMENTING` status
- Archive to `docs/stories/completed/` folder
- Broadcast `story:status-changed` events

---

## 9. Key Observations

### 9.1 Synchronization Patterns

1. **Bidirectional Sync:** Frontend polls git state every 5s; backend broadcasts changes via IPC
2. **Event-Driven:** Workspace changes trigger cascade of updates (indexing, LSP, UI reset)
3. **Database-First:** Stories and worktrees use SQLite as source of truth, files as secondary

### 9.2 State Redundancy

The same repository state exists in multiple locations:
- `SettingsStore.workspace` (JSON file)
- `StoriesManager.projectRoot` (in-memory)
- `FSManager.rootPath` (in-memory)
- `layoutStore.workingDir` (Zustand + localStorage)
- SQLite `projects` table

### 9.3 Security Considerations

1. **Path Validation:** `assertSafePath()` used before file operations
2. **Git Guard:** Blocks destructive commands, requires confirmation for push
3. **Shell Injection Prevention:** Validation on branch names and file paths
4. **Audit Trail:** Security audit runs before story completion

### 9.4 Potential Gaps

1. **No Atomic State Updates:** Workspace switch involves multiple independent updates
2. **Polling Overhead:** 5-second git polling may be excessive for large repos
3. **No Git State Versioning:** No history of branch/dirty state changes
4. **Limited Conflict Detection:** No handling for concurrent workspace modifications

---

## 10. File Summary

| Category | Key Files |
|----------|-----------|
| Frontend State | `copernicus/src/renderer/store/layout.ts` |
| Frontend Store | `copernicus/src/renderer/store/worktreeStore.ts` |
| Git UI | `copernicus/src/renderer/components/git/GitPanel.tsx` |
| Status Bar | `copernicus/src/renderer/components/layout/StatusBar.tsx` |
| IPC Preload | `copernicus/electron/preload.ts` |
| Git Handlers | `copernicus/electron/ipc/git-handlers.ts` |
| App Handlers | `copernicus/electron/ipc/app-handlers.ts` |
| Worktree Handlers | `copernicus/electron/ipc/worktree-handlers.ts` |
| Settings Store | `copernicus/electron/settings-store.ts` |
| Stories Manager | `copernicus/electron/stories.ts` |
| Worktree Manager | `copernicus/electron/worktree/WorktreeManager.ts` |
| Snapshot Manager | `copernicus/electron/workflow/snapshot-manager.ts` |
| Memory Service | `copernicus/electron/memory/memoryService.ts` |
| Git Guard | `copernicus/electron/security/git-guard.ts` |
| Database | `copernicus/electron/db/state-ledger.ts` |

---

*Report generated by codebase-memory-exploring skill and manual file analysis*
