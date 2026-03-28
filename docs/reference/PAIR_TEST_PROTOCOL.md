# Pair-Test Protocol

**Purpose:** Walk the live application end-to-end with a human at the keyboard and Claude filing stories for every gap. The output is a clean bug queue + (eventually) a workflow spec certifying the section is shippable.

---

## The Pattern

```
launch → walk arc → find bug → triage → continue → wrap → dispatch
```

**The non-negotiable rule:** Bug-story-fix-test-repeat. If an inline fix takes more than two attempts, stop, file the story, and move on. Never let one bug consume an entire session.

---

## Pre-Session Checklist

```bash
# 1. Verify daemon is running
DAEMON_PIDFILE="/tmp/jules_daemon.pid"
if [ -f "$DAEMON_PIDFILE" ] && kill -0 "$(cat $DAEMON_PIDFILE)" 2>/dev/null; then
  echo "Jules daemon running (PID $(cat $DAEMON_PIDFILE))"
else
  nohup python3 scripts/jules_daemon.py >> /tmp/jules_daemon.log 2>&1 &
  echo $! > /tmp/jules_daemon.pid
fi

# 2. Start app in dev mode with log capture
npm run dev --prefix copernicus > /tmp/copernicus_main.log 2>&1 &

# 3. Confirm main.log renderer forwarding is active
# (app/main.ts should have webContents.on('console-message') forwarder)
```

---

## Session Arc

Walk **USER_WORKFLOW.md** in order. Do not skip sections or reorder.

Current canonical arc:
1. **Splash** — app:ready signal, live status
2. **Wizard Step 1** — provider selection + CLI auth
3. **Wizard Step 2** — workspace picker + git validation
4. **Wizard Step 3** — project selection / new project
5. **Wizard Confirm** — finish, handoff to IDE
6. **IDE entry** — file tree, header, workspace context loaded
7. **Kanban / Planner** — boards load, no overlay flash
8. **Genesis scaffold** — new project scaffold runs
9. **Settings** — walk each section
10. **Intelligence View**
11. **Terminal**
12. **Chat panels**

Mark each section PASS / FAIL / PARTIAL in session notes. Only write a workflow spec for sections that reach PASS.

---

## Bug Triage During Session

**Fix inline (continue immediately):**
- Single-file, 1–5 line change
- Root cause is obvious
- No risk of breaking other surfaces
- First attempt only — if the fix doesn't work, file and move on

**File a story (continue after filing):**
- Multi-file change
- Root cause requires investigation
- First inline attempt failed
- Requires UI redesign or new IPC channel
- Anything touching frozen surfaces

**Defer entirely:**
- Out-of-scope feature requests
- Product direction questions that need stewing
- Anything where the right answer isn't obvious

---

## Filing a Story Mid-Session

Keep it fast — don't let story filing break the pair-test rhythm.

Minimum required fields (validator will reject without these):
```markdown
**Status:** DRAFT

## Story Number
{NNN}

## Narrative
As a / I want / So that

## Context
Root cause, observed behavior, why it matters.

## Acceptance Criteria
1. Numbered, testable, specific

## Files in Scope
- path/to/file.tsx — what changes

## Frozen Surfaces
- Everything not in Files in Scope

## Definition of Done
- [ ] Behavioral test
- [ ] tsc --noEmit passes with zero errors

## Blocks:
## Blocked By:
```

Do **not** set status to APPROVED or dispatch during the session. File, move on, dispatch at wrap-up.

---

## Session Wrap-Up Protocol

**Order matters:**

1. **Check git log before dispatching anything:**
   ```bash
   git log origin/main --oneline --grep="story.NNN"
   ```
   If a commit exists for a story, mark it COMPLETE and skip dispatch. Re-dispatching already-implemented stories has burned real money twice.

2. **Mark story files for everything confirmed merged:**
   ```bash
   sed -i '' 's/\*\*Status:\*\* .*/\*\*Status:\*\* COMPLETE/' docs/stories/story_NNN_*.md
   ```

3. **Approve stories for dispatch in priority order:**
   - P0 first (app unusable)
   - P1 (major regression, core workflow broken)
   - P2 (UX/polish, non-blocking)
   - Leave DRAFT anything that needs design review or has unresolved blockers

4. **Validate dispatch readiness for each story:**
   ```bash
   # jules_assign.sh validator requires ALL of:
   # - ## Story Number section with actual number
   # - ## Blocks: and ## Blocked By: (with colons)
   # - ## Definition of Done section
   # - All file paths in Files in Scope must exist on disk
   # - Status: APPROVED FOR IMPLEMENTATION
   ```

5. **Push before dispatching:**
   ```bash
   git add docs/stories/ && git commit -m "chore(stories): approve dispatch queue" && git push origin main
   ```

6. **Dispatch in parallel (background):**
   ```bash
   bash scripts/jules_assign.sh docs/stories/story_NNN_*.md
   # Use run_in_background: true — dispatch all at once
   ```

7. **Verify daemon is watching:**
   ```bash
   python3 scripts/jules_daemon.py --status
   ```

---

## What Produces a Workflow Spec

A workflow spec is written by Jeremy **after** a section reaches PASS — not before, not during. It is the acceptance record that the section works end-to-end.

A workflow spec contains:
- Step-by-step walkthrough (doubles as end-user documentation)
- Expected system behavior at each step
- Known edge cases and how they're handled
- Any CLI timing or performance data observed
- Failure modes and recovery

Workflow specs live in `docs/reference/` alongside this document.

---

## Anti-Patterns (Learned the Hard Way)

| Anti-pattern | What happened | Rule |
|---|---|---|
| Chasing one bug through multiple inline attempts | AuthCliWidget PTY race — 3 attempts, broke detection flow, wasted session time | Two attempts max, then file and move on |
| Dispatching before checking git log | 578 and 579 re-dispatched when already merged | Always `git log --grep` before any dispatch |
| Filing stories without `## Definition of Done` | 6 dispatches failed validation in one batch | DoD is required — add to every story at filing time |
| Approving and dispatching during the session | Breaks rhythm, story may be superseded by later findings | File during, dispatch at wrap-up only |
| Conflating "agent reports complete" with "verified working" | Multiple stories marked done that weren't | Pair-test is the only verification that counts |

---

## Current Pair-Test Status

| Section | Status | Workflow Spec | Notes |
|---------|--------|---------------|-------|
| Splash | PARTIAL | No | Passes, minor status copy issues |
| Wizard Step 1 (providers) | PARTIAL | No | Auth flow needs story 580 |
| Wizard Step 2 (workspace) | PASS | No | Advisory git warning working |
| Wizard Step 3 (project) | PASS | No | |
| Wizard Confirm → IDE | PARTIAL | No | workingDir race fixed (578) |
| IDE entry / workspace switch | PARTIAL | No | Story 581 dispatched |
| Kanban / Planner | PARTIAL | No | Overlay flash fixed |
| Terminal | FAIL | No | Input broken (582), phantom tab (583) |
| Chat panels | FAIL | No | Send blocked by LSP preflight (585) |
| Settings → Skills | PASS | No | IPC fix deployed (586) |
| Settings → Templates | PARTIAL | No | Inline editor + content (587) |
| Settings → Providers | PARTIAL | No | Provider parity (588) pending |
| Intelligence View | PARTIAL | No | Close button fixed; product direction TBD |
| Genesis scaffold | Not tested | No | |
| Memory Browser | Not tested | No | |
| Retro system | Not tested | No | |
| CAPEX / cost tracking | Not tested | No | |
