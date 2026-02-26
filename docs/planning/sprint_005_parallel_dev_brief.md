# Sprint 005 — Parallelized Development Brief
**Date:** 2026-02-25
**Coordinator:** Gemini (architect/PM)
**Implementers:** Jules (×5 parallel tracks)
**Epic:** 004 — COPERNICUS IDE

---

## ⚠️ PATH CORRECTION — MANDATORY FIRST READ

The project was previously named **BENWAY**. That directory no longer exists.
Every file path in this brief uses `copernicus/`. If your task description, issue
body, or prior context mentions `benway/`, **substitute `copernicus/` and continue**.

| ❌ WRONG | ✅ CORRECT |
|----------|-----------|
| `benway/electron/main.ts` | `copernicus/electron/main.ts` |
| `benway/electron/preload.ts` | `copernicus/electron/preload.ts` |
| `benway/src/renderer/App.tsx` | `copernicus/src/renderer/App.tsx` |
| `copernicus/src/main/` | `copernicus/electron/` |

Do NOT create a `benway/` directory. Do NOT write any file under `benway/`.

---

## Environment Mandate (Read Before Starting Any Track)

Every Jules agent MUST adhere to these non-negotiable standards before writing a
single line of code:

```
Repo root:   /Users/dadmin/Projects/agentic-platform
IDE root:    copernicus/
Node:        Use exact version in copernicus/package.json
TypeScript:  strict mode enforced — npx tsc --noEmit must exit 0
Style:       Tailwind + phosphor aesthetic (--phosphor CSS var, font-mono, dark bg)
IPC:         ALL invoke() calls use useIpcError hook (copernicus/src/renderer/hooks/useIpcError.ts)
FS:          fs-manager returns { ok, data } or { ok: false, error } — check ok before using data
Logging:     Use console.log/warn/error (routed to electron-log in main.ts) — no new log libs
External libs: NO Chart.js, Recharts, fuse.js, or drag-and-drop libs (Pi baseline violation)
Charts:      SVG only (raw SVG elements, no library)
Fuzzy match: Hand-rolled trigram/char scorer (no fuse.js)
```

Read these files FIRST on every track before writing anything:
- `copernicus/electron/preload.ts` (IPC allowlist — add new channels here)
- `copernicus/src/renderer/store/layout.ts` (StoryboardView type — extend for new views)
- `copernicus/src/renderer/App.tsx` (nav pattern, view routing — follow existing style)
- `copernicus/src/renderer/hooks/useIpcError.ts` (use for all invoke() calls)

---

## Dependency Graph

```
Wave 1 (all start simultaneously):
  Track A: Story 125 — R210ii Ollama Service         (infra only, no renderer)
  Track B: Story 124 — Command Palette               (needs commandRegistry, SpotlightContainer)
  Track C: Story 123 — CAPEX Dashboard               (needs devtime-manager, settings-store)
  Track D: Story 121 — Parallel Agent Review Gate    (needs DiffViewer, chat:send IPC)
  Track E: Story 120 — Workflow Canvas               (needs workflow/engine.ts scaffold)

Wave 2 (after Track A merges):
  Story 122 — Codebase Semantic Index                (needs auth-manager Ollama fallback from Track A)
```

---

## TRACK A — Story 125: Dell R210ii Ollama Inference Service

**Assignee:** Jules-A
**Story file:** `docs/stories/story_125_r210ii_ollama_inference_service.md`
**Type:** Infrastructure only — no renderer changes
**Verification:** `npx tsc --noEmit` inside `copernicus/` exits 0

### What to read first
```
copernicus/electron/auth-manager.ts          — resolveOpenAICompatibleKey() method (add Ollama fallback here)
Makefile                                     — find existing deploy targets to place new targets near
.env.example (repo root, if it exists)       — append OLLAMA_BASE_URL
```

### Files to create
1. **`docker-compose.ollama.yml`** at repo root — use exact spec from story Task 1
2. **`scripts/setup_ollama_server.sh`** — executable; pulls `nomic-embed-text`, `qwen2.5:3b`, `phi3:mini`

### Files to modify
3. **`Makefile`** — add `ollama-deploy`, `ollama-status`, `ollama-stop` targets near other deploy
   targets. `core` is the SSH host alias for R210ii. Tab-indented (Makefile requirement).
