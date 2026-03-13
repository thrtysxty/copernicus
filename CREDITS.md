# Credits & Acknowledgements

COPERNICUS IDE was built on original engineering, but several open-source projects provided meaningful inspiration, patterns, or tooling that shaped the platform. We're grateful to their authors.

---

## obra/superpowers
**https://github.com/obra/superpowers** — MIT

The structured skills methodology that `superpowers` defines — brainstorming, planning, TDD enforcement, subagent-driven review, systematic debugging, git worktree isolation — is the direct ancestor of the skills system in `.claude/skills/`. The philosophy of injecting structured workflows into AI agents rather than leaving them to improvise is foundational to how Copernicus orchestrates Claude, Gemini, and Jules. The `SKILL.md` convention and the Plan → Delegate → Review loop both trace back here.

---

## epiral/agent-clip
**https://github.com/epiral/agent-clip**

An early reference point for the persistent agentic loop architecture: SQLite-backed conversation topics, multi-layer memory (facts + summaries + semantic search), tool use via function calling, and a paired CLI + web UI. The Copernicus `project_memory` table, context snapshot model, and the general pattern of giving agents durable identity across sessions drew from agent-clip's approach to memory and persistence.

---

## leighstillard/claude-tools
**https://github.com/leighstillard/claude-tools** — Unlicense (public domain)

A one-command CLI installer that configures the full Claude Code developer tooling stack: RTK, LSP servers, and Claude Code plugins. The Copernicus dev environment — including the RTK pre-tool-use hook in `.claude/settings.local.json` and the LSP plugin configuration — was bootstrapped using claude-tools. Auto-detects project language, non-destructive on re-run, dry-run mode available.

---

## RTK — Rust Token Killer
**https://github.com/reachingforthejack/rtk** *(installed via claude-tools; name collision: not the Rust Type Kit)*

A token-optimized CLI proxy used throughout the Copernicus development workflow. RTK rewrites common shell commands (`git status`, `ls`, `find`, etc.) to return token-efficient output before Claude ever sees it — delivering 60–90% token savings on routine dev operations. Integrated via Claude Code pre-tool-use hook in `.claude/settings.local.json`.

---

## Hindsight
**https://github.com/vectorize-io/hindsight** — MIT *(planned integration — post-launch)*

A self-hosted long-term memory engine for AI agents. `retain` / `recall` / `reflect` operations backed by PostgreSQL and vector search. SOTA on LongMemEval. Earmarked to replace the hand-rolled `project_memory` layer after the first Copernicus launch — see `docs/epics/epic_009_hindsight_long_term_memory.md`.
