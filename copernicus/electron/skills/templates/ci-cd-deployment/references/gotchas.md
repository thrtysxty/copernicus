# Known Failure Patterns

- **Gemini loops on commit without `--no-commit` instruction**
  - **Symptom:** Agent runs out of tokens or loops indefinitely on failed tests or empty patches.
  - **Cause:** Missing explicit `--no-commit` instruction, causing the agent to repeatedly try to commit broken code.
  - **Fix:** Provide clear instructions, or explicitly request the agent to pause for review before committing.

- **Parallel dispatch clobbering shared files**
  - **Symptom:** Git merge conflicts on shared resources like `main.ts`, `preload.ts`, or database schema files.
  - **Cause:** Multiple agents working simultaneously on overlapping features without isolated branches or locks.
  - **Fix:** Ensure stories modify isolated components, or serialize tasks that edit core shared files.

- **Jules PR not applied before review**
  - **Symptom:** Code review or local tests run against the wrong state, leading to false positives or missed bugs.
  - **Cause:** Forgetting to pull down the Jules session patch before verifying locally.
  - **Fix:** Always run `jules remote pull --session <SESSION_ID> --apply` and `npx tsc --noEmit` before reviewing the PR.
