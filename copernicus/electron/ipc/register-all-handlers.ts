import { app, BrowserWindow, ipcMain } from 'electron'
import path from 'node:path'
import { spawn } from 'node:child_process'

import { WorktreeManager } from '../worktree/WorktreeManager'
import { registerWorktreeHandlers } from './worktree-handlers'
import { ExtensionRegistry } from '../extensions/ExtensionRegistry'
import { ExtensionLoader } from '../extensions/ExtensionLoader'
import { registerExtensionHandlers } from './extension-handlers'
import { GenesisRunner } from '../genesis/genesis-runner'
import { ScaffoldRunner } from '../genesis/scaffold'
import { SnapshotManager } from '../workflow/snapshot-manager'
import { registerSecurityHandlers } from '../security'
import { IpcHandlerDeps } from './deps'
import { fsManager } from '../fs-manager'
import { stateLedger } from '../db/state-ledger'

import * as fileHandlers from './file-handlers'
import * as authHandlers from './auth-handlers'
import * as modelHandlers from './model-handlers'
import * as chatHandlers from './chat-handlers'
import * as storyHandlers from './story-handlers'
import * as workflowHandlers from './workflow-handlers'
import * as terminalHandlers from './terminal-handlers'
import * as terminalAgentHandlers from './terminal-agent-handlers'
import * as appHandlers from './app-handlers'
import * as capexHandlers from './capex-handlers'
import * as genesisHandlers from './genesis-handlers'
import * as gitHandlers from './git-handlers'
import * as searchHandlers from './search-handlers'
import * as diagnosticsHandlers from './diagnostics-handlers'
import * as debugHandlers from './debug-handlers'
import * as testHandlers from './test-handlers'
import * as diagHandlers from './diag-handlers'
import * as logHandlers from './log-handlers'
import * as lspHandlers from './lsp-handlers'
import * as securityScoreHandlers from './security-handlers'
import * as localModelHandlers from './local-model-handlers'
import { registerReplayHandlers } from './replay-handlers'
import { handleIpc } from '../utils/handle-ipc'
import { registerStitchHandlers } from './stitch-handlers'
import { registerMemoryHandlers } from './memory-handlers'
import { jsonlExporter } from '../memory/jsonl-exporter'
import { registerRetroHandlers } from './retro-handlers'
import { registerIntelHandlers } from './intel-handlers'
import { registerJulesHandlers } from './jules-handlers'
import * as notebooklmHandlers from './notebooklm-handlers'
import { registerDaemonHandlers } from './daemon-handlers'
import { registerWizardPtyHandlers } from './wizard-pty-handlers'
import { registerProjectHandlers } from './project-handlers'
import { registerOpenRouterHandlers } from './openrouter-handlers'

export async function registerAllIpcHandlers(
  win: BrowserWindow,
  globalDeps: any,
  touchBarCleanup: { remove: () => void } | null,
) {
  // Extensions
  const extensionDir = path.join(app.getPath('home'), '.copernicus', 'extensions')
  const extensionRegistry = ExtensionRegistry.getInstance()
  const extensionLoader = new ExtensionLoader(extensionDir, extensionRegistry)
  await extensionLoader.loadAll()
  registerExtensionHandlers(extensionRegistry, extensionLoader)

  const scaffoldRunner = new ScaffoldRunner()
  const genesisRunner = new GenesisRunner({
    modelRegistry: globalDeps.modelRegistry,
    authManager: globalDeps.authManager,
    storiesManager: globalDeps.storiesManager,
    settingsStore: globalDeps.settingsStore,
    scaffoldRunner,
  })

  const snapshotManager = new SnapshotManager(stateLedger.db, fsManager.getRootPath())
  globalDeps.workflowEngine.setSnapshotManager(snapshotManager)

  const worktreeManager = new WorktreeManager(stateLedger.db, fsManager.getRootPath())

  const deps: IpcHandlerDeps = {
    ...globalDeps,
    genesisRunner,
    scaffoldRunner,
    snapshotManager,
    touchBarCleanup,
    worktreeManager,
    win: win as any,
    extensionRegistry: extensionRegistry as any,
    spawn: spawn as any,
  }

  globalDeps.workflowEngine.setServices(deps)
  fileHandlers.register(win, deps)
  authHandlers.register(win, deps)
  modelHandlers.register(win, deps)
  chatHandlers.register(win, deps)
  storyHandlers.register(win, deps)
  workflowHandlers.register(win, deps)
  terminalHandlers.register(win, deps)
  terminalAgentHandlers.register(win, deps)
  appHandlers.register(win, deps)
  capexHandlers.registerCapexHandlers()
  genesisHandlers.register(win, deps)
  gitHandlers.register(win, deps)
  searchHandlers.register(win, deps)
  diagnosticsHandlers.register(win, deps)
  const cleanupTestHandlers = testHandlers.register(win, deps)
  diagHandlers.register(win, deps)
  logHandlers.registerLogHandlers(win)
  lspHandlers.register(win, deps)
  securityScoreHandlers.register()
  localModelHandlers.register()
  const cleanupReplayHandlers = registerReplayHandlers()
  const cleanupDebugHandlers = debugHandlers.registerDebugHandlers()
  const cleanupWorktreeHandlers = registerWorktreeHandlers(worktreeManager)
  registerSecurityHandlers(ipcMain, globalDeps.settingsStore)
  registerStitchHandlers()
  registerMemoryHandlers()
  registerRetroHandlers(deps)
  registerIntelHandlers()
  registerJulesHandlers(deps)
  notebooklmHandlers.register(deps)
  registerDaemonHandlers()
  registerWizardPtyHandlers()
  registerProjectHandlers()
  registerOpenRouterHandlers()

  ipcMain.handle('memory:export-now', (_e) => handleIpc(async () => {
    const projectId = fsManager.getRootPath()
    await jsonlExporter.export(projectId)
    const exportDir = path.join(app.getPath('userData'), 'memory', jsonlExporter.hashProjectId(projectId))
    return { path: exportDir }
  }))


  // Kanban Columns (Story 428)
  ipcMain.handle('kanban:get-columns', () => handleIpc(() => stateLedger.getKanbanColumns()))
  ipcMain.handle('kanban:set-column', (_e, id: string, updates: Record<string, unknown>) => handleIpc(() => stateLedger.setKanbanColumn(id, updates)))

  return { cleanupTestHandlers, cleanupReplayHandlers, cleanupDebugHandlers, cleanupWorktreeHandlers, worktreeManager }
}
