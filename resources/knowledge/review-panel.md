# Agent Review Panel

When an agent completes implementation, the Review Panel shows the full diff for human verification.

## Features

- **Monaco diff editor** — Side-by-side or unified view of all changes
- **Out-of-scope detection** — Changes outside the story's declared scope are flagged in yellow
- **Inline type check** — Streams `npx tsc --noEmit` output directly in the panel. Pass/fail shown inline.
- **One-click actions** — Approve & Close, Request Rework, View PR

## Reviewing a Story

1. Agent completes work → story moves to **Review** lane in Kanban
2. Click the story → Review Panel opens with the diff
3. Check for out-of-scope changes (highlighted)
4. Verify the type check passes (shown inline)
5. **Approve** — merges changes, moves story to Done
6. **Request Rework** — sends feedback back to the agent with the diff context

## Ghost Implementation

Before changes land on disk, they appear as low-opacity Monaco decorations (ghost edits). Accept or reject individual blocks or all at once. This lets you preview agent suggestions without committing to them.
