# COPERNICUS PLATFORM // DEVELOPER GUIDE
═══════════════════════════════════════════════

## 1. Architectural Overview
COPERNICUS is a multi-process Electron application designed for deterministic agentic coordination.

*   **Main Process (`copernicus/electron/`):** Orchestrates PTY managers, SQLite state ledgers (Auth, Devtime, State), and the Interop Message Bus.
*   **Renderer Process (`copernicus/src/`):** React/TypeScript shell utilizing Zustand for global layout and agent state management.
*   **Agent Bridge (`scripts/`):** Python-based CLI tools that allow LLMs to interact with the file system and IDE.

## 2. State Ledger & Persistence
Every agent intent and tool result MUST be persisted.
*   **state.db:** Intent logging and event history.
*   **devtime.db:** Financial session tracking.
*   **settings.json:** User preferences and security allowlists.

## 3. Extending the Platform
### Adding IPC Handlers
New system capabilities should be registered in `copernicus/electron/main.ts`:
```typescript
ipcMain.handle('system:new-feature', async (_, args) => {
  return await featureService.execute(args);
});
```

### Adding Slash Commands
New commands are registered in the `CommandDispatcher`:
```typescript
registerCommand('/my-cmd', (args) => {
  // Logic here
});
```

## 4. Building "Agentic Apps" (The SDK)
To bootstrap a new compliant project (like CORE), use the `agentic-platform` SDK:

1.  **Lifecycle Hooks:** Copy `scripts/lifecycle/*.py` to your repo.
2.  **Telemetry:** Import `src/agentic/telemetry.py` for subagent tree tracking.
3.  **CapEx:** Shared access to `~/.copernicus/devtime.db` ensures financial continuity.

## 5. Security Gates
Before code is archived, it must pass the **Security Audit Persona**:
*   `scripts/utils/security_audit.py` scans for high-entropy strings and hardcoded keys.
*   All new IPC handlers must be audited for raw shell access vulnerabilities.