4. **`copernicus/electron/auth-manager.ts`** — in `resolveOpenAICompatibleKey()`, find the final
   `return null` and INSERT before it:
   ```typescript
   const ollamaUrl = process.env.OLLAMA_BASE_URL
   if (ollamaUrl) {
     return {
       key: 'ollama',
       baseUrl: ollamaUrl.replace(/\/$/, '') + '/v1',
       provider: 'ollama',
       headers: {},
     }
   }
   ```
   Also add `resolveForProvider(provider: 'deepinfra' | 'openai' | 'openrouter' | 'ollama')`
   as a new public method — direct lookup, no chain walking. See story Task 5 for full spec.
5. **`.env.example`** (repo root) — append `OLLAMA_BASE_URL=http://192.168.1.xxx:11434` with comment

### Verification steps
```bash
cd copernicus && npx tsc --noEmit 2>&1 | grep auth-manager  # must produce no output
bash -n scripts/setup_ollama_server.sh                        # syntax check
docker compose -f docker-compose.ollama.yml config            # validate compose file
```

---

## TRACK B — Story 124: Command Palette Overlay (Cmd+P)

**Assignee:** Jules-B
**Story file:** `docs/stories/story_124_command_palette.md`
**Verification:** `npx tsc --noEmit` exits 0; palette opens on Cmd+P

### What to read first
```
copernicus/src/renderer/commands/registry.ts             — Command, CommandContext interfaces; commandRegistry singleton
copernicus/src/renderer/commands/commands.ts             — registered commands (name, description fields)
copernicus/src/renderer/components/layout/SpotlightContainer.tsx  — visual overlay pattern to replicate
copernicus/src/renderer/App.tsx                          — how openFilePath state is set; view routing
copernicus/electron/main.ts                              — find globalShortcut registration pattern
copernicus/electron/preload.ts                           — SEND_CHANNELS / LISTEN_CHANNELS (add layout:open-palette)
```

### Files to create
1. **`copernicus/src/renderer/components/layout/CommandPalette.tsx`**

   Key requirements:
   - Full-screen frosted overlay (`fixed inset-0 bg-black/80 backdrop-blur-sm z-50`)
   - Single `<input>` at top with phosphor glow focus ring (`border-phosphor/60 focus:border-phosphor shadow-[0_0_12px_var(--phosphor)]`)
   - Results grouped: `FILES`, `STORIES`, `COMMANDS`, `AGENTS` — render group header then items
   - Keyboard nav: `↑/↓` moves selection index; `Enter` executes; `Escape` closes
   - Fuzzy scorer — hand-rolled, no fuse.js. Simple character-match score:
     ```typescript
     function score(query: string, target: string): number {
       const q = query.toLowerCase()
       const t = target.toLowerCase()
       if (t.includes(q)) return 1 + (q.length / t.length)
       let qi = 0; let sc = 0
       for (const ch of t) { if (ch === q[qi]) { sc++; qi++ } }
       return qi === q.length ? sc / t.length : 0
     }
     ```
   - File results: call `useIpcError` invoke `'fs:list-dir'` on ROOT_PATH to seed the file list
   - Story results: call `useIpcError` invoke `'stories:list'`
   - Command results: `commandRegistry.suggest(query)` (already available)
   - Agent results: static list matching `AGENT_COMMANDS` from `TerminalTabs` — do NOT import
     TerminalTabs; extract the agent list into a shared constant or pass as prop from App.tsx
   - On file select: call `onFileOpen(path, content, language)` prop — same as FileTree
   - On command select: `commandRegistry.execute('/' + cmd.name, commandContext)` — build
     a minimal `CommandContext` with `appendMessage`, `clearMessages`, `setModel`, `rootPath`
     from App state props
   - On agent select: `window.electronAPI.invoke('terminal:spawn-agent', { agentId })` via
     `useIpcError`

2. Listen for `layout:open-palette` IPC event (from globalShortcut) — when received, open palette
   and optionally pre-filter to `COMMANDS` group if `mode === 'commands'`

### Files to modify
3. **`copernicus/electron/main.ts`** — register globalShortcuts AFTER `app.whenReady()`:
   ```typescript
   globalShortcut.register('CommandOrControl+P', () => {
     mainWindow?.webContents.send('layout:open-palette', { mode: 'all' })
   })
   globalShortcut.register('CommandOrControl+Shift+P', () => {
     mainWindow?.webContents.send('layout:open-palette', { mode: 'commands' })
   })
   ```
   Also unregister in `app.on('will-quit')`: `globalShortcut.unregisterAll()`

