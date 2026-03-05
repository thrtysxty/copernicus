import fs from 'fs'
import path from 'path'
import os from 'os'
import log from './utils/logger'
import { TransactionManager } from './utils/transaction-manager'

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
    this.tx = new TransactionManager(copernicusDir)
  }

  private assertSafe(filePath: string, mode: 'read' | 'write' = 'read'): void {
    if (!this.rootPath) {
      throw new Error('[fs-manager] rootPath not set — call setRootPath() before file operations')
    }
    const resolved = path.resolve(this.expandHome(filePath))
    const home = os.homedir()

    // Writes are restricted to project root only
    if (mode === 'write') {
      if (!resolved.startsWith(this.rootPath + path.sep) && resolved !== this.rootPath) {
        throw new Error(`[fs-manager] Write blocked outside project root: ${filePath}`)
      }
      return
    }

    // Reads: allow project root
    if (resolved.startsWith(this.rootPath + path.sep) || resolved === this.rootPath) {
      return
    }

    // Reads: allow home directory EXCEPT blocked subdirectories
    if (resolved.startsWith(home + path.sep)) {
      for (const blocked of BLOCKED_HOME_SUBDIRS) {
        if (resolved.startsWith(path.join(home, blocked))) {
          throw new Error(`[fs-manager] Read blocked — sensitive directory: ${filePath}`)
        }
      }
      return
    }

    throw new Error(`[fs-manager] Path traversal blocked: ${filePath} (Root: ${this.rootPath})`)
  }

  listDir(dirPath: string): { ok: true; data: FileNode[] } | { ok: false; error: string } {
    try {
      const expandedPath = this.expandHome(dirPath)
      this.assertSafe(expandedPath, 'read')
      const entries = fs.readdirSync(expandedPath, { withFileTypes: true })
      const data = entries
        .filter(e => e.name !== 'node_modules')
        .map(e => ({
          name: e.name,
          path: path.join(expandedPath, e.name),
          isDir: e.isDirectory(),
        }))
        .sort((a, b) => {
          // Directories first
          if (a.isDir && !b.isDir) return -1
          if (!a.isDir && b.isDir) return 1
          return a.name.localeCompare(b.name)
        })
      return { ok: true, data }
    } catch (err: unknown) {
      const error = err instanceof Error ? err.message : String(err)
      log.error('[FSManager] listDir error:', error)
      return { ok: false, error }
    }
  }

  readFile(filePath: string): { ok: true; data: string } | { ok: false; error: string } {
    try {
      const expandedPath = this.expandHome(filePath)
      this.assertSafe(expandedPath, 'read')
      const data = fs.readFileSync(expandedPath, 'utf-8')
      return { ok: true, data }
    } catch (err: unknown) {
      const error = err instanceof Error ? err.message : String(err)
      log.error('[FSManager] readFile error:', error)
      return { ok: false, error }
    }
  }

  writeFile(filePath: string, content: string, opts?: { dryRun?: boolean }): { ok: true } | { ok: false; error: string } {
    try {
      const expandedPath = this.expandHome(filePath)
      this.assertSafe(expandedPath, 'write')
      
      // If we have an active transaction and NOT dryRun, stage it instead of writing
      if (this.tx?.getActiveTransactionId() && !opts?.dryRun) {
        this.tx.stageEdit(expandedPath, content)
        return { ok: true }
      }

      if (opts?.dryRun) {
        return { ok: true }
      }

      fs.writeFileSync(expandedPath, content, 'utf-8')
      return { ok: true }
    } catch (err: unknown) {
      const error = err instanceof Error ? err.message : String(err)
      log.error('[FSManager] writeFile error:', error)
      return { ok: false, error }
    }
  }

  getRootPath(): string {
    return this.rootPath
  }
}

export const fsManager = new FSManager()
