# Debugging in the Copernicus IDE

This document outlines the current debugging capabilities of the Copernicus IDE, identifies missing features, and explains how AI agents utilize the system for autonomous troubleshooting.

## 1. Current Debugging & Diagnostics Suite

Copernicus provides a multi-layered approach to code quality and observability, focusing on integrated diagnostics rather than traditional stepping debuggers.

### Code Quality & Static Analysis
*   **Diagnostics Panel (`⌘Shift+M`):** A dedicated "Problems" view that executes project-wide `npx tsc --noEmit` checks. It parses the compiler output into a structured list, allowing developers to jump directly to the offending line in the editor.
*   **LSP Integration:** The Monaco-based editor receives real-time diagnostic markers from the Language Server Protocol (LSP), highlighting type errors, syntax issues, and warnings as you type.

### Agent Observability & Telemetry
*   **Agent Output Panels:** Specialized terminal-like views (e.g., `GeminiPanel`) stream the real-time "thought process," tool executions, and raw model responses from active AI agents.
*   **Command Center:** A system-wide telemetry dashboard that monitors the health of "Agent Swarms" and active tasks. It provides a status overview of the LSP server, open files, and any "stalled" agents requiring manual intervention.
*   **State Ledger:** A persistent SQLite-based "black box" recorder that logs every agent intent, model call, and system event. This data is surfaced through the **Telemetry Overlay** and **Capex Dashboard** for performance and cost analysis.

### System-Level Troubleshooting
*   **Integrated Terminals:** Full `xterm.js` PTY terminals allow for running standard CLI debuggers (e.g., `pdb`, `node --inspect`) and executing unit tests (Vitest/Playwright) directly within the IDE.
*   **Electron Logs:** The `app:open-log` command provides instant access to the main process log file (`copernicus.log`), tracking internal exceptions, IPC traffic, and system-level events.
*   **Inspector Sidebar:** A context-aware sidebar used in the UI Builder and Workflow Composer to inspect and modify component properties or graph nodes at runtime.
*   **DevTools:** Running with the `COPERNICUS_DEBUG=true` environment variable enables the Chrome DevTools for deep inspection of the React renderer and frontend state.

---

## 2. Missing Features & Roadmap

Compared to traditional IDEs, several key debugging features are currently identified for future implementation:

1.  **DAP Support:** Integration of the Debug Adapter Protocol (DAP) to provide a graphical UI for breakpoints, call stack inspection, and variable watch lists.
2.  **Integrated Test Runner:** A dedicated "Test Explorer" view to visualize test suites (Vitest/Playwright), run individual tests, and view inline coverage reports.
3.  **Agent Replay Debugging:** A tool to "rewind" agent sessions to a specific intent recorded in the State Ledger, allowing developers to tweak prompts or context and "replay" the agent's logic.
4.  **Integrated Log Viewer:** A searchable "Output" panel within the IDE to stream and filter logs from the Main process, LSP, and Backend without opening external files.
5.  **Unified Health View:** Expanding the Diagnostics panel to include linting results (ESLint/Ruff) and security vulnerability scanning.

---

## 3. How Agents Debug

AI agents in Copernicus do not use stepping debuggers; instead, they operate through an **"Observe-Fix-Verify" loop** using the following infrastructure:

### Detection (Observation)
*   **LSP & TSC:** Agents call `lsp:get-diagnostics` and `diagnostics:run-tsc` to detect errors.
*   **Log Parsing:** Agents use the `fs-manager` to read `copernicus.log` for runtime exceptions.

### Analysis
*   **Context Retrieval:** Agents use RAG (Retrieval-Augmented Generation) to search for similar code patterns or documentation across the repository.
*   **Ledger Inspection:** Agents can query the `State Ledger` to understand the sequence of actions that led to a failure.

### Repair (Fixing)
*   **Autonomous Fixers:** Agents invoke scripts like `fix_ts.py` to iterate through compiler errors and apply automated fixes.
*   **Patch Manager:** Changes are applied via a `patch-manager` that ensures atomic updates and provides verification before a change is finalized.
*   **Snapshot Safety:** The `SnapshotManager` saves the workspace state before risky edits, allowing for a `reversePatch` if a fix introduces regressions.

### Verification
*   **Re-Verification:** Agents re-run the diagnostic suite (TSC/Tests) to confirm the fix works and that no new errors were introduced.
*   **Review Mode:** Changes are presented in a side-by-side diff for human (or Sentinel agent) approval before being committed.
