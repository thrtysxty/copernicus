# Report: Story 133 — Force Google & Anthropic Login

## Status
- **Date:** 2026-02-26
- **Result:** SUCCESS
- **Story:** Story 133

## Summary
Updated the authentication flows in the Copernicus IDE (specifically the setup wizard) to force user re-authentication and account selection. This prevents the application from automatically using existing browser sessions, ensuring that users can explicitly choose or switch accounts during setup.

## Changes
### `copernicus/electron/main.ts`
- Modified the `oauth:start-google` IPC handler.
- Updated the `prompt` parameter from `'consent select_account'` to `'login consent select_account'` to force a full re-authentication for Google OAuth.

### `copernicus/src/renderer/components/wizard/Wizard.tsx`
- Updated the **Anthropic API Key** link to `https://platform.claude.com/login?prompt=login&returnTo=%2Fsettings%2Fkeys`.
- Updated the **Claude.ai** link to `https://claude.ai/login?returnTo=%2Fsettings`.

## Verification Results
- **Build:** `npm run build` in the `copernicus` directory completed successfully.
- **TypeScript:** `npx tsc --noEmit` passed with zero errors.
- **URL Verification:** 
    - Google OAuth now includes `prompt=login+consent+select_account`.
    - Anthropic links now explicitly target the login gateway with re-authentication prompts and deep-link redirections.
