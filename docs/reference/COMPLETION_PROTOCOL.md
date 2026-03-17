# Story Completion Protocol

This document is law. Every story that moves to `docs/stories/completed/` must have passed every gate below. No exceptions.

## The Gate

### 1. TypeScript — zero errors
```bash
cd copernicus && npx tsc --noEmit
```
Must exit clean. Not "only pre-existing errors." Zero.

### 2. Full test suite — all green
```bash
python3 -m pytest backend/tests/
```
Every test must pass. The skipped test (`test_agents_api`) is the only permitted skip and it must remain intentionally marked. No new skips. No changed assertions.

### 3. Build — for any story touching Electron or renderer
```bash
cd copernicus && npm run build
```
Must produce a DMG with no errors.

### 4. AC checklist — Claude reads the diff against every AC
```bash
git diff HEAD  # or diff against base branch
```
Claude reads the story file's `## Acceptance Criteria` and ticks off each item against what is actually in the diff. If an AC is not demonstrated in the diff, the story is not done.

### 5. Only then
- `git commit`
- Set `Status: COMPLETE` in the story file
- Move story file to `docs/stories/completed/`
- Regenerate backlog: `python3 scripts/utils/generate_backlog.py`

---

## What is NOT acceptable

- Moving a story to `completed/` because Gemini said it finished
- Moving a story to `completed/` without running tsc, pytest, and build
- Changing a test assertion to make a red light green
- Skipping a failing test to make the suite pass
- Marking an AC as done without verifying it in the diff
- Committing with TypeScript errors present
- Filing stories in `completed/` with any status other than `COMPLETE`

---

## Story Status Flow

```
DRAFT → APPROVED FOR IMPLEMENTATION → IN PROGRESS → REVIEW → COMPLETE
```

- **IN PROGRESS**: set when dispatched to Gemini
- **REVIEW**: set when Gemini finishes and changes are uncommitted, awaiting Claude gate
- **COMPLETE**: set only after all 4 gate steps pass

---

## Wave Run Verification Sequence

For each completed Gemini session:
1. Run gate steps 1–4
2. If all pass → commit, mark COMPLETE, move to completed/
3. If any fail → send back to Gemini with the exact failure output and the specific ACs not met
4. Do not start a dependent story until its blocker is COMPLETE with a commit hash

---

## Included in Every Gemini Dispatch Prompt

Every prompt sent to Gemini must begin with:

```
DO NOT run any git commands. Do NOT git add, git commit, or git push. Leave changes uncommitted.
```

Claude commits. Gemini implements. Never the reverse.
