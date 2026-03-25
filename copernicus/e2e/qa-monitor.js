/**
 * QA Monitor — live interactive session
 *
 * Launches Copernicus headed with a FRESH user profile (real wizard, no seeded creds).
 * Captures all console events, page errors, and IPC failures to a live log.
 *
 * Usage:  node e2e/qa-monitor.js
 * Log:    tail -f /tmp/copernicus-qa.log
 */

const { _electron: electron } = require('@playwright/test')
const path = require('path')
const fs = require('fs')
const os = require('os')

const LOG = '/tmp/copernicus-qa.log'
const APP_MAIN = path.join(__dirname, '../dist-electron/main.js')

function log(tag, msg) {
  const line = `[${new Date().toISOString()}] [${tag}] ${msg}\n`
  fs.appendFileSync(LOG, line)
  process.stdout.write(line)
}

async function main() {
  fs.writeFileSync(LOG, `${'='.repeat(72)}\nQA SESSION ${new Date().toISOString()}\n${'='.repeat(72)}\n`)

  if (!fs.existsSync(APP_MAIN)) {
    log('FATAL', `Built app not found: ${APP_MAIN} — run npm run build:app first`)
    process.exit(1)
  }

  // Fresh home — real first-run wizard, no pre-seeded credentials
  const qaHome = path.join(os.tmpdir(), 'copernicus-qa-live')
  fs.rmSync(qaHome, { recursive: true, force: true })
  fs.mkdirSync(qaHome, { recursive: true })
  log('INFO', `Fresh user profile: ${qaHome}`)

  log('INFO', 'Launching Copernicus...')

  const app = await electron.launch({
    args: [APP_MAIN, `--user-data-dir=${qaHome}`],
    env: {
      ...process.env,
      NODE_ENV: 'test',
      ELECTRON_NO_UPDATER: '1',
    },
  })

  // ── Main process stdout/stderr (catches IPC handlers, auth calls, backend) ──
  // Suppress known high-frequency noise that would flood the log
  const NOISE = [
    'SocketManager',
    'xhr poll error',
    'ipc:github:test-connection',
  ]
  const proc = app.process()
  proc.stdout?.on('data', d => {
    const s = d.toString().trim()
    if (s && !NOISE.some(n => s.includes(n))) log('MAIN:OUT', s)
  })
  proc.stderr?.on('data', d => {
    const s = d.toString().trim()
    if (s && !NOISE.some(n => s.includes(n))) log('MAIN:ERR', s)
  })

  const win = await app.firstWindow()

  // ── Console output ──────────────────────────────────────────────────────────
  win.on('console', msg => {
    const type = msg.type()
    const text = msg.text()
    // Surface errors and warnings prominently, log everything else quietly
    if (type === 'error') {
      log('CONSOLE:ERROR', text)
      // Capture associated args for stack traces
      msg.args().forEach((arg, i) => {
        arg.jsonValue().then(v => {
          if (v && typeof v === 'string' && v.includes('\n')) {
            log('CONSOLE:TRACE', v.split('\n').slice(0, 6).join(' | '))
          }
        }).catch(() => {})
      })
    } else if (type === 'warning') {
      log('CONSOLE:WARN', text)
    } else {
      log(`CONSOLE:${type.toUpperCase()}`, text)
    }
  })

  // ── Uncaught page errors ────────────────────────────────────────────────────
  win.on('pageerror', err => {
    log('PAGE_ERROR', err.message)
    if (err.stack) {
      err.stack.split('\n').slice(0, 8).forEach(line => log('STACK', line.trim()))
    }
  })

  // ── Request failures (IPC over fetch, if any) ───────────────────────────────
  win.on('requestfailed', req => {
    log('REQ_FAIL', `${req.method()} ${req.url()} — ${req.failure()?.errorText}`)
  })

  await win.waitForSelector('#root', { timeout: 15_000 })
  log('INFO', '─── App loaded. You are live. Navigate freely. ───')
  log('INFO', 'Ctrl+C here to end the session.')

  // Keep alive until killed
  process.on('SIGINT', async () => {
    log('INFO', 'Session ended by user.')
    await app.close()
    process.exit(0)
  })

  // Log if app exits unexpectedly
  app.on('close', () => {
    log('INFO', 'App window closed.')
  })

  await app.waitForEvent('close', { timeout: 0 }).catch(() => {})
  log('INFO', '─── Session complete. ───')
}

main().catch(err => {
  log('FATAL', err.message)
  process.exit(1)
})
