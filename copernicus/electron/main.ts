import { config } from './config'
import { app, BrowserWindow, ipcMain, session, globalShortcut, Menu, MenuItemConstructorOptions } from 'electron'

import path from 'node:path'
import { spawn, execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import log from 'electron-log'
import { autoUpdater } from 'electron-updater'

import { AuthManager } from './auth-manager'
import { ModelRegistry } from './models/model-registry'
import { initializeSecurityManager, GitGuardDecision, GitPushRequest } from './security'
import { SettingsStore } from './settings-store'
import { createTouchBar } from './touch-bar'
import { DEFAULT_TOUCH_BAR_CONFIG } from './touch-bar-types'
import { StoriesManager } from './stories'
import { ptyManager } from './pty-manager'
import { stateLedger } from './db/state-ledger'
import { mlxProvider } from './mlx-provider'
import { DevtimeManager } from './devtime-manager'
import { GithubManager } from './github-manager'
import { llmService } from './llm/service'
import { fsManager } from './fs-manager'
import { workflowEngine } from './workflow/engine'
import { codebaseIndexer } from './codebase-indexer'
import { hybridRetriever } from './llm/hybrid-retrieval'
import { initModelsCache } from './llm/models-cache'
import { loadProvidersConfig } from './llm/config-loader'
import { browserSession } from './browser-session'
import { dispatchJulesSession } from './jules/dispatcher'
import { julesMonitor } from './jules/monitor'
import { julesManager } from './jules/jules-manager'
import { lspManager } from './lsp/lsp-manager'
import { backendManager } from './backend-manager'
import { socketManager } from './socket-manager'
import { JulesClient } from './jules/jules-client'
import { applyAndVerifyPatch, reversePatch } from './utils/patch-manager'
import { runRAGBenchmark } from './utils/rag-benchmark'
import { addRecentProject } from './utils/recent-projects'
import { localModelManager } from './local-model/LocalModelManager'
import { WorktreeManager } from './worktree/WorktreeManager'
import { detectStack } from './skills/stack-detector'
import { auditSkillDescriptions } from './skills/description-auditor'
import { loadKnowledgeBase } from './kb/kb-loader'
import { registerTelemetryHandlers, registerSkillsHandlers } from './ipc/telemetry-skills-handlers'

import { registerAllIpcHandlers } from './ipc/register-all-handlers'
import { ensureCopernicusDirectory, LOG_DIR } from './utils/app-setup'
import { ExtensionHostManager } from './extensions/ExtensionHostManager'
import { ExtensionRegistry } from './extensions/ExtensionRegistry'
import { collectorProcess, startCollector, killCollector } from './telemetry'

process.env.DIST = path.join(__dirname, '../dist')
process.env.VITE_PUBLIC = app.isPackaged ? process.env.DIST : path.join(__dirname, '../public')
process.on('uncaughtException', (error: Error) => {
  log.error('[Main] uncaughtException:', error.stack ?? error.message)
  BrowserWindow.getAllWindows().forEach(w => {
    if (!w.isDestroyed()) {
      w.webContents.send('app:critical-error', { type: 'uncaughtException', message: error.message, stack: error.stack })
    }
  })
})

process.on('unhandledRejection', (reason: unknown) => {
  const message = reason instanceof Error ? reason.message : String(reason)
  const stack   = reason instanceof Error ? reason.stack  : undefined
  log.error('[Main] unhandledRejection:', stack ?? message)
  BrowserWindow.getAllWindows().forEach(w => {
    if (!w.isDestroyed()) {
      w.webContents.send('app:critical-error', { type: 'unhandledRejection', message, stack })
    }
  })
})

export let win: BrowserWindow | null
let isFirstRun = false;
let touchBarCleanup: { remove: () => void } | null = null
let worktreeManager: WorktreeManager | null = null
let extensionHostManager: ExtensionHostManager | null = null
export const getExtensionHostManager = () => extensionHostManager;
let ipcCleanupFns: {
  cleanupTestHandlers: () => void
  cleanupReplayHandlers: () => void
  cleanupDebugHandlers: () => void
  cleanupWorktreeHandlers: () => void
} | null = null

const VITE_DEV_SERVER_URL = process.env.NODE_ENV === 'development' ? process.env['VITE_DEV_SERVER_URL'] : undefined
if (process.env.NODE_ENV === 'production' && process.env['VITE_DEV_SERVER_URL']) {
  throw new Error('Security violation: VITE_DEV_SERVER_URL exposed in production');
}
// Suppress expected CSP warnings in dev (unsafe-eval required by Vite HMR)
if (process.env.NODE_ENV === 'development') {
  process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true'
}

if (!app.isPackaged) {
  app.commandLine.appendSwitch('remote-debugging-port', '9223');
}

const authManager = new AuthManager()
const julesClient = new JulesClient(authManager.getApiKey('jules') ?? '')
julesMonitor.setClient(julesClient)

ipcMain.on('auth:key-changed', (_e, { provider, key }) => {
  if (provider === 'jules') {
    julesClient.reinit(key)
    julesMonitor.setClient(julesClient)
  }
})

const githubManager = new GithubManager(authManager)
const modelRegistry = new ModelRegistry()
export const settingsStore = new SettingsStore()
export const storiesManager = new StoriesManager(os.homedir(), stateLedger)
const devtimeManager = new DevtimeManager()

initializeSecurityManager({
  requestConfirmation: async (request: GitPushRequest): Promise<GitGuardDecision> => {
    if (!win) return 'BLOCK';
    win.webContents.send('security:git-push-request', request);
    return new Promise((resolve) => {
      ipcMain.once(`security:git-push-response:${request.command}`, (_event, decision: GitGuardDecision) => { resolve(decision); });
      setTimeout(() => resolve('BLOCK'), 60000);
    });
  }
});

function createWindow() {
  const isDebug = process.env.COPERNICUS_DEBUG === 'true';
  win = new BrowserWindow({
    width: 1200, height: 800, minWidth: 1024, minHeight: 640, show: true, frame: false, backgroundColor: '#050505',
    titleBarStyle: 'hiddenInset', title: isFirstRun ? (isDebug ? 'COPERNICUS SETUP [DEBUG]' : 'COPERNICUS SETUP') : (isDebug ? 'COPERNICUS IDE [DEBUG]' : 'COPERNICUS'),
    trafficLightPosition: { x: 12, y: 8 }, vibrancy: process.platform === 'darwin' ? 'under-window' : undefined,
    visualEffectState: process.platform === 'darwin' ? 'active' : undefined,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true, webviewTag: false },
  })
  if (isDebug) { win.webContents.openDevTools(); log.transports.file.level = 'debug'; }

  // Pair-test: forward renderer console to main-process log
  const CONSOLE_LEVELS = ['LOG', 'INFO', 'WARN', 'ERROR'];
  win.webContents.on('console-message', (_e, level, message, line, sourceId) => {
    const tag = CONSOLE_LEVELS[level] ?? 'LOG';
    const src = sourceId ? ` (${sourceId}:${line})` : '';
    if (level >= 2) {
      log.warn(`[renderer:${tag}]${src} ${message}`);
    } else {
      log.info(`[renderer:${tag}]${src} ${message}`);
    }
  });

  storiesManager.setWindow(win); julesMonitor.setWindow(win); lspManager.setWindow(win); 
  if (process.platform === 'darwin') {
    const tbConfig = { ...DEFAULT_TOUCH_BAR_CONFIG, ...(settingsStore.getAll()?.touchBar as any ?? {}) }
    touchBarCleanup = createTouchBar(win, tbConfig)
  }

  // Story 380: Sync fullscreen state to renderer for ESC handling
  win.on('enter-full-screen', () => win?.webContents.send('window:fullscreen-state', true))
  win.on('leave-full-screen', () => win?.webContents.send('window:fullscreen-state', false))

  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', (new Date).toLocaleString())
    julesMonitor.resumeWatching()

    // Story 524: prompt to register daemon on first packaged launch
    if (app.isPackaged) {
      let daemonRegistered = false
      try {
        if (process.platform === 'darwin') {
          daemonRegistered = fs.existsSync(path.join(app.getPath('home'), 'Library', 'LaunchAgents', 'com.copernicus.jules-daemon.plist'))
        } else if (process.platform === 'linux') {
          try {
            execFileSync('systemctl', ['--user', 'is-enabled', 'jules-daemon'], { stdio: 'ignore' })
            daemonRegistered = true
          } catch (e) {
            log.warn('[Main] Failed to check jules-daemon status on linux:', e);
          }
        } else if (process.platform === 'win32') {
          try {
            execFileSync('powershell.exe', ['-Command', 'Get-ScheduledTask -TaskName CopernicusJulesDaemon -ErrorAction Stop'], { stdio: 'ignore' })
            daemonRegistered = true
          } catch (e) {
            log.warn('[Main] Failed to check jules-daemon status on win32:', e);
          }
        }
      } catch (e) {
        log.warn('[Main] Error during daemon registration check:', e);
      }
      if (!daemonRegistered) {
        setTimeout(() => win?.webContents.send('daemon:prompt-install'), 3000)
      }
    }
  })
  if (ipcCleanupFns) {
    win.webContents.on('did-start-loading', () => {
      ipcCleanupFns!.cleanupTestHandlers()
      ipcCleanupFns!.cleanupReplayHandlers()
      ipcCleanupFns!.cleanupDebugHandlers()
      ipcCleanupFns!.cleanupWorktreeHandlers()
    })
  }
  const appVersion = app.getVersion()
  if (isFirstRun) {
    VITE_DEV_SERVER_URL ? win.loadURL(`${VITE_DEV_SERVER_URL}?window=wizard&version=${appVersion}`) : win.loadFile(path.join(process.env.DIST!, 'index.html'), { query: { window: 'wizard', version: appVersion } })
  } else {
    VITE_DEV_SERVER_URL ? win.loadURL(`${VITE_DEV_SERVER_URL}?version=${appVersion}`) : win.loadFile(path.join(process.env.DIST!, 'index.html'), { query: { version: appVersion } })
  }
}

