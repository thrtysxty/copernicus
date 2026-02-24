import { app, BrowserWindow, ipcMain } from 'electron'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { AuthManager } from './auth-manager'
import { ModelRegistry } from './models/model-registry'
import { registerSecurityHandlers } from './security'
import { SettingsStore } from './settings-store'
import { createTouchBar } from './touch-bar'
import { StoriesManager } from './stories'
import { parseMakefile } from './utils/makefile-parser'

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

// Determine project root (docs/ folder is in parent of benway/)
const ROOT_PATH = path.resolve(__dirname, '../../')

let win: BrowserWindow | null
// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']

const authManager = new AuthManager()
const modelRegistry = new ModelRegistry()
const settingsStore = new SettingsStore()
const storiesManager = new StoriesManager(ROOT_PATH)
// const _ptyAuditor = new PTYAuditor() // Placeholder: Will be used when pty.ts is implemented

function createWindow() {
  win = new BrowserWindow({
    width: 1200,
    height: 800,
    backgroundColor: '#050505', // --benway-bg
    titleBarStyle: 'hiddenInset', // Translucent headers
    trafficLightPosition: { x: 10, y: 10 },
    vibrancy: 'under-window',
    visualEffectState: 'active',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
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

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    const distPath = process.env.DIST || path.join(__dirname, '../dist');
    win.loadFile(path.join(distPath, 'index.html'))
  }
}

function registerIpcHandlers() {
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
      const { exec } = require('child_process');
      exec('git rev-parse --abbrev-ref HEAD', (error: any, stdout: string) => {
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
    storiesManager.updateStoryStatus(id, status)
  })

  ipcMain.handle('stories:hydrate', (_event, id) => {
    console.log(`[SYSTEM] Hydrating story: ${id}`)
    win?.webContents.send('editor:open', id) 
  })

  // Makefile Handlers
  ipcMain.handle('makefile:list', () => {
    return parseMakefile(ROOT_PATH)
  })

  ipcMain.handle('makefile:run', (_event, target) => {
    console.log(`[SYSTEM] Running make target: ${target}`)
    const child = spawn('make', [target], { cwd: ROOT_PATH, shell: true })
    
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
    const child = spawn('make', [target], { cwd: ROOT_PATH, shell: true })
    child.on('close', (code) => {
      console.log(`[SYSTEM] make ${target} exited with code ${code}`)
    })
  });
}

// Quit when all windows are closed, except on macOS.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.whenReady().then(() => {
  registerIpcHandlers();
  createWindow();
})
