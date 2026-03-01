import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import { ptyManager } from './pty-manager';
import os from 'os';

// The built directory structure
process.env.DIST = path.join(__dirname, '../dist');
process.env.VITE_PUBLIC = app.isPackaged ? process.env.DIST : path.join(__dirname, '../public');

let win: BrowserWindow | null;
const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL'];

function createWindow() {
  win = new BrowserWindow({
    width: 1400,
    height: 900,
    backgroundColor: '#050505', // --copernicus-bg
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 10, y: 10 },
    vibrancy: 'under-window',
    visualEffectState: 'active',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', (new Date).toLocaleString());
  });

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    const distPath = process.env.DIST || path.join(__dirname, '../dist');
    win.loadFile(path.join(distPath, 'index.html'));
  }

  // --- Terminal IPC ---
  ipcMain.on('terminal-create', (event, { id, cols, rows, cwd }) => {
    if (win) {
      ptyManager.create(id, cols, rows, cwd || os.homedir(), win);
    }
  });

  ipcMain.on('terminal-resize', (event, { id, cols, rows }) => {
    ptyManager.resize(id, cols, rows);
  });

  ipcMain.on('terminal-write', (event, { id, data }) => {
    ptyManager.write(id, data);
  });

  ipcMain.on('terminal-kill', (event, { id }) => {
    ptyManager.kill(id);
  });
}

// Quit when all windows are closed, except on macOS.
app.on('window-all-closed', () => {
  ptyManager.killAll(); // Ensure all terminals are killed
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.whenReady().then(createWindow);
