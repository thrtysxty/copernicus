import fs from 'fs'
import path from 'path'
import os from 'os'

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
  private rootPath: string = process.env.COPERNICUS_ROOT ?? process.cwd()

  setRootPath(p: string): void {
    this.rootPath = path.resolve(p)
    console.log(`[FSManager] Sandbox root established: ${this.rootPath}`)
  }

  private assertSafe(filePath: string, mode: 'read' | 'write' = 'read'): void {
    const resolved = path.resolve(filePath)
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
      this.assertSafe(dirPath, 'read')
      const entries = fs.readdirSync(dirPath, { withFileTypes: true })
      const data = entries
        .filter(e => !e.name.startsWith('.') && e.name !== 'node_modules')
        .map(e => ({
          name: e.name,
          path: path.join(dirPath, e.name),
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
      console.error('[FSManager] listDir error:', error)
      return { ok: false, error }
    }
  }

  readFile(filePath: string): { ok: true; data: string } | { ok: false; error: string } {
    try {
      this.assertSafe(filePath, 'read')
      const data = fs.readFileSync(filePath, 'utf-8')
      return { ok: true, data }
    } catch (err: unknown) {
      const error = err instanceof Error ? err.message : String(err)
      console.error('[FSManager] readFile error:', error)
      return { ok: false, error }
    }
  }

  writeFile(filePath: string, content: string): { ok: true } | { ok: false; error: string } {
    try {
      this.assertSafe(filePath, 'write')
      fs.writeFileSync(filePath, content, 'utf-8')
      return { ok: true }
    } catch (err: unknown) {
      const error = err instanceof Error ? err.message : String(err)
      console.error('[FSManager] writeFile error:', error)
      return { ok: false, error }
    }
  }

  getRootPath(): string {
    return this.rootPath
  }
}

export const fsManager = new FSManager()
