import { app, BrowserWindow, ipcMain, session, globalShortcut } from 'electron'

import path from 'node:path'
import { spawn, ChildProcess } from 'node:child_process'
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
import { detectStack } from './skills/stack-detector'
import { providerSyncEngine } from './intelligence/provider-sync-engine'
import { auditSkillDescriptions } from './skills/description-auditor'

import { registerAllIpcHandlers } from './ipc/register-all-handlers'
import { ensureCopernicusDirectory, LOG_DIR } from './utils/app-setup'
import { jsonlExporter } from './memory/jsonl-exporter'

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
let ipcCleanupFns: {
  cleanupTestHandlers: () => void
  cleanupReplayHandlers: () => void
  cleanupDebugHandlers: () => void
  cleanupWorktreeHandlers: () => void
} | null = null

let collectorProcess: ChildProcess | null = null;

function updateClaudeTelemetrySettings(write: boolean): boolean {
  try {
    const rootPath = fsManager.getRootPath();
    if (!rootPath) return false;

    const settingsPath = path.join(rootPath, '.claude', 'settings.json');
    if (!write && !fs.existsSync(settingsPath)) return false;

    if (write) {
      if (!fs.existsSync(path.dirname(settingsPath))) {
        fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
      }
    }

    let content = '';
    if (fs.existsSync(settingsPath)) {
      content = fs.readFileSync(settingsPath, 'utf-8');
    }

    // Remove existing managed block using regex
    const startMarker = '// --- Copernicus Managed: OTel ---';
    const endMarker = '// --- End Copernicus Managed: OTel ---';
    const regex = new RegExp(startMarker + '[\\s\\S]*?' + endMarker + '\\n?', 'g');
    content = content.replace(regex, '').trim();

    if (write) {
      const managedBlock = [
        startMarker,
        'CLAUDE_CODE_ENABLE_TELEMETRY=1',
        'OTEL_METRICS_EXPORTER=otlp',
        'OTEL_LOGS_EXPORTER=otlp',
        'OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318',
        'OTEL_EXPORTER_OTLP_METRICS_TEMPORALITY_PREFERENCE=cumulative',
        'OTEL_LOG_TOOL_DETAILS=1',
        endMarker
      ].join('\n');

      content = content.length > 0 ? content + '\n\n' + managedBlock + '\n' : managedBlock + '\n';
    } else {
      content = content.length > 0 ? content + '\n' : content;
    }

    fs.writeFileSync(settingsPath, content, 'utf-8');
    return true;
  } catch (err) {
    log.error('[Main] Failed to update Claude telemetry settings:', err);
    return false;
  }
}

const VITE_DEV_SERVER_URL = process.env.NODE_ENV === 'development' ? process.env['VITE_DEV_SERVER_URL'] : undefined
if (process.env.NODE_ENV === 'production' && process.env['VITE_DEV_SERVER_URL']) {
  throw new Error('Security violation: VITE_DEV_SERVER_URL exposed in production');
}
// Suppress expected CSP warnings in dev (unsafe-eval required by Vite HMR)
if (process.env.NODE_ENV === 'development') {
  process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true'
}

