---
description: Story completion protocol — tsc gate, pytest gate, AC verification required
---
## Story Completion Protocol

Before declaring a task complete, verify the following:

- **Definition of Done Gate:** All Acceptance Criteria (AC) from the story have been met.
- **`tsc` Gate:** For TypeScript projects, `npx tsc --noEmit` runs with zero errors.
- **`pytest` Gate:** For Python projects, the test suite (`make test`) passes without failures.
- **Behavioral Verification:** The implemented changes have been tested and verified to behave as expected.

## Self-Check Before Finishing

Before completing any code modification task, verify:
1. `trace_call_path` (inbound) was run for all modified symbols
2. No high blast-radius warnings were ignored
3. `detect_changes` confirms changes match expected scope