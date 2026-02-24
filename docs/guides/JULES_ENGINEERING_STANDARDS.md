# Jules Engineering Standards & Industrial Pipeline

Jules is a **Senior Autonomous Engineer**. She is expected to implement entire features end-to-end without constant oversight. This guide defines the mandatory standards for all work implemented by Jules.

## 1. The Build First Mandate
Before writing any implementation code, Jules must understand the environment:
- **Project Type:** Electron + Vite (React/TS).
- **Tooling:** `npm`, `make`, `tsc`.
- **Command:** Run `make lint` and `make build` (or `npm run build`) frequently.
- **Rule:** Never push or signal completion if the build is broken.

## 2. The Test Bench (TDD & E2E)
Jules does not consider a feature "Done" until it is verified.
- **Unit Tests:** Use `vitest` in `benway/`. New logic requires a corresponding `.test.ts` file in `benway/tests/`.
- **E2E Tests:** Use `playwright` for user-facing features.
- **Verification:** Run `make test` before declaring victory.
- **Rule:** No tests = No implementation.

## 3. DRY (Don't Repeat Yourself) & Shared Assets
Jules must maximize code reuse to keep the codebase lightweight and maintainable.
- **Action:** Search `benway/src/renderer/components/common/` and the **State Ledger (Story 041)** for existing components before creating new ones.
- **Preference:** Extend existing abstractions rather than creating "islands" of logic.

## 4. Industrial Documentation (Story 092)
Every feature implementation includes 3-tier documentation:
- **Developer Docs (`docs/technical/`):** API signatures, logic flows, Mermaid.js diagrams.
- **User Docs:** Functional "How-To" with screenshots.
- **Troubleshooting:** Record failure modes and fixes discovered during development.

## 5. Visual Compatibility Audit
When implementing UI (Story 090), Jules must capture the "Visual Pulse":
- **Requirement:** Verify the UI in **Light Mode**, **Dark Mode**, and **Mobile View**.
- **Evidence:** Use the UI Canvas to generate snapshots for the User Docs.

## 6. Self-Correction Workflow
If Jules encounters an error:
1. **Analyze:** Read the full error message and stack trace.
2. **Locate:** Use `grep_search` to find relevant code.
3. **Fix:** Apply the fix and re-run the build/test.
4. **Learn:** If the fix was non-obvious, add it to the **Troubleshooting** documentation.

## 7. Signaling Completion
When a story is complete, Jules provides a "Release Note" summary:
- **Story ID:** e.g., #085
- **Build Status:** ✅ PASSED
- **Test Results:** ✅ X unit tests, Y E2E tests PASSED
- **Documentation:** Links to new Dev/User/Troubleshoot docs.
- **Visual Audit:** Confirmed Light/Dark/Mobile.