const authManager = new AuthManager()
julesMonitor.setApiKey(authManager.getApiKey('jules') ?? '')

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
  })
  if (ipcCleanupFns) {
    win.webContents.on('did-start-loading', () => {
      ipcCleanupFns!.cleanupTestHandlers()
      ipcCleanupFns!.cleanupReplayHandlers()
      ipcCleanupFns!.cleanupDebugHandlers()
      ipcCleanupFns!.cleanupWorktreeHandlers()
    })
  }
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
        isFirstRun, spawn, LOG_DIR
      }

  ipcMain.handle('review:generate-summary', (_e, { diff, storyId, storyTitle }) => handleIpc(async () => {
    // Fast LLM summary via cloud_agent or simple fallback
    // Truncate diff to 4000 chars
    const truncated = (diff as string).slice(0, 4000)
    // For now: return structured response without LLM (LLM integration is optional)
    // Parse changed files from diff
    const fileLines = truncated.split('\n').filter((l: string) => l.startsWith('--- a/') || l.startsWith('+++ b/')).map((l: string) => l.replace(/^(\+\+\+ b\/|--- a\/)/, '').trim()).filter((f: string, i: number, arr: string[]) => arr.indexOf(f) === i && f !== '/dev/null')
    return {
      storyId,
      storyTitle,
      changedFiles: fileLines.slice(0, 10),
      summary: `Story ${storyId} implementation complete. ${fileLines.length} file(s) changed.`,
      timestamp: new Date().toISOString()
    }
  }))

  ipcMain.handle('telemetry:status', (_e) => handleIpc(async () => {
    const collectorRunning = collectorProcess !== null && !collectorProcess.killed;

    let settingsWritten = false;
    try {
      const rootPath = fsManager.getRootPath();
      if (rootPath) {
        const settingsPath = path.join(rootPath, '.claude', 'settings.json');
        if (fs.existsSync(settingsPath)) {
          const content = fs.readFileSync(settingsPath, 'utf-8');
          settingsWritten = content.includes('// --- Copernicus Managed: OTel ---');
        }
      }
    } catch (e) {
      // ignore
    }

    return { collectorRunning, settingsWritten };
  }))

  ipcMain.handle('health:check-all', (_e) => handleIpc(async () => {
    const checks = await Promise.allSettled([
      // Backend reachable
      fetch('http://localhost:5001/api/health').then(() => ({ name: 'Backend', ok: true })).catch(() => ({ name: 'Backend', ok: false })),
      // Git valid
      execAsync('git rev-parse --git-dir', { cwd: cwd() }).then(() => ({ name: 'Git', ok: true })).catch(() => ({ name: 'Git', ok: false })),
    ])
    return checks.map((r, i) => r.status === 'fulfilled' ? r.value : { name: ['Backend','Git'][i], ok: false })
  }))

  ipcMain.handle('db:get-edit-decisions', (_e, { promptId }: { promptId: string }) => handleIpc(() => {
    return stateLedger.getEditDecisionsCounts(promptId)
  }))

  ipcMain.handle('skills:detect-stack', () => handleIpc(() => {
    const rootPath = fsManager.getRootPath()
    return detectStack(rootPath || '')
  }))

  ipcMain.handle('skills:audit', () => handleIpc(async () => {
    const rootPath = fsManager.getRootPath()
    return auditSkillDescriptions(rootPath || '')
  }))

  ipcMain.handle('skills:scaffold', (_e, { categories, stackProfile }) => handleIpc(async () => {
    const rootPath = fsManager.getRootPath()
    if (!rootPath) throw new Error('No project root path set');

    const generated: string[] = []
    const skipped: string[] = []
    const projectName = path.basename(rootPath)
    const stackStr = stackProfile.frameworks.join(', ')

    const targetSkillsDir = path.join(rootPath, '.claude', 'skills')
    if (!fs.existsSync(targetSkillsDir)) {
      fs.mkdirSync(targetSkillsDir, { recursive: true })
    }

    const templatesDir = path.join(__dirname, 'skills', 'templates')

    for (const category of categories) {
      const sourceDir = path.join(templatesDir, category)
      const targetDir = path.join(targetSkillsDir, category)

      if (!fs.existsSync(sourceDir)) {
        log.warn(`[skills:scaffold] Template directory not found for category: ${category}`)
        skipped.push(category)
        continue
      }

      if (fs.existsSync(targetDir)) {
        skipped.push(category)
        continue
      }

      try {
        fs.mkdirSync(targetDir, { recursive: true })

        const copyRecursiveSync = (src: string, dest: string) => {
          const exists = fs.existsSync(src)
          const stats = exists && fs.statSync(src)
          const isDirectory = exists && stats && stats.isDirectory()

          if (isDirectory) {
            if (!fs.existsSync(dest)) fs.mkdirSync(dest)
            fs.readdirSync(src).forEach((childItemName) => {
              copyRecursiveSync(path.join(src, childItemName), path.join(dest, childItemName))
            })
          } else {
            let content = fs.readFileSync(src, 'utf-8')
            content = content.replace(/\{\{PROJECT_NAME\}\}/g, projectName)
                             .replace(/\{\{STACK\}\}/g, stackStr)
                             .replace(/\{\{REPO_ROOT\}\}/g, rootPath)
            
            if (path.basename(dest) === 'SKILL.md' && path.dirname(dest) === targetDir) {
              const doc = stateLedger.createIntelDoc({
                projectId: rootPath,
                type: 'skill',
                title: category,
                description: `Skill scaffold for ${category}`,
                content: content,
                providers: [{ provider: 'claude', enabled: true }]
              })
              providerSyncEngine.sync(doc, rootPath).catch(err => {
                log.error('Provider sync failed on skill scaffold:', err)
              })
            } else {
              fs.writeFileSync(dest, content, 'utf-8')
            }
          }
        }

        copyRecursiveSync(sourceDir, targetDir)
        generated.push(category)
      } catch (err) {
        log.error(`[skills:scaffold] Error writing skill ${category}:`, err)
        skipped.push(category)
      }
    }

    const newStackProfile = detectStack(rootPath)
    
    const activeWin = BrowserWindow.getAllWindows()[0]
    if (activeWin) {
      activeWin.webContents.send('skills:scaffolded', {
        stackProfile: newStackProfile,
        result: { generated, skipped }
      })
    }

    return { generated, skipped }
  }))

  const { cleanupTestHandlers, cleanupReplayHandlers, cleanupDebugHandlers, cleanupWorktreeHandlers, worktreeManager: registeredWorktreeManager } =
    await registerAllIpcHandlers(win!, globalDeps, touchBarCleanup)

  worktreeManager = registeredWorktreeManager
  ipcCleanupFns = { cleanupTestHandlers, cleanupReplayHandlers, cleanupDebugHandlers, cleanupWorktreeHandlers }
}

