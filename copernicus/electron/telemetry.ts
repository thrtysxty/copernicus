import { config } from './config'
import { spawn, ChildProcess } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import log from 'electron-log'
import { fsManager } from './fs-manager'

export let collectorProcess: ChildProcess | null = null

export function updateClaudeTelemetrySettings(write: boolean): boolean {
  try {
    const rootPath = fsManager.getRootPath()
    if (!rootPath) return false

    const settingsPath = path.join(rootPath, '.claude', 'settings.json')
    if (!write && !fs.existsSync(settingsPath)) return false

    if (write) {
      if (!fs.existsSync(path.dirname(settingsPath))) {
        fs.mkdirSync(path.dirname(settingsPath), { recursive: true })
      }
    }

    let content = ''
    if (fs.existsSync(settingsPath)) {
      content = fs.readFileSync(settingsPath, 'utf-8')
    }

    const startMarker = '// --- Copernicus Managed: OTel ---'
    const endMarker = '// --- End Copernicus Managed: OTel ---'
    const regex = new RegExp(startMarker + '[\\s\\S]*?' + endMarker + '\\n?', 'g')
    content = content.replace(regex, '').trim()

    if (write) {
      const managedBlock = [
        startMarker,
        'CLAUDE_CODE_ENABLE_TELEMETRY=1',
        'OTEL_METRICS_EXPORTER=otlp',
        'OTEL_LOGS_EXPORTER=otlp',
        `OTEL_EXPORTER_OTLP_ENDPOINT=${config.otel.endpoint}`,
        'OTEL_EXPORTER_OTLP_METRICS_TEMPORALITY_PREFERENCE=cumulative',
        'OTEL_LOG_TOOL_DETAILS=1',
        endMarker
      ].join('\n')

      content = content.length > 0 ? content + '\n\n' + managedBlock + '\n' : managedBlock + '\n'
    } else {
      content = content.length > 0 ? content + '\n' : content
    }

    fs.writeFileSync(settingsPath, content, 'utf-8')
    return true
  } catch (err) {
    log.error('[Main] Failed to update Claude telemetry settings:', err)
    return false
  }
}

export function startCollector(dbPath: string, collectorScript: string): void {
  if (fs.existsSync(collectorScript)) {
    log.info('[Main] Spawning OTel collector sidecar...')
    try {
      collectorProcess = spawn('python3', [collectorScript], {
        env: { ...process.env, COPERNICUS_DB_PATH: dbPath },
        stdio: 'ignore'
      })

      log.info(`[Main] OTel collector spawned with PID: ${collectorProcess.pid}`)
      updateClaudeTelemetrySettings(true)

      collectorProcess.on('error', (err) => {
        log.warn(`[Main] Failed to start OTel collector: ${err.message}`)
        updateClaudeTelemetrySettings(false)
      })

      collectorProcess.on('exit', (code) => {
        if (code !== 0 && code !== null) {
          log.warn(`[Main] OTel collector exited with non-zero code: ${code}`)
        } else {
          log.info(`[Main] OTel collector exited gracefully`)
        }
        collectorProcess = null
        updateClaudeTelemetrySettings(false)
      })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      log.warn(`[Main] Failed to spawn OTel collector: ${msg}`)
      updateClaudeTelemetrySettings(false)
    }
  } else {
    log.warn('[Main] OTel collector script not found at:', collectorScript)
  }
}

export function killCollector(): void {
  if (collectorProcess && !collectorProcess.killed) {
    log.info('[Main] Killing OTel collector process')
    collectorProcess.kill()
  }
}
