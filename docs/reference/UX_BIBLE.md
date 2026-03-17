# COPERNICUS IDE — UX/UI Design Bible
**Version:** 1.0 | **Date:** 2026-03-01 | **Authority:** Architect

This document is the authoritative specification for every visual surface and
interaction in COPERNICUS IDE. All agents implementing UI stories must read
this document in full before writing a single line of JSX. Deviations require
an explicit architect decision recorded in the story.

---

## 0. Agent Modification Protocol — MANDATORY

**The single most common source of regression is an agent rewriting an existing
component without preserving its current visual state.**

### Rules for modifying existing JSX/TSX files

1. **Read the full current file before writing any code.** Not a summary — the
   actual file. Every className, every layout div, every prop.

2. **Identify in-scope lines first.** From the story ACs, determine the exact
   lines/blocks you will add or change. Write them down before touching the file.

3. **Every out-of-scope line is frozen.** If a line is not explicitly required
   by a story AC, its content — including all Tailwind classes, element type,
   props, and children — must be preserved exactly. Do not reformat, reorder,
   or "clean up" anything not in scope.

4. **className strings are atomic.** Never remove a class from an existing
   className. If adding classes, append to the existing string. If a className
   is not in scope, copy it character-for-character.

5. **Layout structure is frozen unless the story explicitly changes it.** Do
   not add, remove, or change wrapper divs, flex/grid containers, or padding on
   elements not listed in the story scope.

6. **Check the story's `## Frozen Surfaces` section.** Any surface listed there
   is a hard freeze — touching it is a blocking defect regardless of what the
   story ACs say.

### Failure mode this prevents

An agent tasked with "add a button to panel X" reads the story, writes the
button correctly, but in the process reformats the JSX, drops a `border-b` from
an unrelated div, or swaps `text-zinc-400` for `text-zinc-500`. The button
works. The visual regression ships. A follow-up story costs half a day.

**This is the pattern we are eliminating. Read → identify scope → freeze
everything else → implement only scope.**

---

## 1. Application Shell

### 1.1 Window Frame

COPERNICUS is a **frameless macOS Electron window** (no native title bar).
macOS traffic light (stoplight) buttons are rendered by the OS at the top-left.

**Non-negotiable rules:**
- The `<header>` element MUST have `pl-20` (80px left padding) at minimum on
  macOS to clear the stoplight buttons. Never use `pl-0`, `pl-2`, or any value
  less than `pl-16` in the header.
- Nothing in the header may overflow or wrap. Header height is fixed at `h-10`
  (40px). Content must fit within this height at all viewport widths ≥ 900px.
- The activity bar (left column) begins below the stoplight zone. Its top
  padding is `pt-8` minimum.

### 1.2 Overall Layout

```
┌──┬──────────────────────────────────────────────────────────────┐
│LO│ HEADER  h-10          [view tabs]              [right zone]  │
│GO├──────────────────────────────────────────────────────────────┤
│  │                                                               │
│A │              CENTER PANEL (flex-1)                            │
│C │                                                               │
│T │                                                               │
│I ├──────────────────────────────────────────────────────────────┤
│V │ TERMINAL DRAWER (collapsible)                                 │
│  ├──────────────────────────────────────────────────────────────┤
│B │ STATUS BAR  h-6  (pinned to window bottom)                   │
│A └──────────────────────────────────────────────────────────────┘
│R │
└──┘
```

The **activity bar column is full-height** and owns the top-left corner. The
macOS stoplight buttons (⬤⬤⬤) overlay the top of this column — the
logo/brand mark sits below them. The header begins to the **right** of the
activity bar and carries no stoplight clearance padding.

**Dimensions:**
| Zone | Height/Width | Notes |
|---|---|---|
| Activity bar | `w-12` full height | Top slot = Logo; stoplights overlay top corner |
| Logo/Brand slot | `h-10` at top of activity bar | Aligns with header row height |
| Header | `h-10`, fills width minus activity bar | No `pl-20` needed |
| Status bar | `h-6` | Pinned to window bottom, full width |
| Terminal drawer | collapsible, `h-60` open | Sits above status bar |
| Center panel | `flex-1` | Fills remaining space |

### 1.3 Header Anatomy

```
[Activity Bar w-12] | [View Tabs (center)] ... [Right Controls]
```

**Left zone:** none — the activity bar column occupies this space.
Header starts immediately right of the activity bar.

**Center zone — View navigation tabs:**
- One tab per `StoryboardView`: Planner, Editor, Designer, Orchestrator, Reporter, Command
- Active tab: `bg-copernicus-phosphor text-[#050505] rounded-none` (§1.4 VT block)
- Inactive: `text-zinc-500 hover:text-zinc-300`
- Tabs must NOT overflow the header. If they would wrap, use icon-only on small sizes.

**Right zone:**
- Git branch indicator (text, read-only)
- Review mode toggle
- NO settings gear — settings live in the activity bar (bottom icon)

**Forbidden from header:**
- Settings gear icon (moved to activity bar in Story 159)
- Any button that performs a destructive or navigation action
- Overflow content of any kind
- `border-b-2 border-copernicus-phosphor` underline as sole active indicator (use §1.4 VT block instead)

### 1.4 Active Selection Style — VT Terminal Block

All active/selected states in the activity bar and header navigation use a
**solid filled rectangle** — the VT terminal selection block pattern.

