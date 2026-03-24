# Known Failure Patterns

- **Race conditions in Playwright `waitFor`**
  - **Symptom:** Flaky E2E tests, occasional timeouts, elements not found.
  - **Cause:** Asserting element presence before state update or IPC response has completed rendering.
  - **Fix:** Wait for the specific API response or state change explicitly using `page.waitForResponse(...)` or checking the precise DOM update.

- **Missing `await` on IPC invoke**
  - **Symptom:** UI tests pass but no actions occur, unhandled promise rejections, state inconsistency.
  - **Cause:** Firing off a `useIpcError().invoke()` without an `await` before moving to the next test action.
  - **Fix:** Await the invoke in the React component and handle the envelope appropriately before state updates.

- **Test database not seeded**
  - **Symptom:** Tests failing immediately due to empty data or missing tables.
  - **Cause:** Running tests directly without triggering the global setup script or migration routines.
  - **Fix:** Use a clean, seeded SQLite memory database or temp file for each test suite run.
