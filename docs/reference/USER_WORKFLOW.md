# COPERNICUS IDE — User Workflow Guide
**Version:** 1.0 | **Date:** 2026-03-01 | **Authority:** Architect

First-time user journey from install to first deployment.

**Assumed setup:**
- Claude Pro ($20/mo) — web account, no API key, session-limited
- Google Student Pro (free) — Gemini + Jules via Google account
- macOS, fresh install

---

## Act 1 — Install & First Launch

### Download & Install
Download the `.dmg`. Drag COPERNICUS to Applications. First launch triggers
macOS Gatekeeper — click Open.

### Splash Screen
A splash screen appears immediately — COPERNICUS logo, version number, and a
loading indicator while the main process initialises (LSP startup, database
connection, workspace scan). This is the only moment the user sees the version
number without navigating to Settings → About.

Once ready, the splash fades and the **Wizard** appears.
The main IDE does not appear yet.

---

## Act 2 — The Wizard

The Wizard is a focused onboarding sequence. The main IDE is hidden until
it completes. **Copernicus** (the guide agent — §7.2 GUIDE tab) is already
active here, greeting the user by name if the system account is readable.

### Step 1 — Providers

Copernicus walks through each provider one at a time. No API keys.
No configuration. Two sign-ins, total.

**Anthropic (Claude):**
> *"Sign in with your Claude account to get started."*