4. **`copernicus/electron/preload.ts`** — add `'layout:open-palette'` to `LISTEN_CHANNELS`

5. **`copernicus/src/renderer/App.tsx`** — import `CommandPalette`; add `showPalette` state
   (`useState(false)`); listen for `layout:open-palette` IPC; render `<CommandPalette />` when
   `showPalette` is true, passing `onClose`, `onFileOpen`, `commandContext`, `rootPath` props

### Verification steps
```bash
cd copernicus && npx tsc --noEmit  # exits 0
# Manual: npm run dev → press Cmd+P → palette opens; type a filename → see results; Enter opens in editor
# Manual: Cmd+Shift+P → palette opens pre-filtered to COMMANDS group
```

---

## TRACK C — Story 123: CAPEX Intelligence Dashboard

**Assignee:** Jules-C
**Story file:** `docs/stories/story_123_capex_intelligence_dashboard.md`
**Verification:** `npx tsc --noEmit` exits 0; `devtime:report` IPC returns rows

### What to read first
```
copernicus/electron/devtime-manager.ts          — dev_sessions schema (columns: story_id, component,
                                                   value/hours, capitalizable, date); existing IPC handlers
copernicus/electron/settings-store.ts           — how settings are read (settingsStore.get(key, default))
copernicus/src/renderer/store/layout.ts         — StoryboardView type (add 'capex')
copernicus/src/renderer/App.tsx                 — nav bar rendering pattern; view routing switch/conditional
copernicus/src/renderer/components/CapexModal.tsx  — existing CAPEX UI patterns for consistency
```

### Files to create
1. **`copernicus/src/renderer/components/capex/CapexDashboard.tsx`**

   Key requirements:
   - Read-only analytics view — NO editing (editing is via existing CapexModal)
   - Fetch on mount: `const invoke = useIpcError()` then `invoke('devtime:report')`
   - **Summary row** (4 stat cards, horizontal flex):
     Total CAPEX hrs | Total OPEX hrs | Capitalizable % | Session count
     Cards: `bg-black/40 border border-phosphor/20 p-4 font-mono`
   - **By-story table**: columns — Story ID, Component, Hours, Type (CAPEX/OPEX), Date Range
     Sorted by hours descending. `text-xs font-mono`. Alternate row shading with `odd:bg-white/5`.
   - **Velocity SVG chart** (last 8 weeks, hours per week):
     ```typescript
     // Pure SVG — NO chart library. Example structure:
     <svg viewBox="0 0 400 100" className="w-full h-24">
       <polyline points={weeklyPoints} fill="none" stroke="var(--phosphor)" strokeWidth="1.5" />
       {/* x-axis week labels */}
     </svg>
     ```
     Derive `weeklyPoints` from sessions grouped by ISO week number.
   - **Cost calculator**: read `developerRate` from settings (default 0); `<input type="number">`
     triggers recalculation; display "Total CAPEX cost: $X.XX"; persist rate via
     `invoke('settings:save', { ...currentSettings, developerRate: rate })`
   - **Export CSV button**: build CSV string client-side from the report rows; call
     `invoke('fs:save-file', { path: 'capex-report.csv', content: csvString })`; check `result.ok`
     before showing success toast via `useToastStore`

2. **`copernicus/electron/main.ts`** — add IPC handler:
   ```typescript
   ipcMain.handle('devtime:report', () => {
     // Query dev_sessions grouped by story_id
     // Return: Array<{ storyId, component, totalHours, capitalizable, dateFrom, dateTo }>
     // Use devtimeManager's internal db reference — do NOT open a second SQLite connection
   })
   ```
   The `devtimeManager` singleton is already instantiated in `main.ts`. Add a `getReport()`
   method to `DevtimeManager` class in `devtime-manager.ts` and call it from the handler.

### Files to modify
3. **`copernicus/src/renderer/store/layout.ts`** — extend `StoryboardView`:
   ```typescript
   export type StoryboardView = 'blueprint' | 'studio' | 'engine-room' | 'capex'
   ```
