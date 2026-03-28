# AGENTS.md — {{projectName}}

## Project
{{idea}}

**For:** {{audience}}
**Core value:** {{coreValue}}
**Stack:** {{stack}}

## Role Boundaries
- Plan → Delegate → Review
- Do not implement inline when a story can be dispatched
- Use the cloud agent or Jules for single-concern TS/React stories.

## Dispatch Protocol
- Run `bash scripts/jules_assign.sh docs/stories/story_NNN_*.md` for isolated TS/React stories.
- Run `gemini -p "$(cat /tmp/prompt.md)" --approval-mode yolo` from a worktree for multi-file implementations.

## Completion Protocol
- **`tsc` Gate**: `npx tsc --noEmit` must pass with zero errors.
- **`pytest` Gate**: The test suite must pass without failures.
- **AC Verification**: All Acceptance Criteria from the story must be met.

## Story Format Requirements
Stories must include:
- Status
- Priority
- Assigned To
- Blocks/Blocked By (with colons)
- Acceptance Criteria

## Key IPC Channels (Stub)
- (Add project-specific IPC channels here as they are developed)

## Key Constraints
- Follow IPC error handling standard (handleIpc + useIpcError + unwrapIpc)
- No secrets in committed files
- Run tsc --noEmit before marking story complete

## Stories
Stories are in `docs/stories/`. Completed stories move to `docs/stories/completed/`.
