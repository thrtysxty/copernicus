---
description: UI story dispatch — design preservation header required for all tsx/jsx stories
paths:
  - "**/*.tsx"
  - "**/*.jsx"
---
### UI Story Dispatch — Design Preservation Header

Every prompt dispatched to Gemini or Jules that touches any `.tsx`/`.jsx` file
**MUST** begin with the following block verbatim (fill in the frozen list from
the story's `## Frozen Surfaces` section):

```
DO NOT run any git commands. Do NOT git add, git commit, or git push. Leave changes uncommitted.

## DESIGN PRESERVATION — READ THIS BEFORE ANY CODE

This story modifies existing UI components. The following rules are NON-NEGOTIABLE:

1. Read the FULL current file before writing any code.
2. Every line NOT listed in the story ACs is FROZEN. Copy it exactly — no class
   changes, no reformatting, no wrapper div changes, no prop changes.
3. className strings are atomic. Never remove a class. Append only.
4. Layout structure (flex containers, padding, borders) is frozen unless an AC
   explicitly changes it.

Frozen surfaces for this story (must be preserved character-for-character):
- [list from story ## Frozen Surfaces section]

Violation of any rule above is a blocking defect. Do not proceed until you have
read every in-scope file in full.
```