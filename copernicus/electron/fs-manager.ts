import fs from 'fs'
import path from 'path'
import os from 'os'
import log from './utils/logger'
import { TransactionManager } from './utils/transaction-manager'
import { stateLedger } from './db/state-ledger'

export interface FileNode {
  name: string
  path: string
  isDir: boolean
  children?: FileNode[]
}

// Sensitive directories that must never be accessible even within homedir
const BLOCKED_HOME_SUBDIRS = [
  '.ssh', '.aws', '.gnupg', '.config/gh', '.kube',
  '.azure', '.gcp', '.docker',
]

export class FSManager {
  private rootPath: string = ''
  public tx: TransactionManager | null = null

  private expandHome(p: string): string {
    if (p.startsWith('~')) {
      return path.join(os.homedir(), p.slice(1))
    }
    return p
  }

  setRootPath(p: string): void {
    this.rootPath = path.resolve(this.expandHome(p))
    log.info(`[FSManager] Sandbox root established: ${this.rootPath}`)
    
    // Initialize Transaction Manager in .copernicus inside workspace if possible, 
    // or fallback to ~/.copernicus
    const copernicusDir = path.join(os.homedir(), '.copernicus')
    if (!fs.existsSync(copernicusDir)) {
      fs.mkdirSync(copernicusDir, { recursive: true })
    }
    this.tx = new TransactionManager(copernicusDir, stateLedger)
  }

  async beginTransaction(id?: string): Promise<string> {
    if (!this.tx) throw new Error('TransactionManager not initialized');
    return this.tx.createTransaction(id);
  }

  async stageFile(id: string, filePath: string, content: string): Promise<void> {
    if (!this.tx) throw new Error('TransactionManager not initialized');
    const activeId = this.tx.getActiveTransactionId();
    if (!activeId || activeId !== id) {
      throw new Error(`Transaction ID mismatch: active=${activeId}, requested=${id}`);
    }
    await this.tx.stageEdit(filePath, content);
  }

  async commitTransaction(id: string): Promise<void> {
    if (!this.tx) throw new Error('TransactionManager not initialized');
    const activeId = this.tx.getActiveTransactionId();
    if (!activeId || activeId !== id) {
      throw new Error(`Transaction ID mismatch: active=${activeId}, requested=${id}`);
    }
    await this.tx.commit();
  }

  async rollbackTransaction(id: string): Promise<void> {
    if (!this.tx) throw new Error('TransactionManager not initialized');
    const activeId = this.tx.getActiveTransactionId();
    if (!activeId || activeId !== id) {
      throw new Error(`Transaction ID mismatch: active=${activeId}, requested=${id}`);
    }
    await this.tx.rollback();
  }

  async undoLastTransaction(): Promise<void> {
    const last = stateLedger.getLastTransaction();
    if (!last) throw new Error('No transaction found to undo');

    log.info(`[FSManager] Undoing transaction ${last.id}...`);
    for (const f of last.files) {
      if (f.beforeHash) {
      }
    }
    log.warn('[FSManager] Undo logic partially implemented — requires persistent original content store.');
  }

  private assertSafe(filePath: string, mode: 'read' | 'write' = 'read'): void {
    const resolved = path.resolve(this.expandHome(filePath))
    const home = os.homedir()

    // Reads: allow home directory EXCEPT blocked subdirectories
    // This check is independent of rootPath to allow project discovery
    if (mode === 'read') {
      if (resolved.startsWith(home + path.sep) || resolved === home) {
        for (const blocked of BLOCKED_HOME_SUBDIRS) {
          if (resolved.startsWith(path.join(home, blocked))) {
            throw new Error(`[fs-manager] Read blocked — sensitive directory: ${filePath}`)
          }
        }
        return
      }
    }

    // From here on, we need rootPath for strict project-relative checks
    if (!this.rootPath) {
      throw new Error('[fs-manager] rootPath not set — call setRootPath() before file operations')
    }

    // Writes are restricted to project root only
    if (mode === 'write') {
      if (!resolved.startsWith(this.rootPath + path.sep) && resolved !== this.rootPath) {
        throw new Error(`[fs-manager] Write blocked outside project root: ${filePath}`)
      }
      return
    }

    // Reads: allow project root (if not already allowed by home check above)
    if (resolved.startsWith(this.rootPath + path.sep) || resolved === this.rootPath) {
      return
    }

    throw new Error(`[fs-manager] Path traversal blocked: ${filePath} (Root: ${this.rootPath})`)
  }

  listDir(dirPath: string): FileNode[] {
    const expandedPath = path.resolve(this.expandHome(dirPath))
    this.assertSafe(expandedPath, 'read')
    
    const entries = fs.readdirSync(expandedPath, { withFileTypes: true })
    const data = entries
      .filter(e => e.name !== 'node_modules')
      .map(e => {
        const fullPath = path.join(expandedPath, e.name)
        let isDir = e.isDirectory()
        if (e.isSymbolicLink()) {
          try {
            isDir = fs.statSync(fullPath).isDirectory()
          } catch { /* ignore broken symlinks */ }
        }
        return {
          name: e.name,
          path: fullPath,
          isDir,
        }
      })
      .sort((a, b) => {
        // Directories first
        if (a.isDir && !b.isDir) return -1
        if (!a.isDir && b.isDir) return 1
        return a.name.localeCompare(b.name)
      })
    return data
  }

  readFile(filePath: string): string {
    const expandedPath = this.expandHome(filePath)
    this.assertSafe(expandedPath, 'read')
    return fs.readFileSync(expandedPath, 'utf-8')
  }

  async writeFile(filePath: string, content: string, opts?: { dryRun?: boolean }): Promise<void> {
    const expandedPath = this.expandHome(filePath)
    this.assertSafe(expandedPath, 'write')
    
    // If we have an active transaction and NOT dryRun, stage it instead of writing
    if (this.tx?.getActiveTransactionId() && !opts?.dryRun) {
      await this.tx.stageEdit(expandedPath, content)
      return
    }

    if (opts?.dryRun) {
      return
    }

    fs.writeFileSync(expandedPath, content, 'utf-8')
  }

  
  createFile(filePath: string): void {
    const expandedPath = this.expandHome(filePath)
    this.assertSafe(expandedPath, 'write')
    fs.writeFileSync(expandedPath, '', 'utf-8')
  }

  createDir(dirPath: string): void {
    const expandedPath = this.expandHome(dirPath)
    this.assertSafe(expandedPath, 'write')
    fs.mkdirSync(expandedPath, { recursive: true })
  }

  rename(oldPath: string, newPath: string): void {
    const expandedOld = this.expandHome(oldPath)
    const expandedNew = this.expandHome(newPath)
    this.assertSafe(expandedOld, 'write')
    this.assertSafe(expandedNew, 'write')
    fs.renameSync(expandedOld, expandedNew)
  }

  async trash(filePath: string): Promise<void> {
    const expandedPath = this.expandHome(filePath)
    this.assertSafe(expandedPath, 'write')
    const { shell } = require('electron')
    await shell.trashItem(expandedPath)
  }

  reveal(filePath: string): void {
    const expandedPath = this.expandHome(filePath)
    this.assertSafe(expandedPath, 'read')
    const { shell } = require('electron')
    shell.showItemInFolder(expandedPath)
  }

  getRootPath(): string {
    return this.rootPath
  }
}

export const fsManager = new FSManager()
