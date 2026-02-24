import { app, BrowserWindow, ipcMain } from 'electron'
import path from 'node:path'
import { AuthManager } from './auth-manager'
import { ModelRegistry } from './models/model-registry'
import { registerSecurityHandlers } from './security'
import { SettingsStore } from './settings-store'
import { createTouchBar } from './touch-bar'

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


let win: BrowserWindow | null
// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']

const authManager = new AuthManager()
const modelRegistry = new ModelRegistry()
const settingsStore = new SettingsStore()
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

  // System Execution Placeholder (To be refined by Jules in Story 091)
  ipcMain.on('system:make', (_, target: string) => {
    console.log(`[SYSTEM] Hardware trigger: make ${target}`);
    // implementation coming in Kanban surgery
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
