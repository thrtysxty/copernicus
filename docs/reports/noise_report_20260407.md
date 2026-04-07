# Codebase Noise Report - April 7, 2026

This report details the findings from an initial review of the 'Copernicus' repository for "noise" and leftover artifacts from previous project iterations. Due to ongoing tool access restrictions, this report is partial and based only on successfully executed searches and directory listings.

## Summary of Findings

### 1. "high-plains-hipster" References

These references are likely remnants from the project's migration out of the 'high-plains-hipster' project.

*   **`scripts/utils/test_classifier.py`**: Contains `HTTP-Referer": "https://github.com/high-plains-hipster"`.
*   **`scripts/utils/session_digest.py`**: Contains `HTTP-Referer": "https://github.com/high-plains-hipster"`.
*   **`scripts/utils/openrouter_client.py`**: Contains `HTTP-Referer": "https://github.com/high-plains-hipster"`.
    *   **Action Required**: These `HTTP-Referer` values should be updated to reflect the current project's repository.
*   **`docs/stories/completed/story_585_chat_send_lsp_preflight_blocks.md`**: Mentions "high-plains-hipster" in the context of an "Additional bug" description, highlighting a historical issue where the LSP check only worked for the Copernicus IDE repo itself, not for other projects like `high-plains-hipster`.
    *   **Action**: This is a historical documentation reference. Review if the bug is still relevant or if the phrasing can be updated for clarity without losing historical context.

### 2. "Benway" References

"Benway" was a previous name for the project, and numerous remnants still exist.

*   **`docs/reports/researcher_audit_20260305.md`**: This document explicitly flags a `benway` directory as non-existent and refers to `distribution_rescue.patch` as stale, recommending a "Clean Slate" protocol. This document itself is a valuable artifact indicating the need for cleanup.
*   **`docs/planning/sprint_005_parallel_dev_brief.md`**: This planning document directly addresses the renaming from "BENWAY" to "COPERNICUS", providing instructions to substitute paths (e.g., `benway/electron/main.ts` to `copernicus/electron/main.ts`).
*   **`docs/archive/debris_2026_03_05/distribution_rescue.patch`**: This patch file contains extensive references to `benway/` paths (e.g., `diff --git a/benway/electron/main.ts b/benway/electron/main.ts`), an outdated `appId: "com.atlas.benway"`, and UI-related styling (e.g., `bg-benway-bg`, `border-benway-steel`, `text-benway-phosphor`).
    *   **Action Required**: The `distribution_rescue.patch` is definitively stale and should be removed or moved to a more appropriate, clearly demarcated archive location. All references to UI styling with "benway" prefixes suggest that associated CSS variables, classes, or assets might still exist and should be reviewed and updated/removed.

### 3. Areas for Further Investigation (Limited by Tool Access)

Due to policy restrictions on file access and comprehensive content searches, a full review was not possible. The following areas likely contain additional "noise" but could not be thoroughly investigated:

*   **"agentic-platform" references**: A `grep_search` for this term was denied. The `researcher_audit_20260305.md` mentioned an "agentic-boilerplate" embedded in the active source, suggesting related artifacts.
*   **`docs/archive/plans/`**: Contents of this directory could not be inspected, but it may contain outdated planning documents.
*   **Shell scripts in `scripts/`**: Specific scripts like `dev-setup.sh` and others could not be read. These may contain outdated build commands, paths, or other "noise."
*   **`node_modules/` and `dist-electron/`**: These directories, while typically ignored, were flagged as inaccessible by ignore patterns. While often irrelevant for "noise" in terms of source code, their inaccessibility highlights the systemic limitations.

## Tool Access Restrictions Encountered

During this review, I encountered persistent tool access restrictions that prevented a comprehensive analysis. These restrictions manifest in two primary ways:

1.  **"File path '...' is ignored by configured ignore patterns."**: This occurs when attempting to `read_file` or `list_directory` within paths that are typically excluded by `.gitignore` or `.geminiignore` (e.g., `node_modules/`, `dist-electron/`). These patterns are respected by the tools as part of their default design, often for efficiency and to focus on relevant source code.
    *   **Affected paths**:
        *   `/Users/dadmin/Projects/copernicus/copernicus/node_modules/vite-plugin-electron/package.json`
        *   `/Users/dadmin/Projects/copernicus/copernicus/dist-electron/main.js`

2.  **"Tool execution denied by policy."**: This indicates that an internal security or operational policy within the Gemini CLI environment prevented the attempted action. This is a system-level block that I cannot override or inspect for its specific rules.
    *   **Affected operations/paths**:
        *   `grep_search` for "agentic-platform" across the repository.
        *   `read_file` on `/Users/dadmin/Projects/copernicus/scripts/dev-setup.sh`.
        *   `git status` command.
        *   `write_todos` (updating this internal TODO list)

These limitations significantly hindered the ability to perform a complete review of the repository's "noise."
