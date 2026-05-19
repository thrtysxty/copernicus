# Project Memory and Retrospectives

Copernicus learns from each sprint and carries that knowledge forward.

## Project Memory

Every LLM interaction can extract memorable facts — conventions, decisions, architectural choices. These are stored in `project_memory` with:

- **Importance score** (1–10) — High-importance entries persist indefinitely
- **Recency decay** — Older entries fade unless reinforced
- **Bank ID** — Groups related facts by topic
- **Event type** — `memory_fact`, `convention`, `decision`

At the start of each session, relevant memories are injected as system context, so the next agent starts informed.

## Release Retrospective

The retrospective workflow extracts learnings from a completed sprint:

1. **Git log analysis** — What changed, what was the velocity
2. **Performance review** — Token spend, completion rates, error rates
3. **Human reflection** — Your notes on what went well and what didn't
4. **Learning extraction** — Patterns worth remembering
5. **Memory reinforcement** — Important findings written back to `project_memory`

Access retrospectives from the Command Palette (`Cmd+P` → "Retrospective") or the CapEx dashboard.

## Memory Viewer

The Memory panel shows all stored memories with their importance scores and creation dates. You can edit, delete, or reinforce memories manually.