async function registerIpcHandlers() {
  const globalDeps = {
        authManager, githubManager, modelRegistry, settingsStore, storiesManager, devtimeManager,
        fsManager, workflowEngine, codebaseIndexer, hybridRetriever, browserSession, ptyManager,
        socketManager, stateLedger, llmService, lspManager, backendManager, julesClient, julesMonitor, julesManager,
        applyAndVerifyPatch, reversePatch, runRAGBenchmark,
        getPlaywright: async () => await import('playwright-core'), // utility function not a manager
        dispatchJulesSession, createTouchBar, DEFAULT_TOUCH_BAR_CONFIG,
        isFirstRun, spawn, LOG_DIR
      }

  // Register extracted handlers
  registerTelemetryHandlers({
    collectorProcess,
    fsManager,
    stateLedger,
  });
  registerSkillsHandlers({
    fsManager,
  });

  const { cleanupTestHandlers, cleanupReplayHandlers, cleanupDebugHandlers, cleanupWorktreeHandlers, worktreeManager: registeredWorktreeManager } =
    await registerAllIpcHandlers(win!, globalDeps, touchBarCleanup)

  worktreeManager = registeredWorktreeManager
  ipcCleanupFns = { cleanupTestHandlers, cleanupReplayHandlers, cleanupDebugHandlers, cleanupWorktreeHandlers }
}

