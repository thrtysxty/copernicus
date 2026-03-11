# Enhancement Requests — Copernicus IDE
**Date:** 2026-03-10
**Status:** DRAFT / PROPOSAL
**Author:** Gemini CLI

The following enhancements are proposed to complement the existing design intent of the Copernicus IDE as a high-density, agentic orchestration environment. These features prioritize **intent, technical rationale, and high-signal feedback** over standard IDE patterns.

---

## 1. Ghost Implementation (Shadow Coding)
**Category:** Editor / Agent Interactivity
**The Feature:** As an agent processes a task, its proposed changes appear as non-editable "ghost text" (low-opacity phosphor) directly in the Monaco editor before they are committed to disk.
**Why it fits:** It reinforces the "Senior Peer" relationship. The user can watch the implementation logic flow in real-time and "Accept/Reject" specific blocks using the Touch Bar or keyboard shortcuts (`Cmd+Shift+A` / `Cmd+Shift+R`).

## 2. The "Contextual Nebula" (RAG Visualization)
**Category:** Designer / Intelligence
**The Feature:** A 2D/3D node-link graph rendered on the Designer Canvas during agent search/RAG operations. It visualizes the "Semantic Distance" between the active story and the files being pulled into the agent's context.
**Why it fits:** It demystifies the "black box" of RAG. Users can manually "prune" nodes in the graph to redirect the agent's attention if it pulls irrelevant code into its context window.

## 3. "Time-Travel" Orchestration
**Category:** Orchestrator / Workflow
**The Feature:** A snapshot system for multi-agent workflows. If a swarm fails at a specific node, the IDE can "rewind" the project state (files, DB, and agent memory) to the exact moment the previous node finished.
**Why it fits:** It aligns with the Orchestrator's intent of managing complex, autonomous swarms. It allows for "hot-swapping" a model or prompt mid-workflow without starting the entire execution from scratch.

## 4. Technical Debt "Heatmap" (Reporter View)
**Category:** Reporter / Strategy
**The Feature:** A visual overlay for the codebase that combines LSP diagnostics, Git history, and Agent telemetry. It highlights "Hotspots"—files with high error counts, frequent agent churn, or high token cost to modify.
**Why it fits:** It transforms the Reporter from a simple cost-tracking dashboard into a strategic tool for the Architect to identify where refactoring is most critical.

## 5. "Pulse" CRT Shaders (Aesthetic Depth)
**Category:** UX / Aesthetics
**The Feature:** A toggleable "Scanline" or "CRT Bloom" shader effect for the UI, synced with the "Technical Pulse" status. The effect intensifies during heavy background processing (indexing, swarm execution, or build tasks).
**Why it fits:** It doubles down on the VT Terminal/Phosphor aesthetic, making the IDE feel like a dedicated, "alive" hardware console for AI orchestration rather than a standard web wrapper.

## 6. Semantic "Diff" Summaries
**Category:** Chat / Communication
**The Feature:** Replace or augment raw `+`/`-` diffs in the Chat panel with natural language "Semantic Change Summaries" (e.g., *"Refactored Auth logic to PKCE as per Bible §15; modified 3 files"*).
**Why it fits:** It prioritizes high-signal communication. The user understands the *intent* of the change immediately, with the option to expand the raw diff for surgical verification.
