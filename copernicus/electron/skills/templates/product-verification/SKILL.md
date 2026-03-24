Use when adding tests or modifying test coverage for {{PROJECT_NAME}}, especially regarding Playwright E2E and pytest integration tests.

## Instructions

When working in {{REPO_ROOT}} with {{STACK}} on product verification:
1. Identify the layer to test: frontend UI (Playwright) or backend/orchestration (pytest).
2. For Playwright E2E tests, refer to UI standards in `docs/reference/UX_BIBLE.md` and ensure tests run against the built Electron app.
3. For pytest integration tests, ensure your tests cover the database ledger and orchestration flows properly.
4. Follow the known failure patterns in `references/gotchas.md`.

## Notes

- Playwright E2E tests are typically run via `npm test` or specific UI scripts.
- Ensure test databases are cleanly seeded and migrations are applied before running Python/sqlite integration tests.
- Wait for IPC responses explicitly when simulating UI actions in Playwright.
