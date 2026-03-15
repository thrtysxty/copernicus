import fs from 'node:fs'
import path from 'node:path'
import { EventEmitter } from 'node:events'
import log from '../utils/logger'

export interface LogLine {
  timestamp: string
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR'
  source: string
  message: string
}

export class LogTailer extends EventEmitter {
  private logDir: string
  private watchers: Map<string, fs.FSWatcher> = new Map()
  private positions: Map<string, number> = new Map()

  constructor(logDir: string) {
    super()
    this.logDir = logDir
    this.startTailing()
  }

  public listSources(): string[] {
    return ['copernicus', 'language-server', 'backend']
  }

  public getHistory(limit: number = 1000): LogLine[] {
    const allLogs: LogLine[] = []
    for (const source of this.listSources()) {
      const logPath = path.join(this.logDir, `${source}.log`)
      if (fs.existsSync(logPath)) {
        const content = fs.readFileSync(logPath, 'utf-8')
        const lines = content.split('\n')
        for (const line of lines) {
          if (line.trim()) {
            allLogs.push(this.parseLine(line, source))
          }
        }
      }
    }
    // Sort by timestamp and limit
    return allLogs
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
      .slice(-limit)
  }

  public stopTailing(): void {
    for (const watcher of this.watchers.values()) {
      watcher.close()
    }
    this.watchers.clear()
  }

  private startTailing(): void {
    for (const source of this.listSources()) {
      const logPath = path.join(this.logDir, `${source}.log`)
      
      // Ensure file exists
      if (!fs.existsSync(logPath)) {
        try {
          fs.mkdirSync(path.dirname(logPath), { recursive: true })
          fs.writeFileSync(logPath, '')
        } catch (e) {
          log.error(`Failed to create log file: ${logPath}`, e)
          continue
        }
      }

      this.positions.set(source, fs.statSync(logPath).size)

      const watcher = fs.watch(logPath, (event) => {
        if (event === 'change') {
          this.handleFileChange(source, logPath)
        }
      })
      this.watchers.set(source, watcher)
    }
  }

  private handleFileChange(source: string, logPath: string): void {
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

      const buffer = Buffer.alloc(newPos - oldPos)
      const fd = fs.openSync(logPath, 'r')
      fs.readSync(fd, buffer, 0, newPos - oldPos, oldPos)
      fs.closeSync(fd)

      const content = buffer.toString('utf-8')
      const lines = content.split('\n')
      for (const line of lines) {
        if (line.trim()) {
          const parsed = this.parseLine(line, source)
          this.emit('line', parsed)
        }
      }

      this.positions.set(source, newPos)
    } catch (e) {
      log.error(`Error tailing log file ${logPath}:`, e)
    }
  }

  private parseLine(line: string, source: string): LogLine {
    // Expected format: [2025-03-15 21:52:00.000] [info] Message
    const match = line.match(/^\[(.*?)\]\s+\[(.*?)\]\s+(.*)$/)
    if (match && match[1] && match[2] && match[3]) {
      return {
        timestamp: match[1],
        level: match[2].toUpperCase() as any,
        source,
        message: match[3]
      }
    }
    return {
      timestamp: new Date().toISOString(),
      level: 'INFO',
      source,
      message: line
    }
  }
}