**Rules:**
- Background: `bg-copernicus-phosphor` (solid, no opacity modifier)
- Text/icon: `text-[#050505]` (inverted — deep black on phosphor)
- Shape: rectangular, `rounded-none` (no border radius)
- Coverage: the entire button/tab label row — not just the icon or a dot
- Hover (inactive): `text-zinc-500 hover:text-zinc-300`

**Forbidden:**
- `bg-copernicus-phosphor/10` (tinted ghost) for active state
- `border-b-2 border-copernicus-phosphor` underline as sole active indicator
- Rounded corners on active selection blocks
- Active indicator that covers less than the full label area

### 1.5 Activity Bar

Left column, `w-12`, full height. All icons are `size={18}`, `p-2` padding.

**Top group (primary views):**
```
FolderOpen    → sets view 'planner'
Monitor       → sets view 'editor'
Cpu           → sets view 'designer'
GitBranch     → sets view 'orchestrator' (label: Orchestrator, shortcut ⌘4)
BarChart2     → sets view 'reporter'    (label: Reporter, shortcut ⌘5)
Activity      → sets view 'command-center' (label: Telemetry, shortcut ⌘6)
Brain         → sets view 'memory'      (label: Agent Memory, shortcut ⌘7)
```

**Bottom group (pinned):**
```
Github        → sets view 'github'
Settings      → opens SettingsPanel modal (setSettingsOpen true)
```

**Grouping rule:** All navigational views — including Telemetry and Agent Memory — belong in the top group. The bottom group is reserved for settings and external links only. Do not move Telemetry or Agent Memory to the bottom group.

**Icon states (§1.4 VT selection block):**
- Active view: `bg-copernicus-phosphor text-[#050505] rounded-none`
- Inactive: `text-zinc-500 hover:text-zinc-300 rounded`
- All transitions: `transition-colors`

**Forbidden:**
- Tooltips that require hover-delay longer than 300ms
- Icons that navigate without updating `activeView` in layout store
- Any icon below Settings in the bottom group

### 1.6 Status Bar

Fixed `h-6` strip at bottom (above terminal drawer when open).
Background: `bg-black/80 border-t border-white/5`

**Left section:** Git branch · Story ID · Active model
**Center:** Timer (HH:MM:SS for current session)
**Right:** Token count · Cost · LSP status indicator

All text: `text-[10px] font-mono text-zinc-500`
LSP indicator: green dot when running, grey when stopped.

---

## 2. Views

### 2.1 Editor (default)

> Store view ID: `'editor'` — display name is **Editor**.

**Layout:** Three-column split — FileTree | Monaco Editor | Chat

```
┌──────────┬─────────────────────┬──────────────┐
│ FileTree │ Monaco Editor       │ Chat Panel   │
│ w-56     │ flex-1              │ w-80         │
└──────────┴─────────────────────┴──────────────┘
```

Panel maximize/minimize is bidirectional — see §3.1 Spotlight for the
system-wide spec.

### 2.2 Designer

> Store view ID: `'designer'` — display name is **Designer**.
> Touch Bar: **Design** button navigates here.

**Layout:** Canvas (full center) + Chat Panel (right, `w-80`).

**Sidebar Auto-Collapse (Story 209):** When entering the Designer view, the FileTree sidebar MUST automatically collapse to its bookmark strip. This maximizes the visual workspace for the Canvas. The sidebar can be manually restored by clicking its bookmark strip.

The Designer view hosts **the Canvas** — the unified graphic surface for all
visual work. The Canvas is not a single component; it is a rendering context
that hosts whatever graphic content is active:

- **UI Builder** — drag-and-drop component composition (default / no file open)
- **Image render** — image files from FileTree loaded as canvas assets
- **Playwright frame** — browser instance for video, PDF, HTML, live web content
- **Agent canvas output** — UI components generated by agents via `canvas:execute-js`

All of the above share the same `centerMode: 'canvas'` — the Canvas itself
determines what to render based on the active content type. There is no
separate mode per content type at the router level.

The Chat Panel sits to the right, providing agent assistance in context —
the agent can see and manipulate the canvas directly.

### 2.3 Planner

> Store view ID: `'planner'` — display name is **Planner**.

**Layout:** Full-width Kanban board.

No left panel, no right panel. Kanban fills 100% of the center. Story drawer
slides in from the right as an overlay (not a column).

### 2.4 Reporter

> Store view ID: `'reporter'` — display name is **Reporter**.

**Layout:** Full-width CapEx Dashboard.

Report tabs fill the full width of the view before any vertical scroll is
introduced. Tabs must NOT wrap or scroll horizontally before the viewport is
< 700px.

### 2.5 Orchestrator

> Store view ID: `'orchestrator'` — display name is **Orchestrator**.

**Layout:** Workflow canvas fills center. Inspector panel overlays right edge
as a floating panel (not a separate column) when a node is selected.

**Sidebar Auto-Collapse:** Like the Designer view, the FileTree sidebar MUST automatically collapse when entering the Orchestrator.

**Toolbar (Story 212):** The Save / Reset / Run toolbar lives in a `sticky top-0` strip **inside the Workflow view**, NOT in the main header. It MUST be horizontally centered and have a background blur (`backdrop-blur-md bg-black/40`) to remain legible over complex graphs. It must never overflow the canvas or float outside its bounding box.

---

## 3. Panel System

### 3.1 Spotlight (Panel Maximize/Minimize)

