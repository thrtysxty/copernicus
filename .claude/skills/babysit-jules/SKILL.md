---
name: babysit-jules
description: Use after dispatching a Jules session to monitor its PR lifecycle — poll status, detect failures, retry on flaky CI, and merge when green. Replaces manual Jules session watching.
---

# babysit-jules

Monitors an active Jules session through to merge.

## What to do

1. Get the Jules session ID from the dispatch output or `jules:list-sessions` IPC
2. Poll `jules:story-sessions` every 2 minutes for status changes
3. When Jules opens a PR, switch to polling the PR via `gh pr view <number> --json state,statusCheckRollup`
4. On CI failure: inspect the failing check, determine if it's flaky, retry once with `gh pr comment <number> --body "/retry"`
5. On persistent failure: summarise the failure, report to user, do NOT auto-merge
6. On all checks green + approved: merge with `gh pr merge <number> --squash --delete-branch`
7. After merge: run `git pull` on main, update the story status to COMPLETE via `stories:set-status`

## Failure escalation rules

- Flaky (same check failed then passed in <10min): retry once silently
- Build error (tsc / pytest): stop, report full error, do not retry
- Review requested changes: stop, surface the reviewer comment, do not merge
- 3+ retries with no green: escalate to user immediately

## Status reporting

After each poll cycle, output a one-line status:
`[jules] story-NNN | PR #NNN | checks: 3/5 ✓ | elapsed: 12m`

Stop reporting when merged or escalated.
