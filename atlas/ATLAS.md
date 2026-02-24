# ATLAS.md — Development Standards

**Project:** ATLAS IDE (Agentic Terminal & Language Architecture Suite)
**Stack:** Electron 33+, React 18, TypeScript, Tailwind CSS
**Shell:** PTY via `node-pty`, Terminal via `xterm.js`
**Persistence:** SQLite via `better-sqlite3` (located in `~/.atlas/devtime.db`)
**Build System:** Electron Forge + Vite

## Directory Structure
- `atlas/src/main/` — Electron Main Process (System access, PTY, SQLite, Auth)
- `atlas/src/renderer/` — React Renderer Process (UI, Zustand stores, Components)
- `atlas/src/preload/` — ContextBridge API
- `atlas/resources/` — Templates, SQL schemas

## Tool Use Protocol
When implementing features, always adhere to the security boundaries defined in `atlas/src/main/security/`. 

## Shared Services
- **AuthManager:** `src/main/auth/` (Shared credentials)
- **DevTimeManager:** `src/main/devtime.ts` (CapEx tracking)
- **PtyManager:** `src/main/pty.ts` (Terminal management)

## Frontend Patterns
- **State:** Use Zustand (`src/renderer/store/`)
- **Styling:** Use Tailwind CSS utility classes
- **Icons:** Use `lucide-react`

## Commands
```bash
npm install    # Install dependencies
npm start      # Launch in dev mode
npm run build  # Production build
```
