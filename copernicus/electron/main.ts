import { app, BrowserWindow, ipcMain, session, globalShortcut } from 'electron'

import path from 'node:path'
import { spawn } from 'node:child_process'
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
import { handleIpc } from './utils/handle-ipc'
import { socketManager } from './socket-manager'
import { applyAndVerifyPatch, reversePatch } from './utils/patch-manager'
import { runRAGBenchmark } from './utils/rag-benchmark'
import { addRecentProject } from './utils/recent-projects'
import { execAsync } from './utils/exec-async'
import { cwd } from 'node:process'
import { localModelManager } from './local-model/LocalModelManager'
import { WorktreeManager } from './worktree/WorktreeManager' // Added this back for worktreeManager type

import { registerAllIpcHandlers } from './ipc/register-all-handlers'
import { ensureCopernicusDirectory } from './utils/app-setup'

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

async function registerIpcHandlers() {
  const globalDeps = {
        authManager, githubManager, modelRegistry, settingsStore, storiesManager, devtimeManager,
        fsManager, workflowEngine, codebaseIndexer, hybridRetriever, browserSession, ptyManager,
        socketManager, stateLedger, llmService, lspManager, backendManager, julesMonitor, julesManager,
        applyAndVerifyPatch, reversePatch, runRAGBenchmark,
        getPlaywright: async () => await import('playwright-core'), // utility function not a manager
        dispatchJulesSession, createTouchBar, DEFAULT_TOUCH_BAR_CONFIG,
        isFirstRun, spawn
      }

  ipcMain.handle('health:check-all', (_e) => handleIpc(async () => {
    const checks = await Promise.allSettled([
      // Backend reachable
      fetch('http://localhost:5001/api/health').then(() => ({ name: 'Backend', ok: true })).catch(() => ({ name: 'Backend', ok: false })),
      // Git valid
      execAsync('git rev-parse --git-dir', { cwd: cwd() }).then(() => ({ name: 'Git', ok: true })).catch(() => ({ name: 'Git', ok: false })),
    ])
    return checks.map((r, i) => r.status === 'fulfilled' ? r.value : { name: ['Backend','Git'][i], ok: false })
  }))

  const { cleanupTestHandlers, cleanupReplayHandlers, cleanupDebugHandlers, cleanupWorktreeHandlers, worktreeManager: registeredWorktreeManager } =
    await registerAllIpcHandlers(win!, globalDeps, touchBarCleanup)

  worktreeManager = registeredWorktreeManager

  win!.webContents.on('did-navigate', () => {
    cleanupTestHandlers()
    cleanupReplayHandlers()
    cleanupDebugHandlers()
    cleanupWorktreeHandlers()
  })
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

app.whenReady().then(async () => {
  await registerIpcHandlers(); backendManager.start(); setTimeout(() => socketManager.connect(), 3000)
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
  ensureCopernicusDirectory(settingsStore, { current: isFirstRun }); createWindow();
  if (worktreeManager && win) {
    worktreeManager.startPolling(win);
  }
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
