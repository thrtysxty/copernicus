# User Story: Terminals & Management Interfaces (ID: 628)

## Actor
The End User and Developer.

## Goal
Establish stable terminal services and a comprehensive management interface for external accounts (GitHub).

## Acceptance Criteria
- [ ] Terminal: Fix `posix_spawnp` failed error when spawning terminals.
- [ ] Jules PTY: Fix rotate button functionality (should open/slide web view).
- [ ] Jules PTY: Remove redundant URL button in header; integrate URL action with rotation.
- [ ] Jules PTY: Side-web-view must use system-defined Copernicus authentication.
- [ ] GitHub Management: Replace simple GitHub page load with a comprehensive management page (repo list/trust, add/remove repos, invite/share links).

## Documentation Impact
- Update `TERMINAL_GUIDE.md` to document the terminal configuration and PTY management.
- Update `USER_GUIDE.md` with instructions on using the new GitHub Management interface.

## Canonical Paths
- PTY Manager: `copernicus/electron/pty-manager.ts`
- GitHub Manager: `copernicus/electron/github-manager.ts`
- Management UI: `copernicus/src/renderer/components/Management.tsx`
