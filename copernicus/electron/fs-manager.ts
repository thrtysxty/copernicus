import fs from 'fs'
import path from 'path'
import os from 'os'

export interface FileNode {
  name: string
  path: string
  isDir: boolean
  children?: FileNode[]
}

const ROOT_PATH = process.env.COPERNICUS_ROOT ?? process.cwd()

function assertSafe(filePath: string): void {
  const resolved = path.resolve(filePath)
  if (!resolved.startsWith(ROOT_PATH) && !resolved.startsWith(os.homedir())) {
    throw new Error(`[fs-manager] Path traversal blocked: ${filePath}`)
  }
}

export class FSManager {
  listDir(dirPath: string): FileNode[] {
    assertSafe(dirPath)
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
    assertSafe(filePath)
    return fs.readFileSync(filePath, 'utf-8')
  }

  writeFile(filePath: string, content: string): void {
    assertSafe(filePath)
    fs.writeFileSync(filePath, content, 'utf-8')
  }

  getRootPath(): string {
    return ROOT_PATH
  }
}

export const fsManager = new FSManager()