app.on('window-all-closed', () => { ptyManager.killAll(); if (process.platform !== 'darwin') app.quit() })
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
app.on('will-quit', () => { globalShortcut.unregisterAll() })
app.on('before-quit', async () => { 
  if (collectorProcess && !collectorProcess.killed) {
    log.info('[Main] Killing OTel collector process');
    collectorProcess.kill();
  }
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

  if (fs.existsSync(collectorScript)) {
    log.info('[Main] Spawning OTel collector sidecar...');
    // We wrap it in a try-catch so that if the process fails to start, we degrade gracefully
    try {
      collectorProcess = spawn('python3', [collectorScript], {
        env: { ...process.env, COPERNICUS_DB_PATH: dbPath },
        stdio: 'ignore'
      });

      log.info(`[Main] OTel collector spawned with PID: ${collectorProcess.pid}`);
      updateClaudeTelemetrySettings(true);

      collectorProcess.on('error', (err) => {
        log.warn(`[Main] Failed to start OTel collector: ${err.message}`);
        updateClaudeTelemetrySettings(false);
      });

      collectorProcess.on('exit', (code) => {
        if (code !== 0 && code !== null) {
          log.warn(`[Main] OTel collector exited with non-zero code: ${code}`);
        } else {
          log.info(`[Main] OTel collector exited gracefully`);
        }
        collectorProcess = null;
        updateClaudeTelemetrySettings(false);
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      log.warn(`[Main] Failed to spawn OTel collector: ${msg}`);
      updateClaudeTelemetrySettings(false);
    }
  } else {
    log.warn('[Main] OTel collector script not found at:', collectorScript);
  }

  try {
    await registerIpcHandlers()
  } catch (err: unknown) {
    const msg = err instanceof Error ? (err.stack ?? err.message) : String(err)
    log.error('[Main] CRITICAL: registerIpcHandlers() failed — window will open without handlers:', msg)
  }
  backendManager.start(); setTimeout(() => socketManager.connect(), 3000)
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
  if (worktreeManager && win) {
    worktreeManager.startPolling(win);
  }
  globalShortcut.register('CommandOrControl+P', () => win?.webContents.send('layout:open-palette', { mode: 'all' }))
  globalShortcut.register('CommandOrControl+Shift+P', () => win?.webContents.send('layout:open-palette', { mode: 'commands' }))
  codebaseIndexer.startIndexing(fsManager.getRootPath()).catch(log.error)
  lspManager.start(fsManager.getRootPath())
  if (app.isPackaged) autoUpdater.checkForUpdatesAndNotify().catch(err => log.warn('[AutoUpdater] update check failed:', err));

  // Story 361: Auto-start local model if Ollama is not detected
  fetch('http://localhost:11434/api/tags', { signal: AbortSignal.timeout(2000) })
    .then(res => {
      if (!res.ok) localModelManager.start().catch(log.error);
    })
    .catch(() => {
      localModelManager.start().catch(log.error);
    });

  // Story 496: JSONL Export Cycle and LSP Index for Agent Memory
  setTimeout(async () => {
    try {
      const projectId = fsManager.getRootPath() || 'default'
      await jsonlExporter.export(projectId)
      const exportDir = path.join(app.getPath('userData'), 'memory', jsonlExporter.hashProjectId(projectId))
      lspManager.watchMemoryDir(exportDir)
      
      setInterval(async () => {
        try {
          const pid = fsManager.getRootPath() || 'default'
          await jsonlExporter.export(pid)
        } catch (err) {
          log.error('[Memory Export] Interval export failed:', err)
        }
      }, 5 * 60 * 1000)
    } catch (err) {
      log.error('[Memory Export] Initial export failed:', err)
    }
  }, 30 * 1000)

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
