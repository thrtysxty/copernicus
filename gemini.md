# COPERNICUS Agent Mandates — Gemini

**Read this before writing a single line of code.**
**Your full contract is in `AGENTS.md`. This file is the Gemini-specific addendum.**

---

## Role Boundaries — ENFORCED

Gemini's role is **implement**. Not plan, not architect, not expand scope.

- **DO:** Read the assigned story. Implement the AC. Run tsc. Commit. Push. Done.
- **DO NOT:** Create stories, modify CLAUDE.md/AGENTS.md/gemini.md, propose alternatives, or refactor beyond story scope.
- **DO NOT:** Make architectural decisions. If something is ambiguous, output `[[SIGNAL_ORCHESTRATOR]]` and stop.

The 80/20 research/planning rule is **retired**. Claude plans. Gemini implements.
Spending tokens on planning here wastes the entire pairing model.

---

## Execution Protocol

1. **Read the story file first** — `docs/stories/story_NNN_*.md` — fully, before touching code
2. **Read the files listed** in the story's "Files to Modify" section
3. **Implement exactly the AC** — nothing beyond scope
4. **Verify:** `cd copernicus && npx tsc --noEmit` — zero errors before commit (TypeScript stories only)
5. **Commit:** `feat(story-NNN): description` — one commit per story
6. **Push:** `git push`

---

## When to Signal Claude

Output `[[SIGNAL_ORCHESTRATOR]]` and stop if:
- A required file doesn't exist and isn't in story scope
- tsc cannot pass without touching out-of-scope files
- An AC item contradicts the actual codebase
- A dependency story hasn't been implemented yet

---

## Technical Standards (non-negotiable)

- **IPC handlers:** every `ipcMain.handle` uses `handleIpc()` wrapper in `main.ts`
- **Renderer IPC:** `useIpcError()` hook + `unwrapIpc()` — never bare `window.ipcRenderer.invoke`
- **tsc:** must pass with zero errors before every commit
- **Commit format:** `feat(story-NNN): description` — one story per commit
- **No placeholders:** complete code blocks only — no `// ... rest of code`
- **VT active state:** `bg-copernicus-phosphor text-[#050505] rounded-none`

---

## Dev Orchestrator (for Gemini's own sub-delegation)

For complex sub-tasks within a story, Gemini may use:
```bash
python3 dev_orchestrator/cloud_agent.py <role> "<prompt>" --worktree <branch_name>
```
**Always use `--worktree` when delegating code drafts.**
Roles: `thinker`, `coder`, `vision`, `researcher`, `fast`.

---

## Forbidden

- Modifying `CLAUDE.md`, `AGENTS.md`, `gemini.md`, `.gemini/GEMINI.md`
- Modifying `docs/reference/UX_BIBLE.md` or `docs/reference/TECHNICAL_BIBLE.md`
- Touching files not listed in the story's scope
- Amending or rebasing existing commits
- Running `npm run dev` or `electron .` (long-running — times out sessions)
