import { ipcMain, BrowserWindow, dialog } from 'electron'
import path from 'node:path'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import log from 'electron-log'
import { handleIpc } from '../utils/handle-ipc'
import { assertSafePath } from '../utils/path-guard'
import { parseMakefile } from '../utils/makefile-parser'

export function register(win: BrowserWindow, deps: any) {
  const { fsManager, codebaseIndexer, stateLedger, applyAndVerifyPatch, reversePatch } = deps

  // Transactional File Ops (Story 220)
  ipcMain.handle('fs:tx-begin', () => handleIpc(() => fsManager.beginTransaction()))
  ipcMain.handle('fs:tx-commit', (_e, id) => handleIpc(() => fsManager.commitTransaction(id)))
  ipcMain.handle('fs:tx-rollback', (_e, id) => handleIpc(() => fsManager.rollbackTransaction(id)))
  ipcMain.handle('fs:tx-status', () => handleIpc(() => fsManager.tx?.getActiveTransactionId()))
  ipcMain.handle('fs:save-multiple', (_e, files: { filePath: string, content: string }[]) => handleIpc(async () => {
    const txId = await fsManager.beginTransaction();
    try {
      for (const f of files) {
        await fsManager.stageFile(txId, f.filePath, f.content);
      }
      await fsManager.commitTransaction(txId);
      return { ok: true, txId };
    } catch (err: any) {
      await fsManager.rollbackTransaction(txId);
      return { ok: false, error: err.message };
    }
  }))
  ipcMain.handle('fs:undo-last-transaction', () => handleIpc(() => fsManager.undoLastTransaction()))

  // Agent Branch/Patch (Story 230)
  ipcMain.handle('agent:patch-apply', (_e, { changes, baseCommit, workingTree, dryRun }) => 
    handleIpc(() => applyAndVerifyPatch(changes, baseCommit, workingTree, dryRun)))
  
  ipcMain.handle('agent:patch-reverse', (_e, { changes, baseCommit, workingTree }) => 
    handleIpc(() => reversePatch(changes, baseCommit, workingTree)))

  ipcMain.handle('fs:select-file', () => handleIpc(async () => {
    if (!win) return null;
    const { canceled, filePaths } = await dialog.showOpenDialog(win, { 
      properties: ['openFile'],
      filters: [
        { name: 'All Files', extensions: ['*'] },
        { name: 'Text Files', extensions: ['txt', 'md', 'ts', 'tsx', 'js', 'jsx', 'py', 'json'] },
        { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'] }
      ]
    });
    return canceled ? null : filePaths[0];
  }));

  ipcMain.handle('select-folder', () => handleIpc(async () => {
    if (!win) return null;
    const { canceled, filePaths } = await dialog.showOpenDialog(win, { properties: ['openDirectory'] });
    return canceled ? null : filePaths[0];
  }));

  ipcMain.handle('fs:make-dir', (_e, dirPath: string) => handleIpc(() => {
    assertSafePath(dirPath);
    fs.mkdirSync(dirPath, { recursive: true })
  }));

  // File System
  ipcMain.handle('fs:list-dir', (_event, dirPath: string) => handleIpc(() => fsManager.listDir(dirPath)))
  ipcMain.handle('fs:open-file', (_event, filePath: string) => handleIpc(() => fsManager.readFile(filePath)))
  ipcMain.handle('fs:read-file', (_event, filePath: string) => handleIpc(() => fsManager.readFile(filePath)))
  ipcMain.handle('fs:save-file', (_event, { filePath, content }: any) => handleIpc(async () => {
    await fsManager.writeFile(filePath, content)
    codebaseIndexer.indexFile(filePath).catch(log.error)
    return true
  }))

  // Project Billing (Story 211)
  ipcMain.handle('project:save-billing', (_e, project: any) => 
    handleIpc(async () => {
      let finalPath = project.path;
      if (!path.isAbsolute(finalPath)) {
        const root = fsManager.getRootPath();
        finalPath = path.join(root, finalPath);
      }
      
      // Ensure directory exists
      if (!fs.existsSync(finalPath)) {
        fs.mkdirSync(finalPath, { recursive: true });
        log.info(`[Main] Created project directory: ${finalPath}`);
      }

      const record = {
        ...project,
        path: finalPath
      };
      
      stateLedger.upsertProject(record);
      return { ok: true, path: finalPath };
    }))
  
  ipcMain.handle('project:get-billing', (_e, path: string) => 
    handleIpc(() => stateLedger.getProjectByPath(path)))

  // Makefile Handlers
  ipcMain.handle('makefile:list', () => handleIpc(() => parseMakefile(fsManager.getRootPath())))
  ipcMain.handle('makefile:run', (_event, target) => handleIpc(() => {
    const ALLOWED = ['dev', 'test', 'build', 'lint', 'backlog', 'deploy'];
    if (!ALLOWED.includes(target)) return;
    const child = spawn('make', [target], { cwd: fsManager.getRootPath(), shell: false })
    child.stdout.on('data', (data) => win?.webContents.send('terminal:data', data.toString()))
    child.stderr.on('data', (data) => win?.webContents.send('terminal:data', data.toString()))
    child.on('close', (code) => win?.webContents.send('terminal:data', `\n[Process exited with code ${code}]`))
    return true
  }))

  // Canvas Handlers (Story 153)
  ipcMain.handle('canvas:get-iframe-bounds', () => handleIpc(() => deps.getCanvasIframeBounds()))

  ipcMain.handle('canvas:capture-screenshot', (_event, options?: { x?: number; y?: number; width?: number; height?: number }) => handleIpc(async () => {
    if (!win) throw new Error('NO_WINDOW')
    const rect = options?.width
      ? { x: options.x ?? 0, y: options.y ?? 0, width: options.width, height: options.height ?? 400 }
      : undefined
    const image = await win.webContents.capturePage(rect)
    return `data:image/png;base64,${image.toPNG().toString('base64')}`
  }))

  ipcMain.handle('canvas:screenshot-preview', () => handleIpc(async () => {
    if (!win) throw new Error('NO_WINDOW')
    const canvasIframeBounds = deps.getCanvasIframeBounds()
    if (!canvasIframeBounds) throw new Error('IFRAME_BOUNDS_UNKNOWN')
    const image = await win.webContents.capturePage(canvasIframeBounds)
    const dataUrl = `data:image/png;base64,${image.toPNG().toString('base64')}`
    win.webContents.send('canvas:render', { content: `<img src="${dataUrl}" style="max-width:100%;display:block;" />` })
    return dataUrl
  }))

  ipcMain.handle('canvas:execute-js', (_event, script: string) => handleIpc(async () => {
    if (!win) throw new Error('NO_WINDOW')
    const result = await win.webContents.executeJavaScript(script, true)
    return JSON.stringify(result)
  }))

  ipcMain.handle('canvas:send-input', (_event, event: any) => handleIpc(async () => {
    if (!win) throw new Error('NO_WINDOW')
    win.webContents.sendInputEvent(event)
    return true
  }))
}