app.on('window-all-closed', () => { ptyManager.killAll(); if (process.platform !== 'darwin') app.quit() })
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
app.on('will-quit', () => { globalShortcut.unregisterAll() })
app.on('before-quit', async () => {
  killCollector()
  await codebaseIndexer.stop()
  localModelManager.stop();
  lspManager.stop();
  backendManager.stop();
  socketManager.disconnect();
  stateLedger.close();
  if (browserSession.browser) await browserSession.browser.close().catch(err => log.error(err))
})

app.whenReady().then(async () => {
  // Story 453: Spawn OTel Collector sidecar
  const dbPath = path.join(app.getPath('userData'), 'copernicus.db');
  const collectorScript = path.join(__dirname, '../../collector/sqlite_exporter.py');

  if (settingsStore.getAll().enableOtelCollector) {
    startCollector(dbPath, collectorScript)
  }

  try {
    await registerIpcHandlers()
  } catch (err: unknown) {
    const msg = err instanceof Error ? (err.stack ?? err.message) : String(err)
    log.error('[Main] CRITICAL: registerIpcHandlers() failed — window will open without handlers:', msg)
  }
  backendManager.start(); setTimeout(() => socketManager.connect(), 3000)
  if (process.platform === 'darwin') {
    app.setAboutPanelOptions({ applicationName: 'COPERNICUS', applicationVersion: app.getVersion(), copyright: '© 2026 COPERNICUS IDE Team', credits: 'Professional Phosphor Edition' });
  }
  const isDev = !!VITE_DEV_SERVER_URL
  const scriptSrc = isDev
    ? "script-src 'self' 'unsafe-eval' 'unsafe-inline' blob: file: http://localhost:5173"
    : "script-src 'self' blob: file:"
  const connectSrc = isDev
    ? `connect-src 'self' ${config.backend.url.replace('http://','')} ws://localhost:5173 http://localhost:5173 https://api.anthropic.com https://openrouter.ai https://api.openai.com https://generativelanguage.googleapis.com https://api.github.com`
    : "connect-src 'self' https://api.anthropic.com https://openrouter.ai https://api.openai.com https://generativelanguage.googleapis.com https://api.github.com"
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({ responseHeaders: { ...details.responseHeaders, 'Content-Security-Policy': [`default-src 'self'; ${scriptSrc}; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: blob:; font-src 'self' data: https://fonts.gstatic.com; ${connectSrc}; worker-src 'self' blob: file:;`] } })
  })

  // Story 589: Strip headers for NotebookLM webview
  session.fromPartition('persist:notebooklm').webRequest.onHeadersReceived(
    { urls: ['*://notebooklm.google.com/*'] },
    (details, callback) => {
      const { responseHeaders } = details
      if (responseHeaders) {
        // Strip X-Frame-Options and Content-Security-Policy: frame-ancestors
        for (const header of Object.keys(responseHeaders)) {
          if (header.toLowerCase() === 'x-frame-options' || header.toLowerCase() === 'content-security-policy') {
            delete responseHeaders[header]
          }
        }
      }
      callback({ cancel: false, responseHeaders })
    }
  )
  // Only configure workspace if it was already saved — new users go through the wizard
  const existingWorkspace = (settingsStore.getAll().workspace as string) || (settingsStore.getAll().workingDir as string)
  if (existingWorkspace) {
    let workspaceRoot = existingWorkspace
    if (!fs.existsSync(workspaceRoot)) try { fs.mkdirSync(workspaceRoot, { recursive: true }); } catch (e) { log.error(e); workspaceRoot = os.homedir(); }
    settingsStore.set('workspace', workspaceRoot);
    settingsStore.set('workingDir', workspaceRoot);
    fsManager.setRootPath(workspaceRoot); storiesManager.setProjectRoot(workspaceRoot);
    addRecentProject(workspaceRoot, settingsStore);

    const auditResults = auditSkillDescriptions(workspaceRoot);
    if (win) {
      stateLedger.logEvent(
        'skill-audit',
        JSON.stringify(auditResults),
        { timestamp: new Date().toISOString() }
      );
    }

    // Story 462: Skill Onboarding Card
    const stackProfile = detectStack(workspaceRoot);
    let validSkillCount = 0;
    const skillsDir = path.join(workspaceRoot, '.claude', 'skills');
    if (fs.existsSync(skillsDir)) {
      try {
        const entries = fs.readdirSync(skillsDir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isDirectory()) {
            const skillMdPath = path.join(skillsDir, entry.name, 'SKILL.md');
            if (fs.existsSync(skillMdPath)) {
              validSkillCount++;
            }
          }
        }
      } catch (err) {
        log.error('Failed to read skills directory:', err);
      }
    }
    
    // Defer emitting until window is fully loaded (which happens soon after createWindow)
    if (validSkillCount < 2) {
      app.on('browser-window-created', (_e, window) => {
        window.webContents.once('did-finish-load', () => {
          window.webContents.send('skills:onboarding-needed', stackProfile);
        });
      });
      // also if win already exists, send it
      if (win) {
        win.webContents.once('did-finish-load', () => {
          win?.webContents.send('skills:onboarding-needed', stackProfile);
        });
      }
    }
  }
  const firstRunRef = { current: isFirstRun }
  ensureCopernicusDirectory(settingsStore, firstRunRef)
  isFirstRun = firstRunRef.current
  createWindow();

  // Story 681: Native Application Menus with Keyboard Shortcuts
  const isMac = process.platform === 'darwin'
  const template: MenuItemConstructorOptions[] = [
    ...(isMac ? [{
      label: app.name,
      submenu: [
        { role: 'about' as const },
        { type: 'separator' as const },
        { label: 'Preferences...', accelerator: 'CmdOrCtrl+,', click: () => { win?.webContents.send('layout:open-palette', { mode: 'settings' }) } },
        { type: 'separator' as const },
        { role: 'hide' as const },
        { role: 'hideOthers' as const },
        { role: 'unhide' as const },
        { type: 'separator' as const },
        { role: 'quit' as const }
      ]
    }] : []),
    {
      label: 'File',
      submenu: [
        { label: 'New Project…', accelerator: 'CmdOrCtrl+N', click: () => { win?.webContents.send('layout:open-genesis') } },
        { label: 'Open Folder…', accelerator: 'CmdOrCtrl+O', click: () => { win?.webContents.send('dialog:open-folder') } },
        { role: 'close' as const }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' as const },
        { role: 'redo' as const },
        { type: 'separator' as const },
        { role: 'cut' as const },
        { role: 'copy' as const },
        { role: 'paste' as const },
        { role: 'selectAll' as const },
        { type: 'separator' as const },
        { label: 'Find', accelerator: 'CmdOrCtrl+F', click: () => { win?.webContents.send('layout:open-palette', { mode: 'search' }) } }
      ]
    },
    {
      label: 'View',
      submenu: [
        { label: 'Planner', accelerator: 'CmdOrCtrl+1', click: () => { win?.webContents.send('layout:set-view', 'planner') } },
        { label: 'Editor', accelerator: 'CmdOrCtrl+2', click: () => { win?.webContents.send('layout:set-view', 'editor') } },
        { label: 'Designer', accelerator: 'CmdOrCtrl+3', click: () => { win?.webContents.send('layout:set-view', 'designer') } },
        { label: 'Orchestrator', accelerator: 'CmdOrCtrl+4', click: () => { win?.webContents.send('layout:set-view', 'orchestrator') } },
        { label: 'Telemetry', accelerator: 'CmdOrCtrl+5', click: () => { win?.webContents.send('layout:set-view', 'command-center') } },
        { label: 'Agent Memory', accelerator: 'CmdOrCtrl+6', click: () => { win?.webContents.send('layout:set-view', 'memory') } },
        { label: 'Reviews', accelerator: 'CmdOrCtrl+7', click: () => { win?.webContents.send('layout:set-view', 'review') } },
        { label: 'Testing & Diagnostics', accelerator: 'CmdOrCtrl+8', click: () => { win?.webContents.send('layout:set-view', 'diagnostics') } },
        { label: 'Source Control', accelerator: 'CmdOrCtrl+9', click: () => { win?.webContents.send('layout:set-view', 'git') } },
        { label: 'Reporter', accelerator: 'CmdOrCtrl+0', click: () => { win?.webContents.send('layout:set-view', 'reporter') } },
        { type: 'separator' as const },
        { label: 'Debug', click: () => { win?.webContents.send('layout:set-view', 'debug') } },
        { label: 'Browser', click: () => { win?.webContents.send('layout:set-view', 'browser') } },
        { label: 'Database', click: () => { win?.webContents.send('layout:set-view', 'database') } },
        { label: 'Agent Hub', click: () => { win?.webContents.send('layout:set-view', 'hub:org-chart') } },
        { label: 'Knowledge Base', click: () => { win?.webContents.send('layout:set-view', 'knowledge-base') } },
        { type: 'separator' as const },
        // AC-4: we keep globalShortcut.register('CommandOrControl+P') below, so we use registerAccelerator: false to avoid collision
        { label: 'Command Palette', accelerator: 'CmdOrCtrl+P', registerAccelerator: false, click: () => { win?.webContents.send('layout:open-palette', { mode: 'all' }) } },
        { label: 'Toggle Sidebar', accelerator: 'CmdOrCtrl+B', click: () => { win?.webContents.send('layout:toggle-sidebar') } },
        { role: 'togglefullscreen' as const }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' as const },
        { role: 'zoom' as const },
        { type: 'separator' as const },
        { role: 'front' as const }
      ]
    },
    {
      role: 'help' as const,
      submenu: [
        ...(isMac ? [{ role: 'help' as const }] : []),
        { label: 'Copernicus Documentation', click: async () => { const { shell } = require('electron'); await shell.openExternal('https://github.com/copernicus-ide/docs') } }
      ]
    }
  ]
  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)

  // Story 652: initialize MLX Provider
  mlxProvider.initializeWithSettings(settingsStore);

  extensionHostManager = new ExtensionHostManager(ExtensionRegistry.getInstance())
  extensionHostManager.start()

  if (worktreeManager && win) {
    worktreeManager.startPolling(win);
  }
  globalShortcut.register('CommandOrControl+P', () => win?.webContents.send('layout:open-palette', { mode: 'all' }))
  globalShortcut.register('CommandOrControl+Shift+P', () => win?.webContents.send('layout:open-palette', { mode: 'commands' }))

  const startupTasks = async () => {
    try {
      // Story 627 — Provider Config File
      await initModelsCache()
      loadProvidersConfig()

      if (win) win.webContents.send('app:ready-status', 'Loading knowledge base...')
      loadKnowledgeBase()

      if (win) win.webContents.send('app:ready-status', 'Starting workspace index...')
      await codebaseIndexer.startIndexing(fsManager.getRootPath()).catch(err => {
        log.error('Index failed:', err)
      })
      if (win) win.webContents.send('app:ready-status', 'Starting LSP...')
      await lspManager.start(fsManager.getRootPath())
      if (app.isPackaged) autoUpdater.checkForUpdatesAndNotify().catch(err => log.warn('[AutoUpdater] update check failed:', err));
      if (win) win.webContents.send('app:ready-status', 'Ready.')
    } finally {
      if (win) win.webContents.send('app:ready')
    }
  }
  startupTasks()

  // Story 361: Auto-start local model if Ollama is not detected
  fetch(`${config.ollama.url}/api/tags`, { signal: AbortSignal.timeout(2000) })
    .then(res => {
      if (!res.ok) localModelManager.start().catch(log.error);
    })
    .catch(() => {
      localModelManager.start().catch(log.error);
    });

})

app.on('browser-window-focus', () => {
  const synced = storiesManager.syncFromDisk()
  if (synced > 0) { win?.webContents.send('stories:updated', storiesManager.listStories()) }
})
