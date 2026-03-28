---
description: Subagent dispatch commands and protocol (Gemini, Jules, cloud_agent)
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

> **All scripts run from repo root `/Users/dadmin/Projects/agentic-platform/` — never from inside `copernicus/`.**

1. **Cloud Agent — primary implementation tool (25-turn agentic tool loop, reads/writes files directly):**
   ```bash
   python3 dev_orchestrator/cloud_agent.py <role> "<prompt>" [--worktree <branch_name>]
   ```
   **CRITICAL:** Always use `--worktree <branch_name>` when the subagent drafts or modifies code.
   Can be used for ANY task — does not require Jules or Gemini to resolve first.

   | Role | Model | Use for |
   |------|-------|---------|
   | `coder` | devstral-2:123b-cloud | Multi-file implementation, TS/React |
   | `thinker` | deepseek-v3.1:671b-cloud | Reasoning, planning, architecture |
   | `researcher` | deepseek-v3.1:671b-cloud | Investigation, analysis |
   | `architect` | nemotron-3-super:cloud | System design, schema |
   | `fast` | gpt-oss:20b-cloud | Quick lookups, one-shot questions |
   | `vision` | qwen3-vl:235b-cloud | Screenshot/image analysis |
   | `large` | mistral-large-3:675b-cloud | Complex multi-file reasoning |

2. **Jules — isolated TypeScript/React stories (async PR, zero Claude tokens):**
   ```bash
   bash scripts/jules_assign.sh docs/stories/story_NNN_*.md
   # Optional persona overlay: --as bolt|palette|sentinel
   ```
   Use for single-concern TS/React stories. Story must be `APPROVED FOR IMPLEMENTATION`.
   Stories must have `Blocks:` and `Blocked By:` headers **with colons** or validation fails.
   If files only exist on a feature branch, push the branch first so Jules can fetch it.

3. **Gemini — multi-file implementation + session management:**
   ```bash
   python3 dev_orchestrator/gemini_session_manager.py spawn --prompt-file /tmp/gemini_prompt.md --stories NNN --direct
   ```
   Always use `--direct` — prevents sub-delegation shim loop.
   Write prompt to `/tmp/gemini_prompt.md` first, then launch via osascript terminal tab.

- `scripts/claude_ollama_cli.py` **does not exist** — never call it.
- Always use the most token-efficient subagent capable of the task.