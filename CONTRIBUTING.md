# CONTRIBUTING.md — Developer Documentation Suite

Welcome to the Copernicus development team! This guide outlines the essential protocols, workflows, and standards for contributing to the project. Adhering to these guidelines ensures a consistent, high-quality, and maintainable codebase.

## Story Lifecycle

The lifecycle of a story in Copernicus follows a clear progression, with specific gates at each transition:

1.  **DRAFT**: Initial idea or feature request.
2.  **APPROVED FOR IMPLEMENTATION**: Story is reviewed and approved by the architect (Claude) and is ready to be assigned.
    *   **Gate**: Thorough review of Acceptance Criteria, feasibility, and alignment with project goals.
3.  **IN PROGRESS**: Story is assigned to an agent (Gemini or Jules) and implementation has begun.
    *   **Gate**: Agent dispatch.
4.  **REVIEW**: Agent has completed its work, and the changes are awaiting human (or Claude) review.
    *   **Gate**: Completion of agent task, uncommitted changes available for review.
5.  **COMPLETE**: Story has been fully implemented, reviewed, and merged.
    *   **Gate**: See [Completion Protocol](#completion-protocol) below.

## Story Format

All stories are defined in Markdown files within `docs/stories/`. They must adhere to the following structure and naming conventions:

-   **File Naming**: `story_NNN_slug.md` (e.g., `story_123_implement_feature_x.md`)
-   **Required Headers**: Each story file must include:
    *   `# Story NNN: Title`
    *   `**Status:** [DRAFT|APPROVED FOR IMPLEMENTATION|IN PROGRESS|REVIEW|COMPLETE]`
    *   `**Priority:** [P0|P1|P2]`
    *   `**Assigned To:** [Jules|Gemini|Claude|—]`
    *   `**Blocked By:** NNN (or —)`
    *   `**Blocks:** NNN (or —)`
    *   `## Acceptance Criteria`
    *   `## Definition of Done`

## Dispatch Workflow

Stories are dispatched to agents based on their scope and complexity:

-   **Jules (Async PR Agent)**: For TypeScript/React single-concern stories. Results in a GitHub branch + PR.
    ```bash
    bash scripts/jules_assign.sh docs/stories/story_NNN_your_story_title.md
    # Use --as [bolt|palette|sentinel] for specific personas or --dry-run for a preview.
    ```
-   **Gemini (PTY Session Agent)**: For Python/shell/docs stories, multi-file refactors, or background "yolo" mode tasks.
    ```bash
    gemini -p "$(cat /tmp/prompt.md)" --approval-mode yolo
    ```

## Pre-Dispatch Checklist

Before dispatching any story, ensure the following checks are performed:

1.  **Verify Not Already Implemented**:
    ```bash
    git log origin/main --oneline --grep="feat(story-NNN)" -i
    ```
    Replace `NNN` with the story number. If any commit appears, the story is already implemented.
2.  **Story Status**: The story's status must be `APPROVED FOR IMPLEMENTATION`.
3.  **Main Branch Sync**: Ensure `origin/main` is in sync with your local `main` branch.
    ```bash
    git fetch origin main && git log origin/main..main --oneline
    ```
    If any unpushed commits exist, push them before dispatching.
4.  **IPC Compliance**: Run the IPC linting script.
    ```bash
    bash scripts/ipc-lint.sh
    ```
5.  **TypeScript Check**: `cd copernicus && npx tsc --noEmit` must pass with zero errors (for existing codebase).
6.  **Schema Changes**: If schema changes are part of the story, ensure a corresponding migration is planned.
7.  **IPC Channels**: Verify all new IPC channels are declared in `copernicus/electron/preload.ts` (`SEND_CHANNELS` and `RECEIVE_CHANNELS`).

## Completion Protocol

A story is considered complete only after passing a rigorous verification gate. For full details, refer to [`docs/reference/COMPLETION_PROTOCOL.md`](docs/reference/COMPLETION_PROTOCOL.md). Key steps include:

1.  **TypeScript Gate**: `cd copernicus && npx tsc --noEmit` must exit clean (zero errors).
2.  **Test Gate**: `python3 -m pytest backend/tests/` must pass all tests.
3.  **Build Gate**: For any changes touching Electron or the renderer, `cd copernicus && npm run build` must produce a DMG with no errors.
4.  **AC Diff Review**: The diff is reviewed against the story's Acceptance Criteria to ensure all items are implemented.

## IPC Conventions

Copernicus enforces strict IPC (Inter-Process Communication) conventions for security and maintainability:

-   **`handleIpc()` Wrapper**: Every `ipcMain.handle` registration in the main process (`copernicus/electron/main.ts`) **must** be wrapped by `handleIpc()` for consistent error handling and result formatting.
    ```typescript
    ipcMain.handle('channel:name', (_e, arg) => handleIpc(() => manager.doSomething(arg)));
    ```
-   **`useIpcError()` Hook**: In the renderer process (React components), all IPC calls **must** use the `useIpcError()` hook. Never directly call `window.ipcRenderer.invoke`.
    ```typescript
    const invoke = useIpcError();
    const result = await invoke<MyType>('channel:name', arg);
    ```
-   **`unwrapIpc()` Utility**: Always check the `ok` property of the `IpcResult` and use `unwrapIpc<T>()` from `src/renderer/types/ipc.ts` to access the actual data.
-   **Channel Registry**: All IPC channels (both `SEND_CHANNELS` and `RECEIVE_CHANNELS`) must be explicitly registered in `copernicus/electron/preload.ts`.

For more in-depth details, refer to the [IPC section in `docs/reference/TECHNICAL_BIBLE.md`](docs/reference/TECHNICAL_BIBLE.md#ipc-contract).

## Secrets & Configuration

-   **API Keys (`~/.secrets`)**: All sensitive API keys (e.g., `ANTHROPIC_API_KEY`, `JULES_API_KEY`, `GITHUB_TOKEN`) must be stored in a `~/.secrets` file in your home directory. This file is sourced by scripts and is explicitly ignored by Git. **Do not commit API keys or sensitive information directly into the repository.**
-   **Application Configuration (`config.env`)**: Application-specific environment variables (e.g., `OLLAMA_BASE_URL`, `COPERNICUS_BACKEND_PORT`) are managed in a `config.env` file.
    *   **macOS**: `~/Library/Application Support/copernicus/config.env`
    *   **Linux**: `~/.config/copernicus/config.env`
-   **No `.env` at Project Root**: The project **does not** use a `.env` file at the root.

## Commit Message Format

All commit messages **must** follow the Conventional Commits specification, specifically:

```
feat(story-NNN): concise description of the change
```

-   `feat`: Indicates a new feature. Other types like `fix`, `docs`, `chore` are also acceptable.
-   `story-NNN`: The story number that the commit relates to.
-   **NO `Co-Authored-By` or authoring trailers of any kind are permitted.** This is strictly enforced.