**System-wide rule:** When any panel is maximized it expands in **both**
directions, consuming the space of every surrounding panel. Each collapsed
neighbour leaves behind a narrow **bookmark strip** on the expanded panel's
edge so the user can restore it. This is the canonical interaction for
maximize/minimize everywhere in the app.

**Bidirectional collapse by panel position:**

```
LEFT-MOST panel maximized (e.g. FileTree):
┌──────────────────────────────┬▐▐┬▐▐┐
│ FileTree  (expanded)         │  │  │
│                              │Ed│Ch│  ← right-side bookmarks
└──────────────────────────────┴──┴──┘

CENTER panel maximized (e.g. Monaco Editor):
┌▌┬─────────────────────────────────┬▐┐
│ │ Monaco Editor (expanded)        │ │
│F│                                 │C│  ← one bookmark each side
└─┴─────────────────────────────────┴─┘

RIGHT-MOST panel maximized (e.g. Chat):
┌▌┬▌┬──────────────────────────────────┐
│ │ │ Chat Panel (expanded)            │
│F│E│                                  │  ← left-side bookmarks
└─┴─┴──────────────────────────────────┘
```

**Bookmark strip:** `w-6`, full panel height, sits flush against the expanded
panel's edge. Contains the collapsed panel's icon (or first letter) rotated
90°. Click restores that panel and returns the expanded panel to normal width.

**Store state:** `spotlightPane: PaneId | null`

**PaneId values:**
```
'explorer'   → FileTree
'editor'     → Monaco Editor
'telemetry'  → Telemetry/right panel
'chat'       → Chat Panel
'kanban'     → Kanban board
'workflow'   → Workflow canvas
```

**Every panel that supports spotlight MUST have:**
1. A header button with `Maximize2` icon → `setSpotlight('paneId')`
2. When spotlighted, same button shows `Minimize2` → `setSpotlight(null)`
3. Button wiring: `onClick={() => setSpotlight(spotlightPane === 'paneId' ? null : 'paneId')}`
4. Collapsed neighbours render only their bookmark strip (no content, `pointer-events-none` on content, bookmark strip remains interactive)

**Panels that currently support spotlight and must have wired buttons:**
- FileTree → `'explorer'`
- MonacoEditor → `'editor'`
- ChatPanel → `'chat'`
- WorkflowCanvas → `'workflow'`

**Forbidden:**
- Spotlight that collapses panels to `width: 0` with no bookmark remnant
- Spotlight that only expands in one direction (e.g. always toward center)
- Spotlight button with empty `onClick={()=>{}}`
- Hardcoded widths that ignore the spotlight state

### 3.2 Flip (FlippablePanel) — Conditional Animation

`FlippablePanel` supports two transition modes selected via a `mode` prop:

| Mode | Animation | Use when |
|---|---|---|
| `'flip'` | `rotateY` 3D card flip | Back face contains NO `<webview>` |
| `'slide'` | `translateX` from right | Back face contains a `<webview>` |

**Why conditional:** `<webview>` elements punch through `rotateY` / CSS 3D
perspective transforms regardless of `z-index`. Use `'slide'` whenever a
webview is present; use `'flip'` everywhere else for the full card-flip effect.

**`'flip'` mode (default for non-webview panels):**
- `rotateY(0deg)` → front face visible
- `rotateY(180deg)` → back face visible (`rotateY(-180deg)` on back to read correctly)
- `perspective: 1200px`, `transform-style: preserve-3d`
- `backface-visibility: hidden` on both faces

**`'slide'` mode (required when back face has `<webview>`):**
- Container `w-[200%]`, `translateX(0)` → front; `translateX(-50%)` → back
- Secondary view enters from right, primary exits left

**Store state:** `isFlipped: { sidebar: boolean; chat: boolean }`

**Chat Panel — mode: `'flip'`:**
- Primary face: Chat messages + input
- Secondary face: Chat Tools panel — tabbed (see §7.2)

**Forbidden:**
- `rotateY` on any panel whose back face contains a `<webview>` — use `'slide'`
- `FlippablePanel` with no `mode` prop when a webview is present (default is `'flip'`)
- FlippablePanel used without a real secondary face (no placeholder divs)

**Jules Panel — NOT a FlippablePanel:**
- The `terminal-jules` tab renders a `<webview>` directly — no dual-face wrapper.
- See §10.2 for full Jules tab spec.

### 3.3 Panel Headers

Every panel with a title MUST have a consistent header:

```
┌─────────────────────────────────────────────────┐
│ [Icon] PANEL TITLE                [icon buttons] │  h-8, px-3
└─────────────────────────────────────────────────┘
```

**Spec:**
- Height: **`h-8` (32px)** — canonical across all panels. Do not use `h-9` or `h-10`.
- Padding: `px-3`
- Border: `border-b border-white/5`
- Background: `bg-black/20`
- Title: `text-[10px] font-bold uppercase tracking-widest text-zinc-400`
- Icon buttons: `p-1 rounded hover:bg-white/10 text-zinc-500 hover:text-copernicus-phosphor transition-colors`
- Icon size: `size={11}` for inline controls, `size={14}` for primary actions

**Icon opacity:** All panel header icon buttons must be visible at rest at **60% opacity minimum** (`opacity-60`), transitioning to 100% on hover (`hover:opacity-100`). Do not use `opacity-0` with group-hover reveal — icons must always be discoverable.

