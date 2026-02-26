import { app, BrowserWindow, ipcMain, dialog } from 'electron'
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
import { StateLedger } from './db/state-ledger'
import { setupCommandHandlers } from './commands/dispatcher'
import { DevtimeManager } from './devtime-manager'
import { GithubManager } from './github-manager'
import { llmService } from './llm/service'
import { fsManager } from './fs-manager'
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
new GithubManager(authManager) // constructor registers IPC handlers; instance not retained
const modelRegistry = new ModelRegistry()
const settingsStore = new SettingsStore()
const storiesManager = new StoriesManager(ROOT_PATH)
const stateLedger = new StateLedger()
new DevtimeManager()

// Initialize Security Manager with IPC bridge for UI confirmation
initializeSecurityManager({
  requestConfirmation: async (request: GitPushRequest): Promise<GitGuardDecision> => {
    if (!win) return 'BLOCK';
    
    // Send request to renderer to show modal
    win.webContents.send('security:git-push-request', request);
    
    // Wait for response via one-time IPC handler
    return new Promise((resolve) => {
      ipcMain.once(`security:git-push-response:${request.command}`, (_event, decision: GitGuardDecision) => {
        resolve(decision);
      });
      
      // Safety timeout
      setTimeout(() => resolve('BLOCK'), 60000);
    });
  }
});

