import fs from 'node:fs'
import path from 'node:path'
import { EventEmitter } from 'node:events'
import { randomUUID } from 'node:crypto'
import chokidar from 'chokidar'
import log from '../utils/logger'

export interface LogEntry {
  id: string          // uuid
  timestamp: string   // ISO string
  level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG'
  source: 'copernicus' | 'language-server' | 'backend'
  message: string
}

export class LogTailer extends EventEmitter {
  private logDir: string
  private watchers: Map<string, chokidar.FSWatcher> = new Map()
  private positions: Map<string, number> = new Map()
  private onLineCallback: ((entry: LogEntry) => void) | null = null

  constructor(logDir: string) {
    super()
    this.logDir = logDir
  }

  public listSources(): string[] {
    return ['copernicus', 'language-server', 'backend']
  }

  public getHistory(limit: number = 200): LogEntry[] {
    const allLogs: LogEntry[] = []
    const sources = this.listSources() as Array<'copernicus' | 'language-server' | 'backend'>
    
    for (const source of sources) {
      const logPath = path.join(this.logDir, `${source}.log`)
      if (fs.existsSync(logPath)) {
        try {
          const content = fs.readFileSync(logPath, 'utf-8')
          const lines = content.split('\n')
          for (const line of lines) {
            if (line.trim()) {
              allLogs.push(this.parseLine(line, source))
            }
          }
        } catch (e) {
          log.error(`Failed to read log file: ${logPath}`, e)
        }
      }
    }

    // Sort by timestamp DESCENDING and limit
    return allLogs
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit)
  }

  public startTailing(onLine: (entry: LogEntry) => void): Promise<void> {
    this.onLineCallback = onLine
    const sources = this.listSources() as Array<'copernicus' | 'language-server' | 'backend'>
    const readyPromises: Promise<void>[] = []

    for (const source of sources) {
      const logPath = path.join(this.logDir, `${source}.log`)

      // Ensure directory exists
      const dir = path.dirname(logPath)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }

      // Ensure file exists
      if (!fs.existsSync(logPath)) {
        fs.writeFileSync(logPath, '')
      }

      this.positions.set(source, fs.statSync(logPath).size)

      if (this.watchers.has(source)) {
        this.watchers.get(source)?.close()
      }

      const watcher = chokidar.watch(logPath, {
        persistent: true,
        usePolling: process.platform === 'win32', // Polling is often better on Windows
        interval: 100,
      })

      watcher.on('change', () => {
        this.handleFileChange(source, logPath)
      })

      this.watchers.set(source, watcher)
      readyPromises.push(new Promise<void>(resolve => watcher.on('ready', resolve)))
    }

    return Promise.all(readyPromises).then(() => undefined)
  }

  public stopTailing(): void {
    for (const watcher of this.watchers.values()) {
      watcher.close()
    }
    this.watchers.clear()
    this.onLineCallback = null
  }

  private handleFileChange(source: 'copernicus' | 'language-server' | 'backend', logPath: string): void {
    try {
      const stats = fs.statSync(logPath)
      const oldPos = this.positions.get(source) || 0
      const newPos = stats.size

      if (newPos < oldPos) {
        // File truncated
        this.positions.set(source, 0)
        return
      }

      if (newPos === oldPos) return

      const bufferSize = newPos - oldPos
      if (bufferSize > 1024 * 1024) { // Safety: don't read more than 1MB at once
        this.positions.set(source, newPos)
        return
      }

      const buffer = Buffer.alloc(bufferSize)
      const fd = fs.openSync(logPath, 'r')
      fs.readSync(fd, buffer, 0, bufferSize, oldPos)
      fs.closeSync(fd)

      const content = buffer.toString('utf-8')
      const lines = content.split('\n')
      for (const line of lines) {
        if (line.trim()) {
          const parsed = this.parseLine(line, source)
          if (this.onLineCallback) {
            this.onLineCallback(parsed)
          }
          this.emit('line', parsed)
        }
      }

      this.positions.set(source, newPos)
    } catch (e) {
      log.error(`Error tailing log file ${logPath}:`, e)
    }
  }

  private parseLine(line: string, source: 'copernicus' | 'language-server' | 'backend'): LogEntry {
    // Expected format: [YYYY-MM-DD HH:mm:ss.SSS] [level] message
    const match = line.match(/^\[(.*?)\]\s+\[(.*?)\]\s+(.*)$/)
    if (match && match[1] && match[2] && match[3]) {
      let level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG' = 'INFO'
      const rawLevel = match[2].toUpperCase()
      if (['INFO', 'WARN', 'ERROR', 'DEBUG'].includes(rawLevel)) {
        level = rawLevel as any
      }

      return {
        id: randomUUID(),
        timestamp: match[1],
        level,
        source,
        message: match[3]
      }
    }

    return {
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      level: 'INFO',
      source,
      message: line
    }
  }
}