**All icon buttons must have `title` attributes** for accessibility.

---

## 4. Kanban Board

### 4.1 Swimlane Specification

Nine lanes in this exact order:

| # | Label | Status ID | Color Token | Accent Token |
|---|---|---|---|---|
| 1 | Planning | `PLANNING` | `bg-slate-500/10 border-slate-500/30` | `bg-slate-500` |
| 2 | Storyboarding | `STORYBOARDING` | `bg-purple-500/10 border-purple-500/30` | `bg-purple-500` |
| 3 | Sprint Planning | `SPRINT_PLANNING` | `bg-indigo-500/10 border-indigo-500/30` | `bg-indigo-500` |
| 4 | Development | `IN_PROGRESS` | `bg-yellow-500/10 border-yellow-500/30` | `bg-yellow-500` |
| 5 | Testing | `TESTING` | `bg-orange-500/10 border-orange-500/30` | `bg-orange-500` |
| 6 | QA | `QA` | `bg-amber-500/10 border-amber-500/30` | `bg-amber-500` |
| 7 | Documenting | `DOCUMENTING` | `bg-cyan-500/10 border-cyan-500/30` | `bg-cyan-500` |
| 8 | Ready to Build | `READY` | `bg-teal-500/10 border-teal-500/30` | `bg-teal-500` |
| 9 | Done | `COMPLETE` | `bg-green-500/10 border-green-500/30` | `bg-green-500` |

**These lane definitions are canonical and must not be changed without an
architect decision.** They live in `DEFAULT_COLUMNS` in `layout.ts`.

**Lane intent:**
- **Planning** — Intake and onboarding of epics/stories; triage and initial scope before handoff to Storyboarding. If the user engages the Designer view for UX work, stories move from here into Storyboarding.
- **Storyboarding** — Story authoring: writing ACs, UX sketches, arch notes
- **Sprint Planning** — Groomed stories being sized, assigned, and scheduled
- **Development** — Active implementation (IN_PROGRESS)
- **Testing** — Unit/integration/e2e tests being written or run
- **QA** — Human review, smoke testing, regression checks
- **Documenting** — Docs, CHANGELOG, API reference updates
- **Ready to Build** — Approved, fully specced, queued for next sprint pickup
- **Done** — Shipped and verified

### 4.2 Column Anatomy

```
┌────────────────────────────────────┐
│ [Archive Toggle bar]                │  always visible above lanes (h-~28px)
├────────────────────────────────────┤
│ [Archive expand section — optional]│  conditional, max-h-48, scrollable
├────────────────────────────────────┤
│ [accent bar h-0.5]                  │
├────────────────────────────────────┤  ← per column below
│ COLUMN LABEL  [+ Story][+ Epic] [N]│  h-9 header — Planning column has dual-action buttons
├────────────────────────────────────┤
│                                    │
│  [creation form — Planning only]   │  appears when form phase active
│  [story card]                      │  flex-1 scroll
│  [story card]                      │
│                                    │
├────────────────────────────────────┤
│  [+ New Story]  (Ready to Build)   │  footer — only Ready to Build column
└────────────────────────────────────┘
```

**Archive bar:** Always rendered above the swim lane grid. Clicking toggles an inline archive section (in-memory state, not persisted). The archive section renders a read-only list of `ARCHIVED` stories via `stories:list` with status filter.

**CRUD entry points:**
- **New Story / New Epic:** Dual-action buttons in the Planning column header (`+ Story` / `+ Epic`). Clicking opens an inline creation form inside the Planning column. Form submits via `stories:create` IPC.
- **New Story (Ready to Build):** Footer button in the Ready to Build column — legacy entry point, opens creation form in Planning column.
- No modal dialogs — all creation is inline in the Planning column.

**Column header:** Label + story count only. No rotate or minimize buttons.
Columns do not have manual collapse controls — spotlight is card-driven (see §4.3).

**Collapsed state (auto, via card spotlight):**
- Width: `w-10` (40px)
- Label: vertical text via `writingMode: 'vertical-rl', transform: 'rotate(180deg)'`
  (inline style — `vertical-text` is not a valid Tailwind class)
- Click collapsed column: clears spotlight, returns all columns to normal width

### 4.3 Story Card Anatomy

```
┌────────────────────────┐
│ [P0] STORY-123         │  priority badge + ID
│ Story title here       │  font-medium text-sm
│                        │
│ [Epic]   [Model badge] │  metadata row
│ [⚡ workflow-name]      │  assigned workflow (if any)
│ [→Jules] (if APPROVED) │  Jules dispatch button
└────────────────────────┘
```

Cards are draggable between columns (native HTML5 DnD — no external library).

**Card spotlight — auto-collapse lanes:**
Clicking a card spotlights its parent lane. All other lanes collapse to `w-10`
bookmark strips. The spotlighted lane expands to fill the freed space (`flex-1`).
Clicking any collapsed lane strip clears the spotlight and restores all columns.

This replaces manual column minimize/rotate buttons entirely. The board responds
to where the user's attention is, not to explicit column management actions.

**Store state:** `spotlightLane: string | null` — stores the column `id` of the
spotlighted lane. Separate from `spotlightPane` which governs panel spotlight.

