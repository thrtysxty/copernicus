Use when writing or modifying code that interacts with the {{PROJECT_NAME}} internal API or libraries, specifically to ensure consistent IPC channel usage and avoid common lookup errors.

## Instructions

When working in {{REPO_ROOT}} with {{STACK}} on API or library interactions:
1. Always verify the correct IPC channel name before invoking.
2. Ensure you have properly registered channels in both main and preload.
3. Check `references/patterns.md` for standard request/response patterns in our {{STACK}} application.
4. Review `references/gotchas.md` to avoid known failure cases.

## Notes

- Examples of common lookup patterns include fetching user settings via `invoke<Settings>('settings:get')` or reading file contents via `invoke<string>('fs:read-file', path)`.
- Use the provided patterns to keep API interactions consistent across the application.
