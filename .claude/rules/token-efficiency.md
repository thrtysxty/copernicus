---
description: Token efficiency rules — prompt construction, context discipline, history management
---
## Context Discipline — Token Efficiency

**Goal: minimize tokens Claude processes directly. Apply on every session.**

### Prompt Construction
- **Be direct:** Start with the imperative. "Summarize:" not "Could you please summarize..."
- **Use delimiters:** Separate instructions from content with `###` or `---`. No wordy transitions.
- **Limit output:** Specify length explicitly — "3-bullet list", "under 50 words", "one-line diff". Models respect hard constraints.
- **Skeletonize dispatch prompts:** Send interfaces, function signatures, and the target block — not full files. A 50-line skeleton beats a 1,000-line file in every dispatch.
- **Active scope only:** Reference only files listed in the story scope. Never attach build artifacts or files outside story scope.

### History Management
- **Checkpoint every ~15 turns:** Run `/handoff` to compress session state into a ≤200-token summary. Open a fresh session with that summary — lose the fluff, keep the engineering state.
- **Sliding window:** When re-dispatching to Gemini/Jules, include only the last 3 exchanges + a short summary of earlier context. Not the full history.
- **Strip fluff:** Before a handoff, remove "Thank you", "Got it", and other non-functional turns. Every word sent is a token charged.
- **Diff-only review:** On Gemini/Jules completion, read `git diff HEAD~1` — not full files. Claude reviews the change, not the context it already knows.

### Technical Controls (for cloud_agent.py and LLMService calls)
- **max_tokens:** Set a hard output cap on every cloud dispatch. Prevents rambling after the answer is complete.
- **stop_sequences:** Use `

` or a sentinel like `[[DONE]]` to halt generation at the right point.
- **Router pattern:** Use `fast` (Gemini-Flash) or local Ollama for parsing, searching, and classifying. Reserve heavy models for planning and complex reasoning only.
- **RAG limits:** Cap local Ollama at 3–5 high-relevance snippets per query. More is diminishing return + bloat.