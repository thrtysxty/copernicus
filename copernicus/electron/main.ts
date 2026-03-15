import { app, BrowserWindow, ipcMain, session, globalShortcut } from 'electron'
import path from 'node:path'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import log from 'electron-log'
import { autoUpdater } from 'electron-updater'
import { AuthManager } from './auth-manager'
import { ModelRegistry } from './models/model-registry'
import { registerSecurityHandlers, initializeSecurityManager, GitGuardDecision, GitPushRequest } from './security'
import { SettingsStore } from './settings-store'
import { createTouchBar } from './touch-bar'
import { DEFAULT_TOUCH_BAR_CONFIG } from './touch-bar-types'
import { StoriesManager } from './stories'
import { ptyManager } from './pty-manager'
import { stateLedger } from './db/state-ledger'
import { DevtimeManager } from './devtime-manager'
import { GithubManager } from './github-manager'
import { llmService } from './llm/service'
import { fsManager } from './fs-manager'
import { workflowEngine } from './workflow/engine'
import { codebaseIndexer } from './codebase-indexer'
import { hybridRetriever } from './llm/hybrid-retrieval'
import { browserSession } from './browser-session'
import { dispatchJulesSession } from './jules/dispatcher'
import { julesMonitor } from './jules/monitor'
import { julesManager } from './jules/jules-manager'
import { lspManager } from './lsp/lsp-manager'
import { backendManager } from './backend-manager'
import { socketManager } from './socket-manager'
import { applyAndVerifyPatch, reversePatch } from './utils/patch-manager'
import { runRAGBenchmark } from './utils/rag-benchmark'
import { addRecentProject } from './utils/recent-projects'
import { SnapshotManager } from './workflow/snapshot-manager'

import * as fileHandlers from './ipc/file-handlers'
import * as authHandlers from './ipc/auth-handlers'
import * as modelHandlers from './ipc/model-handlers'
import * as chatHandlers from './ipc/chat-handlers'
import * as storyHandlers from './ipc/story-handlers'
import * as workflowHandlers from './ipc/workflow-handlers'
import * as terminalHandlers from './ipc/terminal-handlers'
import * as appHandlers from './ipc/app-handlers'
import * as capexHandlers from './ipc/capex-handlers'
import * as genesisHandlers from './ipc/genesis-handlers'
import * as gitHandlers from './ipc/git-handlers'
import * as searchHandlers from './ipc/search-handlers'
import * as diagnosticsHandlers from './ipc/diagnostics-handlers'
import * as diagHandlers from './ipc/diag-handlers'
import * as logHandlers from './ipc/log-handlers'
import * as lspHandlers from './ipc/lsp-handlers'
import * as securityScoreHandlers from './ipc/security-handlers'
import * as localModelHandlers from './ipc/local-model-handlers'

import { GenesisRunner } from './genesis/genesis-runner'
import { ScaffoldRunner } from './genesis/scaffold'
import { localModelManager } from './local-model/LocalModelManager'

process.env.DIST = path.join(__dirname, '../dist')
process.env.VITE_PUBLIC = app.isPackaged ? process.env.DIST : path.join(__dirname, '../public')

const COPERNICUS_HOME = process.env.COPERNICUS_E2E_HOME ?? path.join(os.homedir(), '.copernicus')
const LOG_DIR = path.join(COPERNICUS_HOME, 'logs')
log.transports.file.resolvePathFn = () => path.join(LOG_DIR, 'copernicus.log')
Object.assign(console, log.functions)

function computeCoveragePct(coverageMap: Record<string, any>): number {
  const files = Object.values(coverageMap)
  if (!files.length) return 0
  const total   = files.reduce((acc: number, f: any) => acc + (f.s?.total   ?? 0), 0)
  const covered = files.reduce((acc: number, f: any) => acc + (f.s?.covered ?? 0), 0)
  return total > 0 ? Math.round((covered / total) * 100 * 10) / 10 : 0
}

let pw: typeof import('playwright-core') | null = null
async function getPlaywright() {
  if (!pw) pw = await import('playwright-core')
  return pw
}

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

const VITE_DEV_SERVER_URL = process.env.NODE_ENV === 'development' ? process.env['VITE_DEV_SERVER_URL'] : undefined
if (process.env.NODE_ENV === 'production' && process.env['VITE_DEV_SERVER_URL']) {
  throw new Error('Security violation: VITE_DEV_SERVER_URL exposed in production');
}
// Suppress expected CSP warnings in dev (unsafe-eval required by Vite HMR)
if (process.env.NODE_ENV === 'development') {
  process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true'
}

const authManager = new AuthManager()
const githubManager = new GithubManager(authManager)
const modelRegistry = new ModelRegistry()
const settingsStore = new SettingsStore()
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

