---
name: verify
description: Structured verification workflow — select risk tier, run checks, produce evidence-backed verdict. Use after any implementation before declaring a story done.
---

# Verification Skill

## Purpose
Produce an evidence-backed PASS / FAIL / PARTIAL verdict for the current implementation. Select the tier that matches the risk level of what changed.

## Tier Selection

| Tier | When to use | Depth |
|------|-------------|-------|
| **1 — Quick Smoke** | Narrow single-file edits, type fixes, copy changes | Lowest |
| **2 — Targeted Regression** | Multi-file edits, logic changes in existing flows | Medium |
| **3 — Deep Verification** | Auth, IPC contracts, migrations, broad refactors | Highest |

## Tier 1 — Quick Smoke

1. `tsc --noEmit` exits 0 in `copernicus/`
2. Confirm primary changed path works (read the code, trace the call)
3. Confirm no obvious runtime errors introduced

Evidence: tsc exit code + one-line reasoning per changed file.

## Tier 2 — Targeted Regression

1. `tsc --noEmit` exits 0
2. Test the changed behavior directly — read unit tests or run them if available
3. Test one adjacent behavior likely to regress (caller, sibling component, IPC consumer)
4. Validate error handling for one failure case in the changed path
5. `mcp__ide__getDiagnostics` on all edited files — zero new errors

Evidence: named tests + before/after behavior notes for the edge case.

## Tier 3 — Deep Verification

1. `tsc --noEmit` exits 0
2. Full relevant test suite (`npm test` / `make test`) — all pass
3. Integration check: trace every IPC channel touched (preload → handler → renderer)
4. Validate forbidden patterns (`AGENTS.md`) — none violated
5. `mcp__ide__getDiagnostics` — zero errors across all in-scope files
6. Document rollback path if this change breaks in production

Evidence: full test summary, explicit list of known gaps with owner.

## Anti-Rationalization Rules

These phrases are NOT verification:
- "The code looks correct"
- "This should work"
- "The logic appears sound"
- "I believe this is right"

Every check must have: what command was run (or what file was read) and what the output was.

## Output Format

```
### Check: <what you verified>
**Method:** <command run or file read>
**Output:** <exact output or observation>
**Result:** PASS / FAIL / SKIP (reason)

VERDICT: PASS | FAIL | PARTIAL
Risk remaining: <what could still be wrong>
Next step: <exact action if FAIL or PARTIAL>
```

## Trigger

Run this skill when:
- About to declare a story COMPLETE
- After a Gemini/Jules PR is merged and you want confirmation before closing
- When a reviewer flags a concern and you need to investigate

Anti-rationalization applies to you too — do not call PASS without running the checks.
