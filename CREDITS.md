# Credits & Acknowledgements

COPERNICUS IDE was built on original engineering, but several open-source projects provided meaningful inspiration, patterns, or tooling that shaped the platform. We're grateful to their authors.

---

## Google Agentic AI research
The paper that directly identified the episodic memory gap, inspiring stories 572–574. We credit the research that named the problem.

---

## MLX (Apple)
The Neural Engine software layer that makes local inference viable on Apple Silicon (Story 652).

---

## mlx-community (HuggingFace)
The community that converts and maintains models in MLX format. The catalog that makes story 652's model selection possible.

---

## genai-toolbox (Google / googleapis)
The MCP database server (Story 631).

---

## Model Context Protocol / `@modelcontextprotocol/sdk` (Anthropic)
The agent communication standard that MCP tools across Copernicus are built on.

---

## node-llama-cpp
llama.cpp compiled as a native Node.js addon, the cross-platform inference foundation for story 651.

---

## Playwright (Microsoft)
The behavioral test runner that becomes the language-agnostic code contract in stories 635/636.

---

## AI contributors
- **Claude (Anthropic)**: architecture, planning, code review throughout.
- **Jules (Google)**: implementation across 30+ merged PRs.
Named in commits, named here.

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

**Issue #538** *(architectural analysis by roman-rr)* — Identified the structural gap: Claude Code's native Read/Grep/Glob tools bypass the Bash hook entirely, so their output hits the context window unfiltered. The analysis points toward a PostToolUse hook as the correct interception point for native tool output compression. RTK solves 60–90% of the token waste; the remaining surface is the native tools.

---

## Hindsight
**https://github.com/vectorize-io/hindsight** — MIT *(planned integration — post-launch)*

A self-hosted long-term memory engine for AI agents. `retain` / `recall` / `reflect` operations backed by PostgreSQL and vector search. SOTA on LongMemEval. Earmarked to replace the hand-rolled `project_memory` layer after the first Copernicus launch — see `docs/epics/epic_009_hindsight_long_term_memory.md`.

---

## everything-claude-code
**https://github.com/affaan-m/everything-claude-code** *(planned integration — P1)*

A comprehensive Claude Code optimization system built over 10+ months of production use, originating from an Anthropic hackathon. 16 specialized subagents, 65+ skill modules, and a hooks architecture (session persistence, strategic compaction, pattern extraction) with runtime profile control via `ECC_HOOK_PROFILE`. The hooks architecture and agent persona library are direct references for Copernicus skill and hook patterns.

---

## GitNexus
**https://github.com/abhigyanpatwari/GitNexus** *(planned integration — Story 389)*

Zero-server codebase intelligence via Tree-sitter AST knowledge graphs. Exposes MCP tools (`query`, `impact`, `context`, `detect_changes`, `cypher`) that provide precomputed blast-radius and dependency context for any file in the repo. Earmarked to replace hand-rolled RAG in the Copernicus agent dispatch pipeline and provide pre-dispatch collision detection — see `docs/stories/story_389_gitnexus_mcp_—_codebase_intelligence_context_injection.md`.

---

## Cred
**https://www.cred.ninja** *(under evaluation — Story 390)*

OAuth token delegation middleware for AI agents. Short-lived scoped tokens, AES-256-GCM vault, Ed25519-signed audit receipts per issuance, and instant revocation. MCP SDK available. Earmarked as the endgame for `AuthManager` when Copernicus agents need to call external APIs (GitHub, Linear, Slack) without holding raw long-lived keys. Pending self-host feasibility evaluation (R620 vault, no AWS KMS dependency) — see `docs/stories/story_390_cred_agent_oauth_delegation_—_research_spike.md`.

---

## av/harbor
**https://github.com/av/harbor**

A CLI orchestrator that spins up a complete local LLM stack via Docker Compose — Ollama, vLLM, llama.cpp backends wired to Open WebUI, SearXNG, voice frontends, all auto-discovering each other on startup. Profile-based config switching, traefik proxy built in. Earmarked on two fronts: as the deployment layer for the ML350 Gen9 local inference server, and as the architectural model for Story 633 — Harbor-style containerized agent sandboxing for Copernicus. Once agents are centralized on the socket bus, running each in its own container (explicit volume mounts instead of `--dangerously-skip-permissions`, resource caps, clean restart semantics) is the natural next step.

---

## apfel
**https://github.com/Arthur-Ficial/apfel**

A CLI wrapper for Apple's FoundationModels framework that exposes an OpenAI-compatible API at `localhost:11434`. Runs natively on macOS 26 (Darwin 25+) against on-device Apple Intelligence models — zero API cost, zero network latency, no quota. Earmarked as the local inference path for Copernicus on developer machines once macOS 26 ships broadly: cheap model calls for break room chess moves, IPC channel classification, and lightweight agent tasks that don't need cloud-scale reasoning.

---

## gitreverse
**https://github.com/filiksyos/gitreverse**

A repo-to-prompt reverse engineering tool: give it a GitHub URL, get back a scaffolding prompt that would generate a structurally similar project from scratch. Inspired the `/gitreverse` skill in `.claude/skills/gitreverse/` — a novice onboarding path for Copernicus users who want to learn from an existing repo without cloning it.
