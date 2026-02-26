import { app, BrowserWindow, ipcMain, shell, session, globalShortcut, dialog } from 'electron'
import path from 'node:path'
import { spawn, execFile } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import log from 'electron-log'
import { autoUpdater } from 'electron-updater'
import { AuthManager } from './auth-manager'
import { ModelRegistry } from './models/model-registry'
import { registerSecurityHandlers, initializeSecurityManager, GitGuardDecision, GitPushRequest } from './security'
import { SettingsStore } from './settings-store'
import { createTouchBar } from './touch-bar'
import { StoriesManager } from './stories'
import { parseMakefile } from './utils/makefile-parser'
import { ptyManager } from './pty-manager'
import { stateLedger } from './db/state-ledger'
import { setupCommandHandlers } from './commands/dispatcher'
import { DevtimeManager } from './devtime-manager'
import { GithubManager } from './github-manager'
import { llmService } from './llm/service'
import { fsManager } from './fs-manager'
import { workflowEngine } from './workflow/engine'
import { codebaseIndexer } from './codebase-indexer'
import './interop/dispatcher' // Initialize Interop Dispatcher

// The built directory structure
//
// ├─┬─┬ dist
// │ │ └── index.html
// │ │
// │ ├─┬ dist-electron
// │ │ ├── main.js
// │ │ └── preload.js
// │
process.env.DIST = path.join(__dirname, '../dist')
process.env.VITE_PUBLIC = app.isPackaged ? process.env.DIST : path.join(__dirname, '../public')

// Initialize Logging
const COPERNICUS_HOME = path.join(os.homedir(), '.copernicus')
const LOG_DIR = path.join(COPERNICUS_HOME, 'logs')
log.transports.file.resolvePathFn = () => path.join(LOG_DIR, 'copernicus.log')
Object.assign(console, log.functions)

// ── Global process safety nets ────────────────────────────────────────────
process.on('uncaughtException', (error: Error) => {
  console.error('[Main] uncaughtException:', error.stack ?? error.message)
  const wins = BrowserWindow.getAllWindows()
  wins.forEach(w => {
    if (!w.isDestroyed()) {
      w.webContents.send('app:critical-error', {
        type: 'uncaughtException',
        message: error.message,
        stack: error.stack,
      })
    }
  })
})

process.on('unhandledRejection', (reason: unknown) => {
  const message = reason instanceof Error ? reason.message : String(reason)
  const stack   = reason instanceof Error ? reason.stack  : undefined
  console.error('[Main] unhandledRejection:', stack ?? message)
  const wins = BrowserWindow.getAllWindows()
  wins.forEach(w => {
    if (!w.isDestroyed()) {
      w.webContents.send('app:critical-error', {
        type: 'unhandledRejection',
        message,
        stack,
      })
    }
  })
})

// Determine project root (docs/ folder is in parent of copernicus/)
const ROOT_PATH = path.resolve(__dirname, '../../')

// Initialize FS Manager with project root
fsManager.setRootPath(ROOT_PATH)

let win: BrowserWindow | null
let splashWin: BrowserWindow | null
let isFirstRun = false;

// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']

const authManager = new AuthManager()
new GithubManager(authManager)
const modelRegistry = new ModelRegistry()
const settingsStore = new SettingsStore()
const storiesManager = new StoriesManager(ROOT_PATH)
new DevtimeManager()

// Initialize Security Manager
initializeSecurityManager({
  requestConfirmation: async (request: GitPushRequest): Promise<GitGuardDecision> => {
    if (!win) return 'BLOCK';
    win.webContents.send('security:git-push-request', request);
    return new Promise((resolve) => {
      ipcMain.once(`security:git-push-response:${request.command}`, (_event, decision: GitGuardDecision) => {
        resolve(decision);
      });
      setTimeout(() => resolve('BLOCK'), 60000);
    });
  }
});