**Future — Chat frame inside spotlighted card:**
When a lane is spotlighted, the active card may expand to reveal an inline chat
frame bound to that story (`panelId: 'story:<id>'`). This allows the user to
converse with an agent about the story in context — ACs, arch questions, scope —
without leaving the Kanban board. Planned as a future story; no implementation
required until explicitly scheduled.

### 4.4 Jules Session Badge

Appears on a story card when a Jules session has been dispatched for that story.
Replaces the `→ Jules` dispatch button once a session exists.

```
┌─────────────────────────────┐
│ ● RUNNING   branch-name     │  status dot + label + branch
│ [⎋ PR #42 → main]           │  PR link (when available)
└─────────────────────────────┘
```

**Status dot colors:**

| Status | Dot | Label |
|---|---|---|
| `pending` | `bg-zinc-400 animate-pulse` | QUEUED |
| `running` | `bg-yellow-400 animate-pulse` | RUNNING |
| `completed` | `bg-green-400` | DONE |
| `failed` | `bg-red-400` | FAILED |

**PR link:**
- Shown only when `pr_url` is present on the session record
- Format: `PR #<pr_number> → <base_branch>`
- Click: `invoke('app:open-external', pr_url)` — opens in system browser
- Never opened inside the app or a webview

**Dispatch button → badge transition:**
- Card renders `→ Jules` button when story status is `APPROVED FOR IMPLEMENTATION`
  and no Jules session exists for that `story_id`
- Once dispatched, the button is replaced by the badge — no both-visible state

**Data source:** `jules_sessions` table via `jules:get-session` IPC, polled
every 30s while status is `pending` or `running`. Poll stops on
`completed` or `failed`.

**Badge also appears in Story Drawer (§4.5)** with the same visual spec but
full-width, showing the full branch name and a copyable PR URL.

### 4.5 Story Drawer

Slides in from the right as an overlay (not a separate column). Opens when a
card is clicked. Shows full story detail, status controls, assigned-to, Jules
session badge.

**Must NOT close** when user clicks inside the drawer. Closes only on:
- Explicit close button (X)
- Clicking the backdrop

### 4.6 Card Workflow Assignment

Any story card can have a **workflow assigned to it**. The assigned workflow is
executed by the card's assigned agent when triggered. This connects the Kanban
board directly to the Workflow Canvas engine (§5).

**Card display:**
- Assigned workflow shown as `[⚡ workflow-name]` chip on the card
- Chip is phosphor-tinted when a workflow is assigned, muted when none
- Click chip → opens workflow in Workflow Canvas (sets `activeWorkflowTemplate`)

**Assignment:**
- Set in Story Drawer via a `<select>` populated from `workflow:list-templates`
- Stored as `workflowId: string | null` on the story record
- Any saved workflow graph can be assigned — templates or custom

**Execution:**
- Trigger button in Story Drawer: `▶ Run Workflow`
- Calls `workflow:run` IPC with `{ workflowId, context: { __storyId, __storyTitle } }`
- The assigned agent on the story becomes the default agent node context
- Workflow status updates appear in the card's Jules session badge area

**Jules PR Management workflow:**
The primary built-in use case. When Jules is active in the IDE for a story,
assign the `jules-pr-manager` workflow template to the card. This workflow:
- Polls the Jules session for PR creation (`jules:get-session`)
- On PR ready: runs review agent node (reads diff, posts review comments)
- On review pass: triggers merge or flags for human approval based on
  confidence threshold
- On failure: posts diagnostic to the story's chat context (`panelId: 'story:<id>'`)

This workflow runs headlessly via the WorkflowEngine — the user does not need
to be on the Workflow Canvas view. Status is visible directly on the card.

**Forbidden:**
- Workflow execution that bypasses `workflow:run` IPC and `handleIpc()` wrapper
- Hardcoding the Jules PR workflow — it must be a selectable template like any other
- Running a workflow without a `__storyId` in the context bag

---

## 5. Workflow Canvas

### 5.1 Node Types

| Type | Visual | Description |
|---|---|---|
| `trigger` | Rounded rect, blue border | Entry point — manual or event-based |
| `agent` | Rounded rect, phosphor border | LLM agent with provider/model/persona |
| `tool` | Square rect, zinc border | Shell command or makefile target |
| `decision` | Diamond shape | Branch on condition (exit code, human approval) |
| `flow` | Pill shape | Sub-workflow reference |

**Node states:**
- `idle` — zinc border, grey label
- `running` — phosphor border, pulsing ring
- `complete` — green border, checkmark
- `failed` — red border, error message below node
- `skipped` — dashed border, reduced opacity

### 5.2 Inspector Panel

Floating overlay on right edge when a node is selected. NOT a separate column.
Width: `w-72`. Has its own header with node type icon and "Inspector" label.

**Fields editable in inspector:**
- Agent: provider, modelId, persona, systemPrompt, task, outputChannel
- Tool: command/target
- Decision: condition type
- Trigger: variant
- Bound to Story: editable `<select>` (NOT read-only text)

The inspector must not steal focus from the canvas. Use `tabIndex={-1}` on
the canvas SVG element so inspector inputs retain focus when the user clicks
inside the inspector after clicking the canvas.

### 5.3 Toolbar

The Save / Reset / Run toolbar lives in a `sticky top-0 z-10` strip at the
top of the workflow view, inside the workflow view's scroll container. It must
**never** be placed in the main app header, must **never** overflow the canvas,
and must remain visible at all scroll positions within the workflow view.

```
[Graph name (editable)]        [RESET] [SAVE] [▶ RUN]
```

