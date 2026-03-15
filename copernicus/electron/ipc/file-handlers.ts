import { ipcMain, BrowserWindow, dialog } from 'electron'
import path from 'node:path'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import log from 'electron-log'
import { handleIpc } from '../utils/handle-ipc'
import { assertSafePath } from '../utils/path-guard'
import { parseMakefile } from '../utils/makefile-parser'

import { IpcHandlerDeps } from './deps'

export function register(win: BrowserWindow, deps: IpcHandlerDeps) {
  const { fsManager, codebaseIndexer, stateLedger, applyAndVerifyPatch, reversePatch } = deps

  // Transactional File Ops (Story 220)
  ipcMain.handle('fs:tx-begin', () => handleIpc('fs:tx-begin', [], () => fsManager.beginTransaction()))
  ipcMain.handle('fs:tx-commit', (_e, id) => handleIpc('fs:tx-commit', [id], () => fsManager.commitTransaction(id)))
  ipcMain.handle('fs:tx-rollback', (_e, id) => handleIpc('fs:tx-rollback', [id], () => fsManager.rollbackTransaction(id)))
  ipcMain.handle('fs:tx-status', () => handleIpc('fs:tx-status', [], () => fsManager.tx?.getActiveTransactionId()))
  ipcMain.handle('fs:save-multiple', (_e, files: { filePath: string, content: string }[]) => handleIpc('fs:save-multiple', [files], async () => {
    const txId = await fsManager.beginTransaction();
    try {
      for (const f of files) {
        assertSafePath(f.filePath);
        await fsManager.stageFile(txId, f.filePath, f.content);
      }
      await fsManager.commitTransaction(txId);
      return { ok: true, txId };
    } catch (err: unknown) {
      try {
        await fsManager.rollbackTransaction(txId);
      } catch (rollbackErr) {
        log.error('Rollback failed:', rollbackErr);
      }
      const message = err instanceof Error ? err.message : String(err);
      return { ok: false, error: message };
    }
  }))
  ipcMain.handle('fs:undo-last-transaction', () => handleIpc('fs:undo-last-transaction', [], () => fsManager.undoLastTransaction()))

  // Agent Branch/Patch (Story 230)
  ipcMain.handle('agent:patch-apply', (_e, { changes, baseCommit, workingTree, dryRun }) => handleIpc('agent:patch-apply', [{ changes, baseCommit, workingTree, dryRun }], () => applyAndVerifyPatch(changes, baseCommit, workingTree, dryRun)))
  
  ipcMain.handle('agent:patch-reverse', (_e, { changes, baseCommit, workingTree }) => handleIpc('agent:patch-reverse', [{ changes, baseCommit, workingTree }], () => reversePatch(changes, baseCommit, workingTree)))

  ipcMain.handle('fs:select-file', () => handleIpc('fs:select-file', [], async () => {
    const w = BrowserWindow.getAllWindows()[0];
    if (!w) return null;
    const { canceled, filePaths } = await dialog.showOpenDialog(w, {
      properties: ['openFile'],
      filters: [
        { name: 'All Files', extensions: ['*'] },
        { name: 'Text Files', extensions: ['txt', 'md', 'ts', 'tsx', 'js', 'jsx', 'py', 'json'] },
        { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'] }
      ]
    });
    return canceled ? null : filePaths[0];
  }));

  ipcMain.handle('dialog:open-file', () => handleIpc('dialog:open-file', [], async () => {
    const w = BrowserWindow.getAllWindows()[0];
    if (!w) return null;
    const { canceled, filePaths } = await dialog.showOpenDialog(w, {
      properties: ['openFile'],
      filters: [
        { name: 'All Files', extensions: ['*'] },
        { name: 'Text Files', extensions: ['txt', 'md', 'ts', 'tsx', 'js', 'jsx', 'py', 'json'] },
        { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'] }
      ]
    });
    return canceled ? null : filePaths[0];
  }));

  ipcMain.handle('select-folder', () => handleIpc('select-folder', [], async () => {
    const w = BrowserWindow.getAllWindows()[0];
    if (!w) return null;
    const { canceled, filePaths } = await dialog.showOpenDialog(w, { properties: ['openDirectory'] });
    return canceled ? null : filePaths[0];
  }));

  ipcMain.handle('dialog:open-folder', () => handleIpc('dialog:open-folder', [], async () => {
    const w = BrowserWindow.getAllWindows()[0];
    if (!w) return null;
    const { canceled, filePaths } = await dialog.showOpenDialog(w, { properties: ['openDirectory'] });
    return canceled ? null : filePaths[0];
  }));

  ipcMain.handle('fs:make-dir', (_e, dirPath: string) => handleIpc('fs:make-dir', [dirPath], async () => {
    assertSafePath(dirPath);
    await fs.promises.mkdir(dirPath, { recursive: true })
  }));

  // File System
  ipcMain.handle('fs:list-dir', (_event, dirPath: string) => handleIpc('fs:list-dir', [dirPath], () => fsManager.listDir(dirPath)))

  ipcMain.handle('fs:list-files-recursive', (_e, dirPath: string) => handleIpc('fs:list-files-recursive', [dirPath], () => {
    const root = dirPath || fsManager.getRootPath()
    if (!root) throw new Error('NO_ROOT')
    const results: { path: string, size: number }[] = []
    
    const walk = (dir: string) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true })
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name)
        if (entry.isDirectory()) {
          if (['node_modules', '.git', 'dist', 'release'].includes(entry.name)) continue
          walk(fullPath)
        } else {
          if (/\.(ts|tsx|py)$/.test(entry.name)) {
            const stats = fs.statSync(fullPath)
            results.push({ path: fullPath, size: stats.size })
          }
        }
      }
    }
    
    walk(root)
    return results
  }))

  
  ipcMain.handle('fs:create-file', (_e, filePath: string) => handleIpc('fs:create-file', [filePath], () => fsManager.createFile(filePath)))
  ipcMain.handle('fs:create-dir', (_e, dirPath: string) => handleIpc('fs:create-dir', [dirPath], () => fsManager.createDir(dirPath)))
  ipcMain.handle('fs:rename', (_e, { oldPath, newPath }: { oldPath: string, newPath: string }) => handleIpc('fs:rename', [{oldPath, newPath}], () => fsManager.rename(oldPath, newPath)))
  ipcMain.handle('fs:trash', (_e, filePath: string) => handleIpc('fs:trash', [filePath], () => fsManager.trash(filePath)))
  ipcMain.handle('fs:reveal', (_e, filePath: string) => handleIpc('fs:reveal', [filePath], () => fsManager.reveal(filePath)))

  ipcMain.handle('fs:open-file', (_event, filePath: string) => handleIpc('fs:open-file', [filePath], () => fsManager.readFile(filePath)))
  ipcMain.handle('fs:read-file', (_event, filePath: string) => handleIpc('fs:read-file', [filePath], () => {
    assertSafePath(filePath);
    return fsManager.readFile(filePath);
  }))
  ipcMain.handle('fs:save-file', (_event, { filePath, content }: { filePath: string; content: string }) => handleIpc('fs:save-file', [{ filePath, content }], async () => {
    assertSafePath(filePath);
    await fsManager.writeFile(filePath, content)
    codebaseIndexer.indexFile(filePath).catch(log.error)
    return true
  }))

  // Project Billing (Story 211)
  ipcMain.handle('project:save-billing', (_e, project: { id: string; path: string; billing_mode: 'fixed' | 'hourly' }) => handleIpc('project:save-billing', [project], async () => {
      let finalPath = project.path;
      if (!path.isAbsolute(finalPath)) {
        const root = fsManager.getRootPath();
        finalPath = path.join(root, finalPath);
      }
      
      // Ensure directory exists
      if (!fs.existsSync(finalPath)) {
        await fs.promises.mkdir(finalPath, { recursive: true });
        log.info(`[Main] Created project directory: ${finalPath}`);
      }

      const record = {
        ...project,
        path: finalPath
      };
      
      stateLedger.upsertProject(record);
      return { ok: true, path: finalPath };
    }))
  
  ipcMain.handle('project:get-billing', (_e, path: string) => handleIpc('project:get-billing', [path], () => stateLedger.getProjectByPath(path)))

  // Makefile Handlers
  ipcMain.handle('makefile:list', () => handleIpc('makefile:list', [], () => parseMakefile(fsManager.getRootPath())))
  ipcMain.handle('makefile:run', (_event, target) => handleIpc('makefile:run', [target], () => {
    const ALLOWED = ['dev', 'test', 'build', 'lint', 'backlog', 'deploy'];
    if (!ALLOWED.includes(target)) return;
    const child = spawn('make', [target], { cwd: fsManager.getRootPath(), shell: false })
    child.stdout.on('data', (data) => win?.webContents.send('terminal:data', data.toString()))
    child.stderr.on('data', (data) => win?.webContents.send('terminal:data', data.toString()))
    child.on('close', (code) => win?.webContents.send('terminal:data', `\n[Process exited with code ${code}]`))
    return true
  }))

  // Canvas Handlers (Story 153)
  ipcMain.handle('canvas:get-iframe-bounds', () => handleIpc('canvas:get-iframe-bounds', [], () => deps.getCanvasIframeBounds?.()))

  ipcMain.handle('canvas:capture-screenshot', (_event, options?: { x?: number; y?: number; width?: number; height?: number }) => handleIpc('canvas:capture-screenshot', [options], async () => {
    if (!win) throw new Error('NO_WINDOW')
    const rect = options?.width
      ? { x: options.x ?? 0, y: options.y ?? 0, width: options.width, height: options.height ?? 400 }
      : undefined
    const image = await win.webContents.capturePage(rect)
    return `data:image/png;base64,${image.toPNG().toString('base64')}`
  }))

  ipcMain.handle('canvas:screenshot-preview', () => handleIpc('canvas:screenshot-preview', [], async () => {
    if (!win) throw new Error('NO_WINDOW')
    const canvasIframeBounds = deps.getCanvasIframeBounds?.()
    if (!canvasIframeBounds) throw new Error('IFRAME_BOUNDS_UNKNOWN')
    const image = await win.webContents.capturePage(canvasIframeBounds)
    const dataUrl = `data:image/png;base64,${image.toPNG().toString('base64')}`
    win.webContents.send('canvas:render', { content: `<img src="${dataUrl}" style="max-width:100%;display:block;" />` })
    return dataUrl
  }))

  ipcMain.handle('canvas:execute-js', (_event, script: string) => handleIpc('canvas:execute-js', [script], async () => {
    if (!win) throw new Error('NO_WINDOW')
    const result = await win.webContents.executeJavaScript(script, true)
    return JSON.stringify(result)
  }))

  ipcMain.handle('canvas:send-input', (_event, event: Electron.MouseInputEvent | Electron.KeyboardInputEvent) => handleIpc('canvas:send-input', [event], async () => {
    if (!win) throw new Error('NO_WINDOW')
    win.webContents.sendInputEvent(event)
    return true
  }))
}
