Use when performing code reviews, verifying security, confirming TDD patterns, or validating PR quality within {{PROJECT_NAME}}.

## Instructions

When reviewing code in {{REPO_ROOT}} with {{STACK}}:
1. Always run `tsc --noEmit` locally before approving changes.
2. Confirm the feature implementations or bug fixes followed the Red-Green-Refactor TDD cycle (there must be corresponding tests).
3. Check `AGENTS.md` and `TECHNICAL_BIBLE.md` for forbidden security and architecture patterns (e.g. no bare `require()`, strict context isolation).
4. Review IPC channel configurations and `handleIpc` wrappers for error boundaries.

## Notes

- Extend existing security-review, tdd, and pi_check review patterns.
- Do not assume UI components are safe from XSS or prototype pollution without checking the underlying inputs and API responses.