---

## 6. Command Center

> Store view ID: `'command-center'` — display name is **Command**.
> Activity bar icon: `Activity` (Lucide)

**Layout:** Full-width dashboard. No sidebar, no chat panel.

The Command Center is the operator's view of all active work in the IDE —
agent swarms, tool calls, MCP usage, LSP state, running workflows, and stalled
agents. It is the single pane of glass for overseeing and intervening in
autonomous activity.

```
┌─────────────────────────────────────────────────────────────┐
│  AGENT SWARMS          │  ACTIVE TASKS                       │
│  [agent card]          │  [task row — story + workflow]      │
│  [agent card]          │  [task row]                         │
├────────────────────────┼────────────────────────────────────┤
│  MCP USAGE             │  LSP STATE                          │
│  [server · calls · ms] │  [server · status · open files]    │
├────────────────────────┴────────────────────────────────────┤
│  AGENT STALLS          (amber highlight when present)        │
│  [agent · last action · elapsed · [⚡ Retry]  [✕ Kill]]      │
└─────────────────────────────────────────────────────────────┘
```

**Sections:**

- **Agent Swarms** — All agents currently dispatched: persona, model, provider,
  status, last output line. Clicking an agent card opens its chat context.
- **Active Tasks** — Stories with running workflows or Jules sessions: story ID,
  assigned workflow, current node, elapsed time.
- **MCP Usage** — Each registered MCP server: call count, avg latency, last
  called timestamp. Dim when idle, phosphor-tinted when active.
- **LSP State** — Language server status per workspace: running/stopped, open
  file count, last diagnostic count.
- **Agent Stalls** — Any agent producing no output for > 60s surfaces here with
  amber highlight. `⚡ Retry` re-dispatches; `✕ Kill` terminates the session.

**All data is live-pushed via IPC events — no polling from the renderer.**
Engine pushes: `command:agent-update`, `command:task-update`,
`command:mcp-update`, `command:lsp-update`, `command:agent-stall`.

**State:** Dedicated `useCommandStore` (Zustand) scoped to this view only.
Do NOT mix Command Center state into the main layout store.

**Forbidden:**
- `setInterval` or any renderer-side polling for Command Center data
- Stall detection in the renderer — stall events are pushed from the engine
- Merging Command Center state into `useLayoutStore`

---

## 7. Chat Panel

### 6.1 Front Face (Chat)

```
┌────────────────────────────────────┐
│ CHAT   [model badge]  [↻] [⤢] [□] │  h-9 header
├────────────────────────────────────┤
│                                    │
│  [message thread]                  │  flex-1 scroll
│                                    │
├────────────────────────────────────┤
│ [📎] [textarea          ] [SEND ↵] │  input row
└────────────────────────────────────┘
```

**Header buttons (all must be wired):**
- `↻` (RotateCcw) → `toggleFlip('chat')` — flips to Chat Tools back face
- `⤢` (Maximize2/Minimize2) → `setSpotlight(spotlightPane === 'chat' ? null : 'chat')`
- `□` (Layout) → opens UIBuilder canvas

**File attach button (`📎`):**
- `onClick` opens a file picker via `invoke('fs:open-file')`
- Attaches file content to the next message as context

**LSP context (always active):**
- The Chat Panel requires an active LSP session — code intelligence (diagnostics,
  symbols, hover info) is always available to the chat agent regardless of which
  file is open or attached

**File attach button (`📎`):**
- Opens a file picker via `invoke('fs:open-file')`
- Selected file becomes the active file context for the chat agent
- Attaches file content to the next message

### 7.2 Chat Tools (Back Face)

The back face of the Chat Panel is a **tabbed tools pane** — four tabs
selectable without flipping back to chat first. Flip button (`↻`) toggles
between front and back; active tab persists across flips.

```
┌──────────────────────────────────────────────────┐
│ [CONTEXT] [PERSONA] [PROMPTS] [HISTORY] [GUIDE]  │  tab row h-8
├──────────────────────────────────────────────────┤
│                                                  │
│  [tab content]                                   │  flex-1 scroll
│                                                  │
└──────────────────────────────────────────────────┘
```

**Tab: CONTEXT**
What the model is currently seeing — token budget bar, system prompt (read-only),
injected memories (list with unpin buttons), attached file (if any), conversation
turn count. Answers "what context is the agent working with right now?"

**Tab: PERSONA**
Inline editor for the active persona: system prompt textarea, model selector,
temperature slider. Changes apply to the next message sent — no Settings modal
needed. "Save as Persona" button persists changes.

**Tab: PROMPTS**
Saved prompt templates for this panel context. Click a prompt → pastes into
the chat input on the front face (auto-flips back). User can save the current
input as a template. Organised by tag (refactor / review / explain / story / etc.)

**Tab: HISTORY**
Searchable archive of prior conversations for this `panelId`. Each entry shows
date, model used, first message preview. Click an entry → loads it as context
into the current conversation (uses Story 157 snapshot restore). "Pull snippet"
copies a selected exchange into the current input.

**Tab: GUIDE**
An agent-guided configuration assistant embedded directly in the panel. The
guide agent is context-aware — it reads the current IDE state (configured
providers, active model, workspace root, active story, LSP status) and uses
this to give relevant, specific help rather than generic documentation.

Use cases:
- **Onboarding** — walks a new user through provider setup, API keys, first
  story creation step by step, applying changes via IPC as the user confirms