A browser window opens to claude.ai. User signs in with their Claude Pro
email and password (or Google SSO if that's how they registered).
Window closes. Copernicus confirms:
> *"Claude is connected. You're on Claude Pro — I'll keep an eye on your
> session and let you know before you hit the limit."*

**Google (Gemini + Jules):**
> *"One more — your Google account unlocks Gemini for chat and Jules for
> autonomous coding."*

Browser window opens to Google sign-in. User signs in with their student
Google account. Window closes. Copernicus confirms both services.

> *"Gemini and Jules are ready. You can run up to 100 Jules tasks a day
> with 15 at a time — plenty of runway. I'll make sure they're well-specced
> before dispatch."*

**What the user does NOT do:**
- Paste any API key
- Configure base URLs or model IDs
- Open any settings panel

### Step 2 — Workspace

> *"Where's your project? Pick an existing folder or I'll create a new one."*

File picker appears. User selects a folder (or creates one).
Copernicus checks for a git repo — if absent:
> *"No git repo here. Want me to initialise one?"*

One click. Done.

### Step 3 — Quick Tour (skippable)

A 60-second animated overview of the five main areas:
Planner → Editor → Designer → Orchestrator → Reporter.
Narrated by Copernicus. Skip button always visible.

### Step 4 — Launch

> *"You're ready. Let's build something."*

Splash screen fades in, then the main IDE appears for the first time.

---

## Act 3 — First Look

The IDE renders. The user is on the **Planner** view — empty Kanban board,
9 lanes, quiet. Copernicus speaks from the Chat Panel GUIDE tab:

> *"Welcome. Want a 60-second tour before you dive in?"*
> [Skip — take me to the Editor] [Let's go →]

### If Skip
User goes straight to Editor or Planner — their choice. No tour, no nudges.
Copernicus is available in the GUIDE tab whenever needed.

### If Tour
The IDE switches to the **Designer view** — the Canvas loads and runs the
tour as a visual walkthrough. Copernicus narrates each area (Planner, Editor,
Designer, Orchestrator, Command Center) with the Canvas rendering a live
animated preview of each. The user advances at their own pace.

At the end of the tour the Canvas clears and Copernicus asks:
> *"Where do you want to start — writing code or planning a story?"*
> [Editor] [Planner]

User picks one. IDE transitions. Tour marked complete — never shown again.

---

## Act 4 — Planning the First Story

### Creating a Story

The user describes what they want to build — in plain language, in the
chat. Copernicus drafts the story:

> *"Got it — here's a draft story: 'Add user login with Google OAuth'.
> I've written the acceptance criteria. Want to review before I save it?"*

The user reviews inline, edits if needed, confirms.
Story card appears in the **Planning** lane.

### Moving Through Lanes

Copernicus nudges:
> *"This has a UI component — want to sketch it in the Designer before
> handing it to Jules?"*

If yes → user clicks the story card, clicks **Design** in the Touch Bar.
Designer view opens. Canvas is blank. Chat Panel is still there on the right.

---

## Act 5 — Storyboarding in the Designer

The user describes the UI to the chat agent (now Claude, not Copernicus —
guide hands off to the active agent for implementation tasks):

> *"Two buttons centred on screen — Sign in with Google, Sign in with
> GitHub. Logo above."*

Claude places components on the Canvas. The user drags to adjust positions.
The Canvas renders a live preview.

When satisfied, the user flips back to the Planner. Story moves to
**Storyboarding** lane — already done by the agent.

---

## Act 6 — Sprint Planning

Story card is now in **Sprint Planning**.

User opens the Story Drawer (click the card). Sets:
- **Assigned to:** Jules
- **Workflow:** `jules-pr-manager` (pre-built template)

Clicks **→ Jules** button on the card.

Jules session is dispatched. The badge appears:
```
● QUEUED   main
```

The `jules-pr-manager` workflow starts watching in the background.
Story moves to **Development**.

---

## Act 7 — Parallel Work (the Rhythm Begins)

The user doesn't wait for Jules. That's the point.

While Jules works on the OAuth story, the user opens the **Editor** view
and starts on the next story. FileTree on the left, Monaco in the center,
Claude in the Chat Panel on the right.

**The rhythm:**
- Write a bit, ask Claude a question, write more
- Claude has LSP context — it sees diagnostics, symbols, the open file
- `Cmd+S` saves; LSP updates instantly
- The user is never alone in the editor

---

## Act 8 — Checking In (Command Center)

The user hits the **CMD** button in the Touch Bar (or Activity Bar).
**Command Center** opens.

At a glance:
- **Agent Swarms** — Jules: RUNNING, Claude: IDLE
- **Active Tasks** — OAuth story, `jules-pr-manager` workflow, node 3 of 6
- **LSP State** — typescript-language-server running, 4 open files
- **Agent Stalls** — none (green)

The user sees Jules is making progress. No action needed. Back to Editor.

---

## Act 9 — Jules Finishes

The story card badge updates:
```
● DONE   PR #1 → main
```

The `jules-pr-manager` workflow has already:
1. Detected the PR
2. Run a review agent — read the diff, posted review comments
3. Flagged for human approval (confidence below auto-merge threshold)

The card is **amber-highlighted** in the Kanban — it needs the user's
attention.

User clicks the PR link → opens in the browser. Reviews Jules' work.
Looks good. Merges.

Story card moves to **Done**. Lane spotlight collapses the rest.
The board shows one completed story. The first one.

---

## Act 10 — First Deployment

Terminal drawer opens (click the bar at the bottom, or Touch Bar).

User types:
```bash
make deploy
```

Or, if the workflow was configured to auto-deploy on merge — it already
ran. The Command Center shows the deploy task completed.

The feature is live on the Dell R210ii Core.

---

## Act 10 — Sprint Finishing Ceremony

At the end of the sprint, the user triggers the **Sprint Finishing Ceremony** template from the Workflow canvas.

This automated process:
1. Gathers Git commits, performance metrics, and logs for review.
2. Prompts the user to reflect on the sprint's successes and failures.
3. Automatically extracts concrete learning rules and updates `AGENTS.md`.
4. Refreshes core documentation based on codebase changes.
5. Captures fresh screenshots if any UI elements were modified.
6. Automatically creates a Pull Request with all docs and `CHANGELOG.md` updates.

The codebase and its documentation stay in sync, ensuring the next sprint starts without technical debt.

---

## The Daily Rhythm

Once onboarded, the user's day looks like this:

### Morning — Orient
1. Open Command Center — any stalls overnight? Any PRs ready?
2. Scan the Kanban — what moved, what's blocked?
3. Merge any ready PRs from Jules

### Mid-day — Build
1. Editor + Claude — active coding session
2. Dispatch 1–2 stories to Jules (respects the 15/day free tier limit)
3. Designer — UI work if needed, Canvas for visual review

### End of Day — Sweep
1. Command Center — confirm no stalls
2. Planner — move completed stories to Done
3. Check Reporter (CapEx) — token spend, cost summary for the session

---

## Provider Rhythm — Working Within Limits

**Claude Pro (web session, $20/mo):**
- The primary coding and chat agent — active editor work, architecture
  questions, code review
- Session limits are conversation-based, not token counts. Copernicus
  tracks usage and warns before the limit is hit
- When the session limit is reached, Claude gracefully hands off to Gemini
  via the Persona tab — the conversation context snapshots across
  automatically (Story 157). The user notices a divider line in chat,
  nothing more.
- Keep Claude focused: use LSP for code context, `📎` attach for specific
  files — don't paste large blocks into chat manually

**Gemini (Google Student free):**
- The natural fallback when Claude's session limit is hit
- Handles large context windows well — good for broad codebase questions,
  long file analysis, or extended planning conversations
- Also the primary agent for Jules-adjacent tasks (same Google account)
- Switch is seamless via Persona tab; no re-authentication needed

**Jules (Google Student Pro — 100 tasks/day, 15 simultaneous):**
- Generous limits — dispatch freely across the sprint, not just one at a time
- Run multiple stories in parallel: Jules handles several branches
  simultaneously while the user works in the Editor on something else
- Copernicus still gates under-specced dispatches:
  > *"This story doesn't have acceptance criteria yet. Jules works best
  > with clear ACs — want me to help write them first?"*
- The `jules-pr-manager` workflow handles the entire PR loop automatically
- Monitor all active Jules sessions at once in Command Center — Active Tasks
  shows each session, its current node, and elapsed time
- Story card badges update live — no need to check Jules directly

---

## What Copernicus Does Behind the Scenes

The user never sees:
- IPC channel names
- `handleIpc()` envelopes
- LSP startup logs
- Workflow engine state transitions
- Database writes

The user sees:
- Stories moving across the board
- Badge updates on cards
- Amber highlights when something needs attention
- Copernicus speaking in plain language when guidance is needed

The IDE is quiet when things are working. It speaks up when they're not.
