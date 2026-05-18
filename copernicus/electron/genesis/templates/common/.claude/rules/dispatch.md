---
description: Subagent dispatch commands and protocol (Gemini, Jules)
---
### Dispatch Protocol

```bash
# Step 1 — write prompt to file
cat > /tmp/gemini_prompt.md << 'EOF'
<prompt content>
EOF

# Step 2 — run headless in background (Claude is notified on completion)
gemini -p "$(cat /tmp/gemini_prompt.md)" --approval-mode yolo 2>&1 | tee /tmp/gemini_NNN.log
# Use run_in_background: true on the Bash tool call — no terminal tab needed.
# On completion Claude reads /tmp/gemini_NNN.log to verify output.

# Parallel sessions — run multiple Bash calls with run_in_background: true simultaneously.
# Each writes to its own log: /tmp/gemini_437.log, /tmp/gemini_419.log, etc.
```

**Session recovery** (if headless run is interrupted):
```bash
gemini --list-sessions          # find the session index
gemini -r latest                # resume most recent session
gemini -r 2                     # resume by index
```

**Cost of doing Gemini's work yourself: ~$40 in wasted tokens. Cost of delegating: $0.**

> Jules dispatch: `bash scripts/jules_assign.sh docs/stories/story_NNN_*.md` — no launcher script needed.
> Parallel Gemini: multiple `run_in_background: true` Bash calls, one per story, separate log files.

---

## Subagent Policy
**Delegate early and often — every task Claude handles directly costs tokens. Gemini orchestrates cloud models; Claude plans, delegates, and reviews.**

### Delegate Selection (in priority order)

> **All scripts run from repo root `<REPO_ROOT>/` — never from inside `copernicus/`.**

1. **Jules — isolated TypeScript/React stories (async PR, zero Claude tokens):**
   ```bash
   bash scripts/jules_assign.sh docs/stories/story_NNN_*.md
   # Optional persona overlay: --as bolt|palette|sentinel
   ```
   Use for single-concern TS/React stories. Story must be `APPROVED FOR IMPLEMENTATION`.
   Stories must have `Blocks:` and `Blocked By:` headers **with colons** or validation fails.
   If files only exist on a feature branch, push the branch first so Jules can fetch it.

2. **Gemini — multi-file implementation, Python, shell, docs:**
   ```bash
   git worktree add .agent-worktrees/story-NNN story/NNN
   (cd .agent-worktrees/story-NNN && gemini -p "$(cat /tmp/gemini_NNN.md)" --approval-mode yolo 2>&1 | tee /tmp/gemini_NNN.log)
   ```
   Always dispatch from a worktree. Use `run_in_background: true` on the Bash tool call.

- Always use the most token-efficient subagent capable of the task.