4. **`copernicus/electron/preload.ts`** — add `'devtime:report'` to `SEND_CHANNELS`
5. **`copernicus/src/renderer/App.tsx`** — import `CapexDashboard`; add `capex` nav button
   (use a `BarChart2` or `DollarSign` icon from lucide-react); render `<CapexDashboard />` when
   `activeView === 'capex'`

### Verification steps
```bash
cd copernicus && npx tsc --noEmit  # exits 0
# Manual: open IDE → click CAPEX nav icon → dashboard renders with data or empty state
# Manual: enter developer rate → cost column updates
# Manual: Export CSV → file picker opens → CSV saved
```

---

## TRACK D — Story 121: Parallel Agent Review Gate

**Assignee:** Jules-D
**Story file:** `docs/stories/story_121_parallel_agent_review_gate.md`
**Verification:** `npx tsc --noEmit` exits 0; review fires on Apply when toggle is ON

### What to read first
```
copernicus/src/renderer/components/Editor/DiffViewer.tsx       — current props: original, modified,
                                                                  language, onConfirm, onCancel
copernicus/src/renderer/components/chat/ChatPanel.tsx          — how chat:send is invoked;
                                                                  chat:token IPC listener pattern
copernicus/electron/main.ts                                    — chat:send handler; sessionId usage
copernicus/electron/preload.ts                                 — SEND_CHANNELS / LISTEN_CHANNELS
copernicus/src/renderer/store/layout.ts                        — settings state for toggle persistence
copernicus/electron/db/state-ledger.ts                         — insertIntent() for REVIEW logging
```

