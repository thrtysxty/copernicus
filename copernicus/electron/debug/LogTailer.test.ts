import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { LogTailer } from './LogTailer'

describe('LogTailer', () => {
  let logTailer: LogTailer
  const testLogDir = path.join(os.tmpdir(), 'copernicus-logs-test-' + Date.now())

  beforeEach(() => {
    if (!fs.existsSync(testLogDir)) {
      fs.mkdirSync(testLogDir, { recursive: true })
    }
    // Create initial log files
    fs.writeFileSync(path.join(testLogDir, 'copernicus.log'), '[2025-03-15 10:00:00.000] [INFO] Main process started\n')
    fs.writeFileSync(path.join(testLogDir, 'language-server.log'), '[2025-03-15 10:00:01.000] [DEBUG] LSP initialized\n')
    fs.writeFileSync(path.join(testLogDir, 'backend.log'), '[2025-03-15 10:00:02.000] [WARN] Low memory\n')

    logTailer = new LogTailer(testLogDir)
  })

  afterEach(() => {
    logTailer.stopTailing()
    fs.rmSync(testLogDir, { recursive: true, force: true })
  })

  it('should list available log sources', () => {
    const sources = logTailer.listSources()
    expect(sources).toContain('copernicus')
    expect(sources).toContain('language-server')
    expect(sources).toContain('backend')
  })

  it('should return log history sorted by timestamp descending', () => {
    const history = logTailer.getHistory(10)
    expect(history.length).toBe(3)
    // Descending order: backend (10:00:02) -> language-server (10:00:01) -> copernicus (10:00:00)
    expect(history[0]!.source).toBe('backend')
    expect(history[1]!.source).toBe('language-server')
    expect(history[2]!.source).toBe('copernicus')
    expect(history[0]!.id).toBeDefined()
  })

  it('should tail log files and notify callback', async () => {
    const onLine = vi.fn()
    await logTailer.startTailing(onLine)

    // Append to a log file — watchers are ready, no race
    const newLine = '[2025-03-15 10:00:03.000] [ERROR] Critical failure\n'
    fs.appendFileSync(path.join(testLogDir, 'copernicus.log'), newLine)

    // Wait for watcher to trigger
    await new Promise(resolve => setTimeout(resolve, 500))

    expect(onLine).toHaveBeenCalled()
    const calledEntry = onLine.mock.calls[0][0]
    expect(calledEntry.source).toBe('copernicus')
    expect(calledEntry.level).toBe('ERROR')
    expect(calledEntry.message).toBe('Critical failure')
  })
})