function ensureCopernicusDirectory() {
  try {
    if (!fs.existsSync(COPERNICUS_HOME)) fs.mkdirSync(COPERNICUS_HOME, { recursive: true });
    if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
    const settingsPath = path.join(app.getPath('userData'), 'copernicus-settings.json');
    if (!fs.existsSync(settingsPath) || !settingsStore.get('workspace')) isFirstRun = true;
  } catch (error) { log.error('Failed to initialize .copernicus directory:', error); }
}

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
  storiesManager.setWindow(win); julesMonitor.setWindow(win); lspManager.setWindow(win); julesMonitor.resumeWatching();
  if (process.platform === 'darwin') {
    const tbConfig = { ...DEFAULT_TOUCH_BAR_CONFIG, ...(settingsStore.getAll()?.touchBar as any ?? {}) }
    touchBarCleanup = createTouchBar(win, tbConfig)
  }

  // Story 380: Sync fullscreen state to renderer for ESC handling
  win.on('enter-full-screen', () => win?.webContents.send('window:fullscreen-state', true))
  win.on('leave-full-screen', () => win?.webContents.send('window:fullscreen-state', false))

  win.webContents.on('did-finish-load', () => win?.webContents.send('main-process-message', (new Date).toLocaleString()))
  if (isFirstRun) {
    VITE_DEV_SERVER_URL ? win.loadURL(`${VITE_DEV_SERVER_URL}?window=wizard`) : win.loadFile(path.join(process.env.DIST!, 'index.html'), { query: { window: 'wizard' } })
  } else {
    VITE_DEV_SERVER_URL ? win.loadURL(VITE_DEV_SERVER_URL) : win.loadFile(path.join(process.env.DIST!, 'index.html'))
  }
}

import { handleIpc } from './utils/handle-ipc'
import { WORKFLOW_TEMPLATES } from './workflow/templates'

function registerIpcHandlers() {
  const scaffoldRunner = new ScaffoldRunner();
  const genesisRunner = new GenesisRunner({
    modelRegistry,
    authManager,
    storiesManager,
    settingsStore,
    scaffoldRunner
  });

  const snapshotManager = new SnapshotManager(stateLedger.db, fsManager.getRootPath());
  workflowEngine.setSnapshotManager(snapshotManager);

  const deps = {
    authManager, githubManager, modelRegistry, settingsStore, storiesManager, devtimeManager,
    fsManager, workflowEngine, snapshotManager, codebaseIndexer, hybridRetriever, browserSession, ptyManager,
    socketManager, stateLedger, llmService, lspManager, backendManager, julesMonitor, julesManager,
    genesisRunner,
    applyAndVerifyPatch, reversePatch, runRAGBenchmark, getPlaywright, computeCoveragePct,
    LOG_DIR, dispatchJulesSession, createTouchBar, DEFAULT_TOUCH_BAR_CONFIG, touchBarCleanup,
    isFirstRun, spawn
  }
  fileHandlers.register(win!, deps)
  authHandlers.register(win!, deps)
  modelHandlers.register(win!, deps)
  chatHandlers.register(win!, deps)
  storyHandlers.register(win!, deps)
  workflowHandlers.register(win!, deps)
  terminalHandlers.register(win!, deps)
  appHandlers.register(win!, deps)
  capexHandlers.registerCapexHandlers()
  genesisHandlers.register(win!, deps)
  gitHandlers.register(win!, deps)
  searchHandlers.register(win!, deps)
  diagnosticsHandlers.register(win!, deps)
  diagHandlers.register(win!, deps)
  logHandlers.register(win!)
  lspHandlers.register(win!, deps)
  securityScoreHandlers.register()
  localModelHandlers.register()
  registerSecurityHandlers(ipcMain, settingsStore)

  ipcMain.handle('templates:list', () => handleIpc('templates:list', [], () => {
    return WORKFLOW_TEMPLATES.map(t => {
      const override = deps.stateLedger.getTemplateOverride(t.id)
      return { 
        id: t.id, 
        name: t.name, 
        type: 'Workflow', 
        content: override?.content ?? JSON.stringify(t, null, 2), 
        isOverridden: !!override 
      }
    })
  }))

  ipcMain.handle('templates:save', (_e, id: string, content: string) => handleIpc(() => deps.stateLedger.saveTemplateOverride(id, content)))

  ipcMain.handle('templates:reset', (_e, id: string) => handleIpc(() => deps.stateLedger.deleteTemplateOverride(id)))

  ipcMain.handle('window:exit-fullscreen', () => handleIpc('window:exit-fullscreen', [], () => {
    const w = BrowserWindow.getAllWindows()[0]
    if (w?.isFullScreen()) {
      w.setFullScreen(false)
    }
  }))

  ipcMain.handle('layout:goto-line', (_e, { file, line, col }) => handleIpc('layout:goto-line', [{ file, line, col }], () => {
    BrowserWindow.getAllWindows()[0]?.webContents.send('layout:goto-line', { file, line, col })
  }))
}