- **Settings config** — "set up Anthropic for me" → agent calls `settings:save`
  with the correct payload after prompting for the key
- **Feature explanation** — "what does the workflow engine do?" → answers in
  context of the user's current workspace and active stories
- **Troubleshooting** — "my LSP isn't working" → agent inspects
  `lsp:status` IPC, diagnoses, suggests or applies the fix inline

The guide agent has **write access to settings via IPC** (`settings:save`,
`auth:set-api-key`, etc.) but must confirm with the user before applying any
change. Confirmation is an inline `[Apply]` / `[Cancel]` chip — not a modal.

The guide agent persona is **`Copernicus`** — the IDE introduces itself.
A distinct persona from `senior_dev`, focused on IDE knowledge, configuration,
and user onboarding rather than code generation. The name appears in the chat
header when this tab is active: `COPERNICUS` in phosphor, replacing the
standard model badge.

**Tab state:** `chatToolsTab: 'context' | 'persona' | 'prompts' | 'history' | 'guide'`
stored in layout store, persisted.

**Flip back:** `↻` button present on back face header alongside the active
tab label. Clicking always returns to the chat front face.

### 6.3 Model Badge

Displays the active model (`claude-sonnet-4-6`, `gemini-1.5-pro`, etc.).
Clicking opens the model picker. Never hardcoded — always reads from
`models:active` IPC.

---

## 7. File Tree

### 7.1 Interaction Model

Every file row is **clickable**. Clicking a file row:
1. Reads the file via `invoke('fs:read-file', path)`
2. Sets `activeFilePath`, `activeFileContent`, `activeFileLanguage` in layout store
3. Sets `centerMode` to `'code'` (or `'image'`/`'binary'` based on `classifyFile()`)

**`centerMode` classification via `classifyFile(path)` (Story 150):**
- `'code'` — any text/source file → Monaco Editor
- `'canvas'` — all graphic/visual content → the Canvas (Designer view §2.2);
  the Canvas renders based on content type:
  - Images (`.png .jpg .jpeg .gif .svg .webp .ico`) → canvas asset
  - Video/rich media (`.mp4 .mov .webm .pdf .html`) → Playwright frame inside canvas
  - No file → UI builder
  - Agent output → `canvas:execute-js` render
- `'binary'` — non-renderable: `.dmg .iso .exe .zip .tar .gz` → BinaryBlocker

**The Canvas is the unified graphic surface** — UI builder, file render,
Playwright frame, and agent output all live here. `'code'` and `'canvas'`
are the only two `centerMode` values.

**Directory rows:** Expand/collapse on click. No file open.

**Empty state:** "No workspace selected" with a button to `invoke('app:set-root-path')`.

### 7.2 Visual

- File rows: `h-7 px-2 flex items-center gap-1.5 hover:bg-white/5 cursor-pointer rounded`
- Selected file: `bg-copernicus-phosphor/10 text-copernicus-phosphor`
- Icons: `size={13}` Lucide icons matching file type

---

## 8. Monaco Editor

### 8.1 Visual Spec

- Theme: `vs-dark` — hardcoded, applied synchronously in `onMount` to prevent
  flash of unstyled content (FOUC)
- Font: `'Fira Code', 'Cascadia Code', monospace` — declared in editor options
- Font size: reads `fontSize` from layout store
- Line numbers: `on`
- Minimap: disabled by default (too noisy)
- Word wrap: `off`
- Bracket pair colorization: `on`

### 8.2 Keyboard Shortcuts

- `Ctrl+S` / `Cmd+S` → `invoke('fs:save-file', { path, content })`
- Must be registered via `editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, ...)`

### 8.3 Spotlight Header

The Monaco editor container must have a panel header with:
- Title: current filename (basename of `activeFilePath`)
- Spotlight button (Maximize2/Minimize2)
- Save button (only shows when content is modified)

---

## 9. Settings Panel

### 9.1 Entry Point

Settings icon lives at the **bottom of the activity bar**, NOT in the header.
Clicking toggles `settingsOpen` boolean in App.tsx state.

### 9.2 Modal Spec

```
Fixed overlay: inset-0, bg-black/60 backdrop-blur-sm, z-[200]
Modal: w-[720px] h-[80vh], centred, bg-[#0D0D0D]
```

### 9.3 Navigation Rail (Left)

11 sections in order:
1. Providers (⚡)
2. Appearance
3. Models
4. Personas
5. Git / GitHub
6. Workflow
7. MCP
8. Playwright
9. Tools
10. Accessibility
11. Templates

---

## 10. Terminal

### 10.1 Tab System

Terminal tabs live in a drawer at the bottom of the app. Each tab is a PTY
session with an ID and label. Tab types:

| ID | Label | Type |
|---|---|---|
| `terminal-local` | Local | Standard PTY |
| `terminal-claude` | Claude | Agent PTY |
| `terminal-jules` | Jules | JulesPanel (webview) |
| `terminal-{uuid}` | (label from spawn) | Ephemeral PTY |

### 10.2 Jules Panel

The `terminal-jules` tab renders a `<webview>` pointing to `https://jules.google.com`
**directly** — no FlippablePanel, no dual-face wrapper, no slide animation.

