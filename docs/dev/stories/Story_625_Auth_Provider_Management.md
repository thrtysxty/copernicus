# User Story: Auth & Provider Management Infrastructure (ID: 625)

## Actor
The End User and Developer.

## Goal
Establish a reliable and secure authentication flow for external providers and system-wide services.

## Acceptance Criteria
- [ ] Fix Wizard OAuth flow: Ensure pre-authenticated pages (claude.ai) and Google OAuth (401 Invalid Client) function correctly.
- [ ] Jules PTY authentication: The side-web-view must use system-defined authentication for Copernicus.
- [ ] Settings (Providers): All system and user providers must have functional authentication fields, links, and triggers.
- [ ] Revocation: Users must be able to revoke access to any configured provider within the settings.
- [ ] Provider list: Draggable priority list for providers (Settings:Embedding).

## Documentation Impact
- Update `AUTH_FLOW.md` to document the system-wide authentication strategy.
- Update `USER_GUIDE.md` with instructions on managing and revoking provider access.

## Canonical Paths
- Auth Manager: `copernicus/electron/auth-manager.ts`
- Settings View: `copernicus/src/renderer/components/Settings.tsx`
- Jules PTY Manager: `copernicus/electron/pty-manager.ts`