app.on('window-all-closed', () => { ptyManager.killAll(); if (process.platform !== 'darwin') app.quit() })
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
app.on('will-quit', () => { globalShortcut.unregisterAll() })
app.on('before-quit', async () => { 
  localModelManager.stop();
  lspManager.stop(); 
  backendManager.stop(); 
  socketManager.disconnect(); 
  stateLedger.close(); 
  if (browserSession.browser) await browserSession.browser.close().catch(err => log.error(err)) 
})

app.whenReady().then(() => {
  registerIpcHandlers(); backendManager.start(); setTimeout(() => socketManager.connect(), 3000)
  if (process.platform === 'darwin') {
    app.setAboutPanelOptions({ applicationName: 'COPERNICUS', applicationVersion: '0.1.0', copyright: '© 2026 COPERNICUS IDE Team', credits: 'Professional Phosphor Edition' });
  }
  const isDev = !!VITE_DEV_SERVER_URL
  const scriptSrc = isDev
    ? "script-src 'self' 'unsafe-eval' 'unsafe-inline' blob: file: http://localhost:5173"
    : "script-src 'self' blob: file:"
  const connectSrc = isDev
    ? "connect-src 'self' http://localhost:5001 ws://localhost:5173 http://localhost:5173 https://api.anthropic.com https://openrouter.ai https://api.openai.com https://generativelanguage.googleapis.com https://api.github.com"
    : "connect-src 'self' https://api.anthropic.com https://openrouter.ai https://api.openai.com https://generativelanguage.googleapis.com https://api.github.com"
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({ responseHeaders: { ...details.responseHeaders, 'Content-Security-Policy': [`default-src 'self'; ${scriptSrc}; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: blob:; font-src 'self' data: https://fonts.gstatic.com; ${connectSrc}; worker-src 'self' blob: file:;`] } })
  })
  let workspaceRoot = (settingsStore.getAll().workspace as string) || (settingsStore.getAll().workingDir as string) || path.join(os.homedir(), 'Copernicus');
  if (!fs.existsSync(workspaceRoot)) try { fs.mkdirSync(workspaceRoot, { recursive: true }); } catch (e) { log.error(e); workspaceRoot = os.homedir(); }
  
  settingsStore.set('workspace', workspaceRoot);
  settingsStore.set('workingDir', workspaceRoot);
  fsManager.setRootPath(workspaceRoot); storiesManager.setProjectRoot(workspaceRoot);
  addRecentProject(workspaceRoot, settingsStore);
  ensureCopernicusDirectory(); createWindow();
  globalShortcut.register('CommandOrControl+P', () => win?.webContents.send('layout:open-palette', { mode: 'all' }))
  globalShortcut.register('CommandOrControl+Shift+P', () => win?.webContents.send('layout:open-palette', { mode: 'commands' }))
  codebaseIndexer.startIndexing(fsManager.getRootPath()).catch(log.error)
  lspManager.start(fsManager.getRootPath())
  if (app.isPackaged) autoUpdater.checkForUpdatesAndNotify();

  // Story 361: Auto-start local model if Ollama is not detected
  fetch('http://localhost:11434/api/tags', { signal: AbortSignal.timeout(2000) })
    .then(res => {
      if (!res.ok) localModelManager.start().catch(log.error);
    })
    .catch(() => {
      localModelManager.start().catch(log.error);
    });

  // Story 335: Watch for story status files from Python orchestrator
  setInterval(() => {
    try {
      const files = fs.readdirSync('/tmp').filter(f => f.startsWith('copernicus_story_') && f.endsWith('_status.txt'))
      for (const file of files) {
        const match = file.match(/copernicus_story_(\d+)_status\.txt/)
        if (match && match[1]) {
          const num = parseInt(match[1], 10)
          const filePath = path.join('/tmp', file)
          const status = fs.readFileSync(filePath, 'utf-8').trim()
          storiesManager.setStoryStatus(num, status).then(() => {
            win?.webContents.send('stories:status-changed', { storyNumber: num, status })
          }).catch(err => log.error('[Main] Failed to set story status from watcher:', err))
          fs.unlinkSync(filePath)
        }
      }
    } catch (e) { /* ignore */ }
  }, 2000)
})

app.on('browser-window-focus', () => {
  const synced = storiesManager.syncFromDisk()
  if (synced > 0) { win?.webContents.send('stories:updated', storiesManager.listStories()) }
})