function ensureCopernicusDirectory() {
  try {
    if (!fs.existsSync(COPERNICUS_HOME)) {
      fs.mkdirSync(COPERNICUS_HOME, { recursive: true });
    }
    if (!fs.existsSync(LOG_DIR)) {
      fs.mkdirSync(LOG_DIR, { recursive: true });
    }
    const preferencesPath = path.join(COPERNICUS_HOME, 'preferences.json');
    if (!fs.existsSync(preferencesPath)) {
      isFirstRun = true;
    }
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
  
  const distPath = process.env.DIST || path.join(__dirname, '../dist');
  
  if (VITE_DEV_SERVER_URL) {
    splashWin.loadURL(`${VITE_DEV_SERVER_URL}?window=splash&phosphor=${encodeURIComponent(phosphorHex)}`)
  } else {
    splashWin.loadFile(path.join(distPath, 'index.html'), { query: { window: 'splash', phosphor: phosphorHex } })
  }

  splashWin.on('closed', () => {
    splashWin = null
  })
}

function createWindow(show = true) {
  win = new BrowserWindow({
    width: 1200,
    height: 800,
    show,
    backgroundColor: '#050505', // --copernicus-bg
    titleBarStyle: 'hiddenInset', // Translucent headers
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

  // Connect stories manager
  storiesManager.setWindow(win)

  // Initialize Touch Bar Hardware
  createTouchBar(win);

  // Test active push message to Renderer-process.
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', (new Date).toLocaleString())
  })

  if (isFirstRun) {
     if (VITE_DEV_SERVER_URL) {
        win.loadURL(`${VITE_DEV_SERVER_URL}?window=wizard`)
     } else {
        const distPath = process.env.DIST || path.join(__dirname, '../dist');
        win.loadFile(path.join(distPath, 'index.html'), { query: { window: 'wizard' } })
     }
  } else {
    if (VITE_DEV_SERVER_URL) {
        win.loadURL(VITE_DEV_SERVER_URL)
    } else {
        const distPath = process.env.DIST || path.join(__dirname, '../dist');
        win.loadFile(path.join(distPath, 'index.html'))
    }
  }
}

// Auto-updater
function setupAutoUpdater() {
  autoUpdater.logger = log;
  autoUpdater.checkForUpdatesAndNotify();
  
  autoUpdater.on('update-available', () => {
      dialog.showMessageBox({
          type: 'info',
          title: 'Update Available',
          message: 'A new version of COPERNICUS is available. Downloading now...',
          buttons: ['OK']
      })
  })
  
  autoUpdater.on('update-downloaded', () => {
      dialog.showMessageBox({
          type: 'info',
          title: 'Update Ready',
          message: 'Update downloaded. Restart now to install?',
          buttons: ['Restart', 'Later']
      }).then((result) => {
          if (result.response === 0) {
              autoUpdater.quitAndInstall()
          }
      })
  })
}

function registerIpcHandlers() {
  ipcMain.handle('settings:save', (_event, patch: unknown) => {
    if (typeof patch === 'object' && patch !== null) {
      saveSettings(patch as Record<string, unknown>)
    }
    return { ok: true }
  })
  
  ipcMain.handle('settings:load', () => loadSettings())

  // Auth Handlers
  ipcMain.handle('auth:status', () => {
    return authManager.getAuthStatus();
  });

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
  
  ipcMain.handle('auth:resolve-openai-config', () => {
      return authManager.resolveOpenAICompatibleKey();
  });

  // Model Handlers
  ipcMain.handle('models:list', () => {
    return modelRegistry.getModels();
  });

  ipcMain.handle('models:active', () => {
    return modelRegistry.getActiveModel();
  });

  ipcMain.handle('models:set-active', (_, modelId: string) => {
    return modelRegistry.setActiveModel(modelId);
  });

  // Security Handlers
  registerSecurityHandlers(ipcMain, settingsStore);

  // Git Handlers
  ipcMain.handle('git:branch', async () => {
    return new Promise((resolve) => {
      // Resolves C-5: Use execFile for safe command execution
      execFile('git', ['rev-parse', '--abbrev-ref', 'HEAD'], (error: any, stdout: string) => {
        if (error) {
          resolve('unknown');
        } else {
          resolve(stdout.trim());
        }
      });
    });
  });

  // Story Handlers
  ipcMain.handle('stories:list', () => {
    return storiesManager.listStories()
  })

  ipcMain.handle('stories:update', (_event, id, status) => {
    if (!/^story_\d+$/.test(id)) {
        console.error(`[SECURITY] Blocked malicious story ID: ${id}`);
        return;
    }
    storiesManager.updateStoryStatus(id, status)
  })

  ipcMain.handle('stories:hydrate', (_event, id) => {
    if (!/^story_\d+$/.test(id)) {
        console.error(`[SECURITY] Blocked malicious story ID: ${id}`);
        return;
    }
    console.log(`[SYSTEM] Hydrating story: ${id}`)
    win?.webContents.send('editor:open', id) 
  })

  // Makefile Handlers
  ipcMain.handle('makefile:list', () => {
    return parseMakefile(ROOT_PATH)
  })

  ipcMain.handle('makefile:run', (_event, target) => {
    const ALLOWED_TARGETS = ['dev', 'test', 'build', 'lint', 'backlog', 'deploy'];
    if (!ALLOWED_TARGETS.includes(target)) {
        console.error(`[SECURITY] Blocked unauthorized make target: ${target}`);
        return;
    }

    console.log(`[SYSTEM] Running make target: ${target}`)
    // Resolves C-5: Remove shell: true, use explicit arg list
    const child = spawn('make', [target], { cwd: ROOT_PATH })
    
    child.stdout.on('data', (data) => {
        win?.webContents.send('terminal:data', data.toString())
    })
    
    child.stderr.on('data', (data) => {
        win?.webContents.send('terminal:data', data.toString())
    })
    
    child.on('close', (code) => {
        win?.webContents.send('terminal:data', `\n[Process exited with code ${code}]`)
    })
  })

  // System Execution Hardware Bridge
  ipcMain.on('system:make', (_, target: string) => {
    const ALLOWED_TARGETS = ['dev', 'test', 'build', 'lint', 'backlog', 'deploy'];
    if (!ALLOWED_TARGETS.includes(target)) return;

    // Resolves C-5: Remove shell: true, use explicit arg list
    const child = spawn('make', [target], { cwd: ROOT_PATH })
    child.on('close', (code) => {
      console.log(`[SYSTEM] make ${target} exited with code ${code}`)
    })
  });

  // Touch Bar Telemetry Sync
  ipcMain.on('layout:update-telemetry', (_event, { storyId, timer }) => {
    ipcMain.emit('telemetry:update-touchbar', null, { storyId, timer });
  });

  // --- Terminal IPC ---
  ipcMain.on('terminal-create', (_event, { id, cols, rows, cwd }) => {
    if (win) {
      // Resolves AC 3: Validate CWD
      const resolvedCwd = path.resolve(cwd || os.homedir());
      const isSafe = resolvedCwd.startsWith(ROOT_PATH) || resolvedCwd.startsWith(os.homedir());
      
      if (!isSafe) {
          console.error(`[SECURITY] Blocked terminal creation in unauthorized path: ${resolvedCwd}`);
          return;
      }

      ptyManager.create(id, cols, rows, resolvedCwd, win);
    }
  });

  ipcMain.on('terminal-resize', (_event, { id, cols, rows }) => {
    ptyManager.resize(id, cols, rows);
  });

  ipcMain.on('terminal-write', (_event, payload: unknown) => {
    if (
      typeof payload !== 'object' || payload === null ||
      typeof (payload as any).id !== 'string' ||
      typeof (payload as any).data !== 'string'
    ) {
      console.warn('[SECURITY] terminal-write blocked — invalid payload type');
      return;
    }

    const { id, data } = payload as { id: string; data: string };

    // Clamp data length to prevent memory exhaustion
    if (data.length > 65_536) {
      console.warn(`[SECURITY] terminal-write blocked — data exceeds 64KB (${data.length} bytes)`);
      return;
    }

    ptyManager.write(id, data).catch((err) => {
      console.error(`[PTY] write() error for terminal ${id}:`, err);
    });
  });

  ipcMain.on('terminal-kill', (_event, { id }) => {
    ptyManager.kill(id);
  });

  ipcMain.on('terminal:spawn-agent', (_event, payload: unknown) => {
    if (
      typeof payload !== 'object' || payload === null ||
      typeof (payload as any).agentId !== 'string'
    ) {
      console.warn('[security] terminal:spawn-agent blocked — invalid payload')
      return
    }

    const { agentId } = payload as { agentId: string }

    // Validate agentId
    if (!/^[a-z0-9_-]+$/.test(agentId)) {
      console.warn(`[security] terminal:spawn-agent blocked — invalid agentId: ${agentId}`)
      return
    }

    // Look up the agent command from model registry or a static map
    const AGENT_COMMANDS: Record<string, string[]> = {
      sentinel: ['python', ['scripts/agent_cli.py', '--persona', 'sentinel']],
      claude:   ['node',   ['scripts/claude_ollama_cli.py']],
      gemini:   ['python', ['scripts/agent_cli.py', '--persona', 'gemini']],
      jules:    ['python', ['scripts/agent_cli.py', '--persona', 'jules']],
    } as any

    const agentCmd = AGENT_COMMANDS[agentId]
    if (!agentCmd) {
      console.warn(`[terminal:spawn-agent] Unknown agentId: ${agentId}`)
      return
    }

    // Broadcast to renderer: open the terminal tab for this agent
    BrowserWindow.getAllWindows().forEach(win => {
      if (!win.isDestroyed()) {
        win.webContents.send('terminal:activate-tab', { agentId })
      }
    })
  })

  // --- Database IPC (State Ledger) ---
  ipcMain.handle('db:log-intent', (_, content, status, agentId) => {
    return stateLedger.logIntent(content, status, agentId);
  });

  ipcMain.handle('db:get-intents', (_, limit) => {
    return stateLedger.getRecentIntents(limit);
  });

  ipcMain.handle('db:log-event', (_, type, content, metadata, agentId) => {
    return stateLedger.logEvent(type, content, metadata, agentId);
  });

  ipcMain.handle('db:get-events', (_, limit) => {
    return stateLedger.getRecentEvents(limit);
  });

  ipcMain.handle('db:add-memory', (_, content, tags, agentId) => {
    return stateLedger.addMemory(content, tags, agentId);
  });

  ipcMain.handle('db:search-memory', (_, query) => {
    return stateLedger.searchMemory(query);
  });

  // --- Wizard Handlers ---
  ipcMain.handle('check-cli-tools', async () => {
    const tools = ['claude', 'gemini', 'jules'];
    const results: Record<string, boolean> = {};
    const cmd = process.platform === 'win32' ? 'where' : 'which';
    for (const tool of tools) {
        results[tool] = await new Promise<boolean>((res) => {
            // Resolves C-5: Use execFile for safe tool checking
            execFile(cmd, [tool], (err) => res(!err));
        });
    }
    return results;
  });

  ipcMain.handle('select-folder', async () => {
    if (!win) return null;
    const res = await dialog.showOpenDialog(win, { properties: ['openDirectory'] });
    return res.canceled ? null : res.filePaths[0];
  });

  ipcMain.handle('save-preferences', async (_, preferences) => {
    try {
        fs.writeFileSync(path.join(COPERNICUS_HOME, 'preferences.json'), JSON.stringify(preferences, null, 2));
        return { success: true };
    } catch (e) {
        return { success: false, error: String(e) };
    }
  });

  ipcMain.handle('restart-app', () => {
    app.relaunch();
    app.quit();
  });

  // --- Slash Commands ---
  setupCommandHandlers();

  // --- LLM Chat ──────────────────────────────────────────────────────────────
  ipcMain.handle('chat:send', async (_event, payload: unknown) => {
    if (
      typeof payload !== 'object' || payload === null ||
      typeof (payload as any).sessionId !== 'string' ||
      !Array.isArray((payload as any).messages) ||
      typeof (payload as any).model !== 'string'
    ) {
      throw new Error('[chat:send] Invalid payload')
    }

    // Fire-and-forget — LLMService resolves provider/key internally
    // Tokens broadcast via chat:token, chat:done, chat:error IPC events
    llmService.streamChat(payload as any).catch(err => {
      console.error('[LLM] streamChat error:', err)
    })

    return { ok: true }
  })

  // --- File System ────────────────────────────────────────────────────────────
  ipcMain.handle('fs:list-dir', (_event, dirPath: unknown) => {
    if (typeof dirPath !== 'string') throw new Error('[fs:list-dir] dirPath must be a string')
    return fsManager.listDir(dirPath)
  })

  ipcMain.handle('fs:open-file', (_event, filePath: unknown) => {
    if (typeof filePath !== 'string') throw new Error('[fs:open-file] filePath must be a string')
    return fsManager.readFile(filePath)
  })

  ipcMain.handle('fs:save-file', (_event, payload: unknown) => {
    if (
      typeof payload !== 'object' || payload === null ||
      typeof (payload as any).filePath !== 'string' ||
      typeof (payload as any).content !== 'string'
    ) {
      throw new Error('[fs:save-file] Invalid payload')
    }
    const { filePath, content } = payload as { filePath: string; content: string }
    fsManager.writeFile(filePath, content)
    return { ok: true }
  })

  ipcMain.handle('app:get-root-path', () => {
    return fsManager.getRootPath()
  })

  // Splash Ready
  ipcMain.on('splash-ready', () => {
    if (win) {
      win.show();
      splashWin?.close();
    }
  });

  // App Lifecycle
  ipcMain.handle('app:quit', () => {
    app.quit();
  });
}

// Quit when all windows are closed, except on macOS.
app.on('window-all-closed', () => {
  ptyManager.killAll();
  stateLedger.close();
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow(true)
  }
})

app.whenReady().then(() => {
  ensureCopernicusDirectory();
  registerIpcHandlers();
  createSplashWindow();
  createWindow(false);
  
  // Simulate Initialization Sequence
  setTimeout(() => splashWin?.webContents.send('splash-status', 'LOADING KERNEL...'), 1000);
  setTimeout(() => splashWin?.webContents.send('splash-status', 'IGNITING AGENTS...'), 2500);
  setTimeout(() => splashWin?.webContents.send('splash-status', 'ESTABLISHING ORBIT...'), 3500);

  if (app.isPackaged) setupAutoUpdater();
})