### Files to create
1. **`copernicus/src/renderer/components/Editor/ReviewPanel.tsx`**

   Key requirements:
   - Renders two side-by-side review panes: left = Claude, right = Gemini
   - Each pane: agent name badge, streaming text output, verdict badge
   - Verdict badge derived from response text:
     ```typescript
     function inferVerdict(text: string): 'APPROVE' | 'WARN' | 'REJECT' {
       const t = text.toLowerCase()
       if (/\b(reject|incorrect|broken|dangerous|wrong|error)\b/.test(t)) return 'REJECT'
       if (/\b(warn|concern|careful|potential|consider|might)\b/.test(t)) return 'WARN'
       return 'APPROVE'
     }
     ```
     Verdict badge colors: APPROVE=`text-green-400`, WARN=`text-amber-400`, REJECT=`text-red-400`
   - Accepts props: `diff: string`, `onBothComplete: (verdicts: Verdict[]) => void`
   - Fires two parallel `window.electronAPI.invoke('chat:send', ...)` calls on mount:
     - Session IDs: `review-claude-${Date.now()}` and `review-gemini-${Date.now()}`
     - Provider config: Claude session uses `{ provider: 'anthropic' }`,
       Gemini session uses `{ provider: 'google' }`
     - Message: `[REVIEW] Does this diff look correct? List any concerns.\n\n${diff}`
   - Listens on `chat:token` IPC for both session IDs; appends tokens to respective pane
   - When both sessions emit completion (empty token or `done` signal), calls `onBothComplete`
   - Shows a "Skip Review" link that calls `onBothComplete` immediately (user override, AC #5)

### Files to modify
2. **`copernicus/src/renderer/components/Editor/DiffViewer.tsx`** — add:
   - `reviewEnabled?: boolean` prop (passed from App.tsx settings)
   - `reviewSessionIds?: { claude: string; gemini: string }` internal state
   - When `reviewEnabled` and user clicks "Apply Changes": render `<ReviewPanel>` below the diff
     instead of calling `onConfirm()` directly; `onConfirm()` only fires after both reviews
     complete OR user clicks "Skip"
   - "Confirm Apply" button: `disabled={!reviewComplete && reviewEnabled}`
   - Import `ReviewPanel` from `./ReviewPanel`

3. **`copernicus/src/renderer/App.tsx`** — pass `reviewEnabled={settings.reviewEnabled ?? false}`
   to `DiffViewer`

4. **`copernicus/src/renderer/components/settings/SettingsPanel.tsx`** — add toggle:
   ```tsx
   <label className="flex items-center gap-3 font-mono text-xs">
     <input type="checkbox" checked={settings.reviewEnabled ?? false}
       onChange={e => saveSettings({ reviewEnabled: e.target.checked })} />
     Enable parallel agent review before Apply (Claude + Gemini)
   </label>
   ```

5. **`copernicus/electron/db/state-ledger.ts`** — verify `insertIntent()` accepts a `REVIEW`
   type; if not, add it to the intent union type. The IPC handler in `main.ts` should log a
   `REVIEW` intent after both verdicts arrive (pass verdicts as payload JSON).

6. **`copernicus/electron/preload.ts`** — confirm `chat:send` is in `SEND_CHANNELS` and
   `chat:token` is in `LISTEN_CHANNELS` (both should be from Story 112 — verify, don't add
   duplicates)

### Verification steps
```bash
cd copernicus && npx tsc --noEmit  # exits 0
# Manual: Settings → enable "parallel agent review"
# Manual: make an edit in chat → Apply → ReviewPanel appears with streaming text
# Manual: both reviews complete → "Confirm Apply" button activates
# Manual: "Skip Review" link → file written immediately
```

---

## TRACK E — Story 120: Workflow Canvas View

**Assignee:** Jules-E
**Story file:** `docs/stories/story_120_workflow_canvas_view.md`
**Verification:** `npx tsc --noEmit` exits 0; workflow view renders and Run fires engine

### What to read first
```
copernicus/electron/workflow/engine.ts    — WorkflowEngine class: getState(), transition()
copernicus/electron/workflow/states.ts   — WorkflowState type; VALID_TRANSITIONS array
copernicus/electron/main.ts              — existing IPC handlers (add workflow:run, workflow:status)
copernicus/electron/preload.ts           — SEND_CHANNELS / LISTEN_CHANNELS
copernicus/src/renderer/store/layout.ts — StoryboardView type (add 'workflow')
copernicus/src/renderer/App.tsx          — nav pattern; view routing
```

### Architecture decision
**Do NOT use `reactflow` npm package** — it adds ~200KB and violates the Pi performance
baseline. Use a custom SVG canvas with React state. The canvas is a developer-facing
tool (used occasionally), so visual fidelity > interactivity density.

### Files to create
1. **`copernicus/src/renderer/components/workflow/WorkflowCanvas.tsx`**

   Data model (define at top of file):
   ```typescript
   type NodeType = 'agent' | 'tool' | 'decision' | 'trigger'
   interface WFNode {
     id: string; type: NodeType; label: string
     x: number; y: number; state: 'idle' | 'running' | 'done' | 'error'
   }
   interface WFEdge { id: string; from: string; to: string; dataType?: string }
   interface WorkflowGraph { nodes: WFNode[]; edges: WFEdge[] }
   ```

   SVG canvas requirements:
   - `<svg>` fills the view; nodes are `<g>` elements (rect + text); edges are `<line>` or
     `<path>` connecting node centers
   - Node colors by type (phosphor variants):
     agent=`var(--phosphor)`, tool=`#60A5FA`, decision=`#FBBF24`, trigger=`#A78BFA`
   - Node state ring: idle=none, running=pulsing border, done=solid phosphor, error=red
   - Click node to select; drag (mousedown+mousemove) to reposition — update `x, y` in state
   - Click selected node's edge handle → click another node to create an edge
   - "Add Node" toolbar at top: one button per NodeType; click to add at center with generated ID
   - "Run" button: calls `invoke('workflow:run', graph)` via `useIpcError`; on response, starts
     polling `invoke('workflow:status')` every 1s to update node states
   - "Save" button: `invoke('fs:save-file', { path: 'workflow/current.json', content: JSON.stringify(graph) })`

2. **`copernicus/electron/workflow/engine.ts`** — extend `WorkflowEngine` to accept a graph:
   ```typescript
   // Add to WorkflowEngine:
   public async runGraph(
     graph: WorkflowGraph,
     onNodeState: (nodeId: string, state: 'running' | 'done' | 'error') => void
   ): Promise<void> {
     this.transition('RUNNING')
     // Topological sort of graph.nodes by edges
     const sorted = topoSort(graph.nodes, graph.edges)
     for (const node of sorted) {
       onNodeState(node.id, 'running')
       try {
         await this.executeNode(node)
         onNodeState(node.id, 'done')
       } catch {
         onNodeState(node.id, 'error')
         this.transition('FAILED')
         return
       }
     }
     this.transition('COMPLETE')
   }

   private async executeNode(node: WFNode): Promise<void> {
     // MVP: log the node execution; future stories will wire real agent dispatch
     console.log(`[workflow] executing node ${node.id} (${node.type}: ${node.label})`)
     await new Promise(r => setTimeout(r, 500))  // simulate async work
   }
   ```
   Import `WorkflowGraph` and `WFNode` from a shared types file (create
   `copernicus/electron/workflow/types.ts` and re-export from renderer too via
   `src/renderer/types/workflow.ts` — do not import electron types in renderer).

3. **`copernicus/electron/main.ts`** — add IPC handlers:
   ```typescript
   ipcMain.handle('workflow:run', async (_e, graph: WorkflowGraph) => {
     const nodeStates: Record<string, string> = {}
     await workflowEngine.runGraph(graph, (id, state) => { nodeStates[id] = state })
     return { ok: true, nodeStates }
   })
   ipcMain.handle('workflow:status', () => ({
     state: workflowEngine.getState(),
   }))
   ```

### Files to modify
4. **`copernicus/src/renderer/store/layout.ts`** — add `'workflow'` to `StoryboardView`
   (coordinate with Jules-C who also modifies this file — one of them adds both `'capex'`
   and `'workflow'` to avoid a merge conflict)
5. **`copernicus/electron/preload.ts`** — add `'workflow:run'`, `'workflow:status'` to
   `SEND_CHANNELS`
6. **`copernicus/src/renderer/App.tsx`** — add `workflow` nav icon (use `GitBranch` or
   `Workflow` from lucide-react); render `<WorkflowCanvas />` when `activeView === 'workflow'`

### Verification steps
```bash
cd copernicus && npx tsc --noEmit          # exits 0
# Manual: open IDE → click Workflow nav icon → blank canvas renders
# Manual: click "Add Node" → node appears → drag to reposition
# Manual: add 3 nodes → connect with edges → click Run → nodes pulse then turn done
# Manual: Save → workflow/current.json created in ROOT_PATH
```

---

## Wave 2 — Story 122: Codebase Semantic Index (@codebase)

**GATE: Do not start until Track A (Story 125) is merged and `resolveForProvider()` exists in auth-manager.ts.**

**Assignee:** Jules-A (reuse same agent; full context preserved) or Jules-F (fresh)
**Story file:** `docs/stories/story_122_local_codebase_semantic_index.md`
**Verification:** `npx tsc --noEmit` exits 0; `@codebase hello` returns top-5 chunks

### What to read first
```
copernicus/electron/auth-manager.ts          — resolveForProvider() (added in Track A)
copernicus/electron/settings-store.ts        — how to read/write settings; extend with embeddingProviderOrder
copernicus/electron/db/state-ledger.ts       — how the SQLite DB is opened (reuse connection for vector table)
copernicus/src/renderer/components/chat/ChatPanel.tsx  — @file and #story picker UX pattern to replicate
copernicus/src/renderer/components/settings/SettingsPanel.tsx  — existing sections to append Codebase section
```

### New npm dependencies (add to copernicus/package.json)
```json
"sqlite-vec": "^0.1.0",
"@google/generative-ai": "check if already installed from Story 112 — do not duplicate"
```

### Files to create
1. **`copernicus/electron/codebase-indexer.ts`** — background indexer service:
   - `CodebaseIndexer` class with `startIndexing(rootPath)`, `search(query, topK)`, `getStatus()`
   - `getEmbedding(text)` → reads `settings.embeddingProviderOrder` → tries each via `tryProvider()`
   - `tryProvider(provider, text)` — switch on provider key; returns `number[] | null`
   - Stores vectors in `sqlite-vec` table on the state-ledger DB connection (do not open new DB)
   - Chunking: split file content at 200-token boundaries (approx 800 chars); store filepath +
     chunk index + embedding
   - Incremental update: accept a `filePath` arg to re-index a single file

2. **`copernicus/src/renderer/components/chat/CodebaseSearch.tsx`**
   - Triggered when user types `@codebase ` in ChatPanel input
   - Shows a search input (separate from main input); on Enter fires `invoke('codebase:search', query)`
   - Results: list of file chunks with similarity score; click to inject as context chip

### Files to modify
3. **`copernicus/electron/settings-store.ts`** — add `embeddingProviderOrder` to stored schema
   with default `['ollama', 'google', 'deepinfra', 'openai', 'openrouter']`
4. **`copernicus/src/renderer/components/settings/SettingsPanel.tsx`** — add Codebase section
   per Story 122 spec (ordered list with ▲/▼ reorder buttons)
5. **`copernicus/electron/main.ts`** — add IPC handlers:
   - `codebase:index-status` → returns `{ indexing, fileCount, provider }`
   - `codebase:search` → returns top-5 chunks from `indexer.search(query, 5)`
   - `fs:save-file` hook → after successful write, call `indexer.updateFile(filePath)`
6. **`copernicus/electron/preload.ts`** — add `'codebase:index-status'`, `'codebase:search'`
   to `SEND_CHANNELS`; add `'codebase:index-progress'` to `LISTEN_CHANNELS`
7. **`copernicus/src/renderer/components/layout/StatusBar.tsx`** — show indexing status from
   `invoke('codebase:index-status')` polled every 5s

### Verification steps
```bash
cd copernicus && npx tsc --noEmit  # exits 0
# Manual: open IDE with OLLAMA_BASE_URL set → status bar shows "Indexing ollama... N files"
# Manual: wait for completion → status bar shows "Index ready"
# Manual: type "@codebase authentication" → search panel shows top-5 file chunks
# Manual: Settings > Codebase Index → reorder providers → save → re-index uses new order
```

---

## Gemini Coordination Protocol

### Merge conflict prevention
- `layout.ts` StoryboardView: Jules-C and Jules-E BOTH modify this. **Assign to Jules-C only.**
  Jules-C adds both `'capex'` and `'workflow'` in a single PR. Jules-E must wait for that PR
  to merge before submitting, OR target the same branch.
- `preload.ts` SEND/LISTEN_CHANNELS: All tracks add channels. Each track adds only its own
  channels. Gemini reviews all PRs for channel collisions before merging.
- `App.tsx` nav and view routing: Each track adds one nav button and one view. These are
  independent array items / if-branches — low collision risk but review order of nav buttons.

### PR review checklist (Gemini runs before merging each track)
```
[ ] npx tsc --noEmit exits 0
[ ] No new npm packages added without architect approval (exceptions: sqlite-vec for Track F)
[ ] All invoke() calls use useIpcError hook
[ ] fs-manager result.ok checked before using result.data
[ ] No SVG charts replaced with Chart.js/Recharts
[ ] No fuse.js or DnD libraries added
[ ] New IPC channels added to BOTH preload.ts and main.ts (symmetric)
[ ] phosphor CSS var used for color (not hardcoded #4ADE80)
[ ] console.log used for logging (not a new logger)
[ ] Commit message follows conventional commits: feat(scope): description
```

### Priority if bandwidth is limited
If running fewer than 5 parallel agents, execute in this order:
1. Track B (Command Palette) — highest UX impact
2. Track C (CAPEX Dashboard) — business differentiator
3. Track A (Ollama Infrastructure) — gates Wave 2
4. Track D (Review Gate) — high competitive value
5. Track E (Workflow Canvas) — most complex, highest long-term value

## Wave 1 — Implementation (Simultaneous)

| Track | Story | Focus | Implementer | Identity Overlay | Status |
|:---|:---|:---|:---|:---|:---|
| **Track A** | 125 | Dell R210ii Provision | Jules-A | [Standard] | **COMPLETE** |
| **Track B** | 124 | Command Palette (Cmd+P) | Jules-B | [PALETTE 🎨] | **COMPLETE** |
| **Track C** | 123 | CAPEX Dashboard (SVG) | Jules-C | [PALETTE 🎨] | **COMPLETE** |
| **Track D** | 121 | Agent Review Gate | Jules-D | [SENTINEL 🛡️] | **COMPLETE** |
| **Track E** | 120 | Workflow Canvas | Jules-E | [BOLT ⚡] | **COMPLETE** |

---

## Wave 2 — Implementation

| Track | Story | Focus | Implementer | Status |
|:---|:---|:---|:---|:---|
| **Track F** | 122 | Codebase Semantic Index | Jules-A | 🚀 In Progress |

---

## Architect Sign-off

Stories 117 and 126 are confirmed COMPLETE and moved to `docs/stories/completed/`.
All 5 Wave 1 tracks are unblocked. The only merge dependency is Track A → Wave 2.

_— /architect, 2026-02-25_
