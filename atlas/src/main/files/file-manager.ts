import { ipcMain } from 'electron';
import { readdirSync, statSync, readFileSync, existsSync } from 'fs';
import { join, basename, relative } from 'path';

export interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileNode[];
}

export class FileManager {
  constructor() {
    this.setupIpc();
  }

  private setupIpc() {
    ipcMain.handle('files:list', (event, rootPath: string) => {
      return this.listDirectory(rootPath);
    });

    ipcMain.handle('files:read', (event, filePath: string) => {
      try {
        return { success: true, content: readFileSync(filePath, 'utf-8') };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    });
  }

  private listDirectory(dirPath: string, depth = 0): FileNode[] {
    if (depth > 5) return []; // Prevent too deep recursion
    try {
      if (!existsSync(dirPath)) return [];
      const entries = readdirSync(dirPath);
      const nodes: FileNode[] = [];

      for (const entry of entries) {
        // Skip hidden files and common noise
        if (entry.startsWith('.') || entry === 'node_modules' || entry === 'dist' || entry === 'out') continue;

        const fullPath = join(dirPath, entry);
        try {
          const stats = statSync(fullPath);

          if (stats.isDirectory()) {
            nodes.push({
              name: entry,
              path: fullPath,
              type: 'directory',
              children: this.listDirectory(fullPath, depth + 1)
            });
          } else {
            nodes.push({
              name: entry,
              path: fullPath,
              type: 'file'
            });
          }
        } catch (e) {
          // Skip files we can't access
        }
      }

      // Sort: Directories first, then alphabetical
      return nodes.sort((a, b) => {
        if (a.type === b.type) return a.name.localeCompare(b.name);
        return a.type === 'directory' ? -1 : 1;
      });
    } catch (err) {
      console.error(`Failed to list directory ${dirPath}:`, err);
      return [];
    }
  }
}