- `partition="persist:jules"` for persistent Google session auth
- The webview IS the full interaction surface — no CLI PTY shell
- No flip button, no rotate button — the webview fills the tab area entirely
- Agents use `canvas:execute-js` / `browser:evaluate` IPC for DOM automation
- PR links open via `app:open-external` (not inside the webview)

### 10.3 GitGuard

The terminal write path checks for `git push`, `git remote add`, `git config *user*`.
If detected, it prompts for confirmation. The UI shows a confirmation chip in
the terminal tab, not a native dialog.

---

## 11. Color System

### 11.1 Phosphor Presets

| Key | Label | Hex | Usage |
|---|---|---|---|
| `green` | Green | `#4ADE80` | Default |
| `amber` | Amber | `#FBBF24` | Warning mode |
| `white` | White | `#F4F4F5` | High contrast |
| `blue` | Blue | `#60A5FA` | Focus mode |

The active phosphor color is `phosphorColor` in layout store. It flows through
CSS variables: `--copernicus-phosphor: {hex}`.

Tailwind class `text-copernicus-phosphor` and `bg-copernicus-phosphor` are
available everywhere.

### 11.2 Base Palette

```
Background:   #0A0A0A  (body)
Surface:      #0D0D0D  (panels, modals)
Border:       white/5  (borders between panels)
Text primary: zinc-300 (#D4D4D8)
Text muted:   zinc-500 (#71717A)
Text dim:     zinc-600 (#52525B)
```

### 11.3 Priority Badges

| Priority | Class |
|---|---|
| P0 | `bg-red-500/20 text-red-400` |
| P1 | `bg-orange-500/20 text-orange-400` |
| P2 | `bg-yellow-500/20 text-yellow-400` |
| P3 | `bg-zinc-500/20 text-zinc-400` |

---

## 12. Typography Standards

| Use case | Class |
|---|---|
| Panel title | `text-[10px] font-bold uppercase tracking-widest text-zinc-400` |
| Body text | `text-sm text-zinc-300` |
| Code / mono | `font-mono text-xs text-zinc-300` |
| Muted label | `text-[10px] text-zinc-600` |
| Active/accent | `text-copernicus-phosphor` |
| Badge text | `text-[9px] font-bold uppercase tracking-wider` |

---

## 13. Empty States

Every panel and view must have a defined empty state. Empty states must never
be a blank white or grey box.

| Panel/View | Empty State |
|---|---|
| FileTree | "No workspace selected" + Open Folder button |
| Monaco Editor | Dim placeholder "Select a file to edit" |
| Chat | "Start a conversation" placeholder message |
| Kanban | Columns still render; each column shows 0 count |
| Workflow canvas | "No workflow loaded" + template picker |
| CapEx | Dashboard with zero values and empty charts |

---

## 14. Error States

Errors must never surface as raw Electron error strings (e.g.,
`"Error invoking remote method 'foo': Error: ..."` in a React render).

- IPC errors are caught by `useIpcError` hook and displayed in a toast or
  inline error element
- Empty `try/catch` blocks that swallow errors are **forbidden**
- Agent errors in Workflow nodes turn the node border red and show
  `WorkflowNodeStatus.error` message below the node

---

## 15. Touch Bar (macOS only)

Layout (left to right):

```
[Plan][Edit][Design][Orch][Report][CMD] | [COMMIT][BUILD][TEST] | [FLIP][SPOT]
         View buttons                          Command tray          Toggle buttons
```

**View buttons** (left group) — one per `StoryboardView`:

| Label | View ID | Icon hint |
|---|---|---|
| Plan | `planner` | Kanban |
| Edit | `editor` | Monaco |
| Design | `designer` | Canvas — UIBuilderCanvas, the UI view |
| Orch | `orchestrator` | Workflow |
| Report | `reporter` | CapEx |
| CMD | `command-center` | Activity / pulse |

- Active view button: `backgroundColor` set to phosphor color (§1.4 VT block equivalent)
- Pressing any view button sends `layout:set-view` → listener in `App.tsx` `useEffect`

**Command tray** (center group):
- `COMMIT`, `BUILD`, `TEST` — spawn ephemeral PTY tabs via `createEphemeral()`

**Toggle buttons** (right group):
- `FLIP` → `layout:toggle-flip` — flips the active flippable panel in the current view
- `SPOT` → `layout:toggle-spotlight`

**Telemetry push:** `telemetry:update-touchbar` with
`{ storyId, timer, view, gitBranch, capexTotal }` — updates active view
highlight and any dynamic labels.

---

## 16. Interaction Principles

1. **Every button must do something.** No `onClick={() => {}}`. If a feature
   is not yet implemented, the button is not rendered — never a no-op.

2. **Hover reveal pattern:** Use `opacity-0 group-hover/X:opacity-100` for
   controls that appear on hover. Do NOT use `overflow-hidden max-w-0` inside
   an `overflow-hidden` parent — it clips pointer events.

3. **Focus management:** When the user interacts with an inspector or form
   inside a canvas-adjacent panel, the canvas must not recapture focus. Use
   `tabIndex={-1}` on SVG/canvas elements that should not hold focus.

4. **No inline placeholders in production:** Text like `CANVAS_PREVIEW_ACTIVE`
   or `TODO: implement` must not appear in rendered JSX. Either the feature
   renders or it renders nothing.

5. **Consistent transitions:** All panel transitions use `transition-all
   duration-300`. Icon hover transitions use `transition-colors`. Do not mix
   or omit transition declarations on interactive elements.