function ensureCopernicusDirectory() {
  try {
    if (!fs.existsSync(COPERNICUS_HOME)) fs.mkdirSync(COPERNICUS_HOME, { recursive: true });
    if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
    const preferencesPath = path.join(COPERNICUS_HOME, 'preferences.json');
    if (!fs.existsSync(preferencesPath)) isFirstRun = true;
  } catch (error) {
    console.error('Failed to initialize .copernicus directory:', error);
  }
}

// ── Settings Persistence ───────────────────────────────────────────────────
const SETTINGS_PATH = path.join(app.getPath('userData'), 'copernicus-settings.json')

function loadSettings(): Record<string, unknown> {
  try {
    return JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf-8'))
  } catch {
    return {}
  }
}

function saveSettings(patch: Record<string, unknown>): void {
  const current = loadSettings()
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify({ ...current, ...patch }, null, 2))
}

function createSplashWindow() {
  const settings = loadSettings()
  const phosphorHex = (settings.phosphorColor as string | undefined) ?? '#4ADE80'

  splashWin = new BrowserWindow({
    width: 600,
    height: 400,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    webPreferences: {
      preload: path.join(__dirname, 'splash-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })
  
  if (VITE_DEV_SERVER_URL) {
    splashWin.loadURL(`${VITE_DEV_SERVER_URL}?window=splash&phosphor=${encodeURIComponent(phosphorHex)}`)
  } else {
    splashWin.loadFile(path.join(process.env.DIST!, 'index.html'), { query: { window: 'splash', phosphor: phosphorHex } })
  }

  splashWin.on('closed', () => { splashWin = null })
}

function createWindow(show = true) {
  if (isFirstRun) {
    win = new BrowserWindow({
      width: 900,
      height: 640,
      show,
      frame: false,
      resizable: false,
      center: true,
      backgroundColor: '#050505',
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    })
  } else {
    win = new BrowserWindow({
      width: 1200,
      height: 800,
      show,
      frame: false,
      backgroundColor: '#050505',
      titleBarStyle: 'hiddenInset',
      trafficLightPosition: { x: 10, y: 10 },
      vibrancy: process.platform === 'darwin' ? 'under-window' : undefined,
      visualEffectState: process.platform === 'darwin' ? 'active' : undefined,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    })
  }

  storiesManager.setWindow(win)
  createTouchBar(win);

  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', (new Date).toLocaleString())
  })

  if (isFirstRun) {
     if (VITE_DEV_SERVER_URL) {
        win.loadURL(`${VITE_DEV_SERVER_URL}?window=wizard`)
     } else {
        win.loadFile(path.join(process.env.DIST!, 'index.html'), { query: { window: 'wizard' } })
     }
  } else {
    if (VITE_DEV_SERVER_URL) {
        win.loadURL(VITE_DEV_SERVER_URL)
    } else {
        win.loadFile(path.join(process.env.DIST!, 'index.html'))
    }
  }
}

function setupAutoUpdater() {
  autoUpdater.logger = log;
  autoUpdater.checkForUpdatesAndNotify();
}

function registerIpcHandlers() {
  ipcMain.handle('settings:save', (_event, patch: unknown) => {
    if (typeof patch === 'object' && patch !== null) saveSettings(patch as Record<string, unknown>)
    return { ok: true }
  })
  
  ipcMain.handle('settings:load', () => loadSettings())

  ipcMain.handle('app:open-log', () => {
    const logFilePath = path.join(LOG_DIR, 'copernicus.log')
    return shell.openPath(logFilePath)
  })

  ipcMain.handle('app:open-external', (_event, url: string) => {
    return shell.openExternal(url);
  })

  // Wizard Handlers
  ipcMain.handle('check-cli-tools', async () => {
    const tools = ['claude', 'gemini', 'git', 'node'];
    const results: Record<string, boolean> = {};
    const cmd = process.platform === 'win32' ? 'where' : 'which';
    
    await Promise.all(tools.map(tool => new Promise<void>(resolve => {
       execFile(cmd, [tool], (error) => {
         results[tool] = !error;
         resolve();
       });
    })));
    return results;
  });

  ipcMain.handle('select-folder', async () => {
    if (!win) return null;
    const { canceled, filePaths } = await dialog.showOpenDialog(win, {
      properties: ['openDirectory']
    });
    return canceled ? null : filePaths[0];
  });

  ipcMain.handle('save-preferences', async (_event, preferences: any) => {
    const { keys, ...settings } = preferences;
    
    if (keys) {
        if (keys.anthropic && keys.anthropic !== 'saved') await authManager.storeApiKey('anthropic', keys.anthropic);
        if (keys.google && keys.google !== 'saved') await authManager.storeApiKey('google', keys.google);
    }
    
    saveSettings(settings);
    return { ok: true };
  });

  ipcMain.handle('restart-app', () => {
    app.relaunch();
    app.exit(0);
  });

  // Auth Handlers
  ipcMain.handle('auth:status', () => authManager.getAuthStatus());
  ipcMain.handle('auth:store-api-key', async (_, provider: string, apiKey: string, baseUrl?: string) => {
    return await authManager.storeApiKey(provider, apiKey, baseUrl);
  });
  ipcMain.handle('auth:get-api-key', (_, provider: string) => {
    if (provider === 'openai' || provider === 'openrouter' || provider === 'deepinfra') {
       const resolved = authManager.resolveOpenAICompatibleKey();
       return resolved ? resolved.key : null;
    }
    return authManager.getApiKey(provider);
  });
  ipcMain.handle('auth:resolve-openai-config', () => authManager.resolveOpenAICompatibleKey());

  // Model Handlers
  ipcMain.handle('models:list', () => modelRegistry.getModels());
  ipcMain.handle('models:active', () => modelRegistry.getActiveModel());
  ipcMain.handle('models:set-active', (_, modelId: string) => modelRegistry.setActiveModel(modelId));

  // Security Handlers
  registerSecurityHandlers(ipcMain, settingsStore);

  // Git Handlers
  ipcMain.handle('git:branch', async () => {
    return new Promise((resolve) => {
      execFile('git', ['rev-parse', '--abbrev-ref', 'HEAD'], (error: any, stdout: string) => {
        if (error) resolve('unknown');
        else resolve(stdout.trim());
      });
    });
  });

  // Story Handlers
  ipcMain.handle('stories:list', () => storiesManager.listStories())
  ipcMain.handle('stories:update', (_event, id, status) => {
    if (!/^story_\d+$/.test(id)) return;
    storiesManager.updateStoryStatus(id, status)
  })
  ipcMain.handle('stories:hydrate', (_event, id) => {
    if (!/^story_\d+$/.test(id)) return;
    win?.webContents.send('editor:open', id) 
  })

  // Makefile Handlers
  ipcMain.handle('makefile:list', () => parseMakefile(ROOT_PATH))
  ipcMain.handle('makefile:run', (_event, target) => {
    const ALLOWED = ['dev', 'test', 'build', 'lint', 'backlog', 'deploy'];
    if (!ALLOWED.includes(target)) return;
    const child = spawn('make', [target], { cwd: ROOT_PATH })
    child.stdout.on('data', (data) => win?.webContents.send('terminal:data', data.toString()))
    child.stderr.on('data', (data) => win?.webContents.send('terminal:data', data.toString()))
    child.on('close', (code) => win?.webContents.send('terminal:data', `\n[Process exited with code ${code}]`))
  })

  // System Execution
  ipcMain.on('system:make', (_, target: string) => {
    const ALLOWED = ['dev', 'test', 'build', 'lint', 'backlog', 'deploy'];
    if (ALLOWED.includes(target)) spawn('make', [target], { cwd: ROOT_PATH })
  });

  // Terminal IPC
  ipcMain.on('terminal-create', (_event, { id, cols, rows, cwd }) => {
    const resolvedCwd = path.resolve(cwd || os.homedir());
    const isSafe = resolvedCwd.startsWith(ROOT_PATH) || resolvedCwd.startsWith(os.homedir());
    if (win && isSafe) ptyManager.create(id, cols, rows, resolvedCwd, win);
  });
  ipcMain.on('terminal-resize', (_event, { id, cols, rows }) => ptyManager.resize(id, cols, rows));
  ipcMain.on('terminal-write', (_event, payload: any) => {
    if (payload?.id && payload?.data) ptyManager.write(payload.id, payload.data);
  });
  ipcMain.on('terminal-kill', (_event, { id }) => ptyManager.kill(id));
  ipcMain.on('terminal:spawn-agent', (_event, { agentId }: any) => {
    if (!/^[a-z0-9_-]+$/.test(agentId)) return;
    BrowserWindow.getAllWindows().forEach(w => w.webContents.send('terminal:activate-tab', { agentId }));
  })

  // Database IPC
  ipcMain.handle('db:log-intent', (_, content, status, agentId) => stateLedger.logIntent(content, status, agentId));
  ipcMain.handle('db:get-intents', (_, limit) => stateLedger.getRecentIntents(limit));
  ipcMain.handle('db:log-event', (_, type, content, metadata, agentId) => stateLedger.logEvent(type, content, metadata, agentId));
  ipcMain.handle('db:get-events', (_, limit) => stateLedger.getRecentEvents(limit));
  ipcMain.handle('db:add-memory', (_, content, tags, agentId) => stateLedger.addMemory(content, tags, agentId));
  ipcMain.handle('db:search-memory', (_, query) => stateLedger.searchMemory(query));

  // LLM Chat
  ipcMain.handle('chat:send', async (_event, payload: any) => {
    llmService.streamChat(payload).catch(err => console.error('[LLM] streamChat error:', err))
    return { ok: true }
  })

  // Review
  ipcMain.handle('review:log', (_event, { verdicts }: any) => {
    stateLedger.logIntent(`REVIEW: [Claude: ${verdicts.claude}] [Gemini: ${verdicts.gemini}]`, 'COMPLETED', 'sentinel')
    return { ok: true }
  })

  // Slash Commands
  setupCommandHandlers();

  // Codebase Indexing
  ipcMain.handle('codebase:index-status', () => codebaseIndexer.getStatus())
  ipcMain.handle('codebase:search', async (_event, query: string) => codebaseIndexer.search(query))

  // File System
  ipcMain.handle('fs:list-dir', (_event, dirPath: string) => fsManager.listDir(dirPath))
  ipcMain.handle('fs:open-file', (_event, filePath: string) => fsManager.readFile(filePath))
  ipcMain.handle('fs:save-file', (_event, { filePath, content }: any) => {
    const res = fsManager.writeFile(filePath, content)
    if (res.ok) codebaseIndexer.indexFile(filePath).catch(console.error)
    return res
  })
  ipcMain.handle('app:get-root-path', () => fsManager.getRootPath())

  // Workflow
  ipcMain.handle('workflow:run', (_event, graph) => {
    workflowEngine.runGraph(graph).catch(err => console.error('[Workflow] Execution error:', err))
    return { ok: true, status: 'started' }
  })
  ipcMain.handle('workflow:status', () => ({
    state: workflowEngine.getState(),
    nodeStatuses: workflowEngine.getNodeStatuses()
  }))

  ipcMain.on('splash-ready', () => { if (win) { win.show(); splashWin?.close(); } });
  ipcMain.handle('app:quit', () => app.quit());
}

app.on('window-all-closed', () => {
  ptyManager.killAll();
  stateLedger.close();
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(true) })
app.on('will-quit', () => { globalShortcut.unregisterAll() })

app.whenReady().then(() => {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': ["default-src 'self'; script-src 'self' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' https://api.anthropic.com https://openrouter.ai https://api.openai.com https://generativelanguage.googleapis.com; worker-src blob:;"]
      }
    })
  })

  ensureCopernicusDirectory();
  registerIpcHandlers();
  createSplashWindow();
  createWindow(false);
  
  globalShortcut.register('CommandOrControl+P', () => win?.webContents.send('layout:open-palette', { mode: 'all' }))
  globalShortcut.register('CommandOrControl+Shift+P', () => win?.webContents.send('layout:open-palette', { mode: 'commands' }))

  codebaseIndexer.startIndexing(ROOT_PATH).catch(console.error)
  if (app.isPackaged) setupAutoUpdater();
})
