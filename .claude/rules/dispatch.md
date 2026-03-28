---
description: Subagent dispatch commands and protocol (Gemini, Jules)
---
### Dispatch Protocol — Gemini CLI

```bash
# Step 0 — create a worktree so the agent works on a feature branch
git worktree add .agent-worktrees/story-NNN story/NNN

# Step 1 — prepend agent context for the assigned role (coder|thinker|architect|researcher|vision)
python3 scripts/agent_context.py <role> > /tmp/gemini_NNN.md

# Step 2 — append the task prompt
cat >> /tmp/gemini_NNN.md << 'EOF'

---

<prompt content>
EOF

# Step 3 — run headless from the worktree directory
(cd .agent-worktrees/story-NNN && gemini -p "$(cat /tmp/gemini_NNN.md)" --approval-mode yolo 2>&1 | tee /tmp/gemini_NNN.log)
# Use run_in_background: true on the Bash tool call — no terminal tab needed.
# On completion Claude reads /tmp/gemini_NNN.log to verify output.

# Parallel sessions — run multiple Bash calls with run_in_background: true simultaneously.
# Each writes to its own log: /tmp/gemini_571.log, /tmp/gemini_572.log, etc.
```

**Session recovery** (if headless run is interrupted):
```bash
gemini --list-sessions          # find the session index
gemini -r latest                # resume most recent session
gemini -r 2                     # resume by index
```

**Worktree cleanup** (after PR merge):
```bash
git worktree remove .agent-worktrees/story-NNN
git branch -d story/NNN
```

**Cost of doing Gemini's work yourself: ~$40 in wasted tokens. Cost of delegating: $0.**

> Jules dispatch: `bash scripts/jules_assign.sh docs/stories/story_NNN_*.md` — Jules manages its own branch/PR.
> Parallel Gemini: multiple `run_in_background: true` Bash calls, one per story, separate log files.

---

## Subagent Policy
**Delegate early and often — every task Claude handles directly costs tokens.**

### Delegate Selection (in priority order)

> **All scripts run from repo root `/Users/dadmin/Projects/copernicus/`**

1. **Jules — TypeScript/React stories (async PR, zero Claude tokens):**
   ```bash
   bash scripts/jules_assign.sh docs/stories/story_NNN_*.md
   # Optional persona overlay: --as bolt|palette|sentinel
   ```
   Use for single-concern TS/React stories. Story must be `APPROVED FOR IMPLEMENTATION`.
   Stories must have `Blocks:` and `Blocked By:` headers **with colons** or validation fails.
   Jules manages its own branch and PR — no worktree needed.

2. **Gemini CLI — Python, shell, multi-file implementation:**
   ```bash
   git worktree add .agent-worktrees/story-NNN story/NNN
   (cd .agent-worktrees/story-NNN && gemini -p "$(cat /tmp/gemini_NNN.md)" --approval-mode yolo 2>&1 | tee /tmp/gemini_NNN.log)
   ```
   Always dispatch from a worktree — agent commits to `story/NNN`, opens PR, never touches `main` directly.

### Ghost scripts — DO NOT reference
- `cloud_agent.py` — does not exist
- `gemini_session_manager.py` — does not exist
- `claude_ollama_cli.py` — does not exist

- Always use the most token-efficient subagent capable of the task.
