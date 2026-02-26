import fs from 'fs'
import path from 'path'
import os from 'os'

export interface FileNode {
  name: string
  path: string
  isDir: boolean
  children?: FileNode[]
}

export class FSManager {
  private rootPath: string = process.env.COPERNICUS_ROOT ?? process.cwd()

  setRootPath(p: string): void {
    this.rootPath = path.resolve(p)
    console.log(`[FSManager] Sandbox root established: ${this.rootPath}`)
  }

  private assertSafe(filePath: string): void {
    const resolved = path.resolve(filePath)
    if (!resolved.startsWith(this.rootPath) && !resolved.startsWith(os.homedir())) {
      throw new Error(`[fs-manager] Path traversal blocked: ${filePath} (Root: ${this.rootPath})`)
    }
  }

  listDir(dirPath: string): FileNode[] {
    this.assertSafe(dirPath)
    const entries = fs.readdirSync(dirPath, { withFileTypes: true })
    return entries
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
  }

  readFile(filePath: string): string {
    this.assertSafe(filePath)
    return fs.readFileSync(filePath, 'utf-8')
  }

  writeFile(filePath: string, content: string): void {
    this.assertSafe(filePath)
    fs.writeFileSync(filePath, content, 'utf-8')
  }

  getRootPath(): string {
    return this.rootPath
  }
}

export const fsManager = new FSManager()
