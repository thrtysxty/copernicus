export * from './env-sanitizer';
export * from './pty-auditor';
export * from './pattern-detector';
export * from './git-guard';
export * from './sandbox-manager';
export * from './security-manager';

/**
 * Registers IPC handlers for security-related features.
 * This should be called from the main process (e.g., main.ts).
 *
 * @param ipcMain The Electron ipcMain instance.
 * @param store A persistent store instance (e.g., electron-store or similar) for settings.
 */
type HandleIpc = <T>(fn: () => T | Promise<T>) => Promise<{ ok: true; data: T } | { ok: false; error: string }>

export function registerSecurityHandlers(ipcMain: any, store: any, handleIpc: HandleIpc) {
  // Environment Allowlist Management
  ipcMain.handle('security:get-env-allowlist', () =>
    handleIpc(() => store.get('security.envAllowlist', []))
  );

  ipcMain.handle('security:add-env-var', (_: any, key: string) =>
    handleIpc(() => {
      const list = store.get('security.envAllowlist', []) as string[];
      if (!list.includes(key)) { list.push(key); store.set('security.envAllowlist', list); }
      return list;
    })
  );

  ipcMain.handle('security:remove-env-var', (_: any, key: string) =>
    handleIpc(() => {
      const list = (store.get('security.envAllowlist', []) as string[]).filter((k: string) => k !== key);
      store.set('security.envAllowlist', list);
      return list;
    })
  );

  // Sandbox Toggle
  ipcMain.handle('security:get-sandbox-enabled', (_: any, agentId: string) =>
    handleIpc(() => store.get(`security.sandbox.${agentId}`, false))
  );

  ipcMain.handle('security:set-sandbox-enabled', (_: any, agentId: string, enabled: boolean) =>
    handleIpc(() => { store.set(`security.sandbox.${agentId}`, enabled); return enabled; })
  );
}
