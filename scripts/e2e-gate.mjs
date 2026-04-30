#!/usr/bin/env node
/**
 * E2E Gate — automated build + test pipeline for story 674.
 *
 * Usage:  node scripts/e2e-gate.mjs [--skip-build] [--skip-screenshots]
 * Output: docs/reports/e2e_test_run_YYYY-MM-DD.md
 * Exit:   0 = smoke 100% + functional 100%,  1 = any gate failure
 *
 * Run from repo root: node scripts/e2e-gate.mjs
 */

import { execSync, spawnSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const COPER = path.join(ROOT, 'copernicus')
const REPORTS_DIR = path.join(ROOT, 'docs', 'reports')
const SCREENSHOTS_DIR = path.join(ROOT, 'docs', 'help', 'screenshots')
const JSON_OUT = path.join(COPER, 'e2e', '.gate-results.json')

const args = process.argv.slice(2)
const SKIP_BUILD = args.includes('--skip-build')
const SKIP_SCREENSHOTS = args.includes('--skip-screenshots')

const today = new Date().toISOString().slice(0, 10)

// ─── Helpers ────────────────────────────────────────────────────────────────

function run(cmd, opts = {}) {
  return spawnSync(cmd, { shell: true, cwd: COPER, encoding: 'utf8', ...opts })
}

function header(msg) {
  console.log(`\n${'─'.repeat(60)}\n  ${msg}\n${'─'.repeat(60)}`)
}

function parseJsonResults(jsonPath) {
  if (!fs.existsSync(jsonPath)) return null
  try {
    const raw = JSON.parse(fs.readFileSync(jsonPath, 'utf8'))
    const suites = raw.suites ?? []
    const tests = []
    const collectTests = (node) => {
      for (const s of node.suites ?? []) collectTests(s)
      for (const t of node.specs ?? []) {
        const result = t.tests?.[0]?.results?.[0]
        tests.push({
          title: t.title,
          fullTitle: t.fullTitle ?? t.title,
          status: result?.status ?? 'unknown',
          duration: result?.duration ?? 0,
          error: result?.error?.message ?? null,
        })
      }
    }
    suites.forEach(collectTests)
    const passed = tests.filter(t => t.status === 'passed').length
    const failed = tests.filter(t => t.status !== 'passed').length
    return { tests, passed, failed, total: tests.length }
  } catch (e) {
    return null
  }
}

function playwrightRun(project) {
  if (fs.existsSync(JSON_OUT)) fs.rmSync(JSON_OUT)
  const r = run(
    `npx playwright test --project=${project} --reporter=json`,
    { env: { ...process.env, PLAYWRIGHT_JSON_OUTPUT_NAME: JSON_OUT } }
  )
  const results = parseJsonResults(JSON_OUT)
  return { ...results, stdout: r.stdout, stderr: r.stderr, exitCode: r.status }
}

// ─── Step 1: Build ───────────────────────────────────────────────────────────

let buildOk = true
let buildSummary = ''
let mainBundleSize = 'unknown'
let assetsSize = 'unknown'
let buildWarnings = []

if (SKIP_BUILD) {
  header('BUILD — skipped (--skip-build)')
  buildSummary = 'Skipped via --skip-build flag.'
} else {
  header('BUILD — npm run build:app')
  const b = run('npm run build:app', { maxBuffer: 10 * 1024 * 1024 })
  buildOk = b.status === 0

  const output = (b.stdout + b.stderr)
  const warningPatterns = [
    /MODULE_TYPELESS_PACKAGE_JSON/,
    /CJS build of Vite/,
    /dynamic import will not move/,
  ]
  buildWarnings = warningPatterns
    .filter(p => p.test(output))
    .map(p => p.source)

  if (buildOk) {
    // Newest main bundle
    try {
      const distE = path.join(COPER, 'dist-electron')
      const mains = fs.readdirSync(distE)
        .filter(f => /^main-.*\.js$/.test(f))
        .map(f => ({ f, mtime: fs.statSync(path.join(distE, f)).mtimeMs }))
        .sort((a, b) => b.mtime - a.mtime)
      if (mains.length) {
        const stat = fs.statSync(path.join(distE, mains[0].f))
        mainBundleSize = `${(stat.size / 1024 / 1024).toFixed(1)}MB (${mains[0].f})`
      }
    } catch (_) {}

    try {
      const du = run('du -sh dist/assets/')
      assetsSize = du.stdout.trim().split('\t')[0] ?? 'unknown'
    } catch (_) {}
  }

  buildSummary = buildOk ? '✅ Exit 0' : '❌ Non-zero exit'
  console.log(buildOk ? '✅ Build passed' : '❌ Build FAILED')
  if (buildWarnings.length) console.log('⚠️  Warnings:', buildWarnings.join(', '))
}

// ─── Step 2: Smoke ───────────────────────────────────────────────────────────

header('SMOKE SUITE')
const smoke = playwrightRun('smoke')
const smokeOk = smoke && smoke.failed === 0
console.log(`${smokeOk ? '✅' : '❌'} Smoke: ${smoke?.passed ?? 0}/${smoke?.total ?? '?'} passed`)

// ─── Step 3: Functional ──────────────────────────────────────────────────────

header('FUNCTIONAL SUITE')
const functional = playwrightRun('functional')
const functionalOk = functional && functional.failed === 0
console.log(`${functionalOk ? '✅' : '❌'} Functional: ${functional?.passed ?? 0}/${functional?.total ?? '?'} passed`)
if (functional?.tests) {
  for (const t of functional.tests) {
    const icon = t.status === 'passed' ? '  ✓' : '  ✗'
    console.log(`${icon}  ${t.title} (${(t.duration / 1000).toFixed(1)}s)`)
    if (t.error) console.log(`       ${t.error.split('\n')[0]}`)
  }
}

// ─── Step 4: Screenshots ─────────────────────────────────────────────────────

let screenshotResults = null
if (!SKIP_SCREENSHOTS) {
  header('SCREENSHOT SUITE')
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true })
  screenshotResults = playwrightRun('screenshots')
  const ok = screenshotResults && screenshotResults.failed === 0
  console.log(`${ok ? '✅' : '❌'} Screenshots: ${screenshotResults?.passed ?? 0}/${screenshotResults?.total ?? '?'} passed`)
}

const screenshotCount = fs.existsSync(SCREENSHOTS_DIR)
  ? fs.readdirSync(SCREENSHOTS_DIR).filter(f => f.endsWith('.png')).length
  : 0

// ─── Step 5: Gather commit info ──────────────────────────────────────────────

let commitRef = 'unknown'
try {
  commitRef = execSync('git rev-parse --short HEAD', { cwd: ROOT, encoding: 'utf8' }).trim()
} catch (_) {}

// ─── Step 6: Write report ────────────────────────────────────────────────────

header('REPORT')
fs.mkdirSync(REPORTS_DIR, { recursive: true })

const smokeTable = (smoke?.tests ?? [])
  .map(t => `| ${t.title} | ${t.status === 'passed' ? '✅' : '❌'} |`)
  .join('\n')

const funcTable = (functional?.tests ?? [])
  .map(t => {
    const row = `| ${t.title} | ${t.status === 'passed' ? '✅' : '❌'} |`
    return t.error ? row + `\n| ↳ \`${t.error.split('\n')[0].slice(0, 80)}\` | |` : row
  })
  .join('\n')

const screenshotLine = SKIP_SCREENSHOTS
  ? '⏭ Skipped via --skip-screenshots'
  : `${screenshotResults?.failed === 0 ? '✅' : '❌'} ${screenshotResults?.passed ?? 0}/${screenshotResults?.total ?? '?'} passed — ${screenshotCount} PNGs in \`docs/help/screenshots/\``

const gateStatus = buildOk && smokeOk && functionalOk ? '✅ GATE PASSED' : '❌ GATE FAILED'

const report = `# E2E Test Run Report — ${today}

**Gate:** ${gateStatus}
**Branch:** main
**Commit:** ${commitRef}
**Run by:** automated (scripts/e2e-gate.mjs)

---

## Build Gate

| Check | Result |
|-------|--------|
| \`npm run build:app\` exit code | ${buildSummary} |
| Main bundle size | ${mainBundleSize} |
| \`dist/assets/\` total | ${assetsSize} |
| \`MODULE_TYPELESS_PACKAGE_JSON\` warnings | ${buildWarnings.includes('MODULE_TYPELESS_PACKAGE_JSON') ? '❌ Present' : '✅ None'} |
| Vite CJS deprecation warnings | ${buildWarnings.includes('CJS build of Vite') ? '❌ Present' : '✅ None'} |
| Rollup dynamic-import warnings | ${buildWarnings.includes('dynamic import will not move') ? '❌ Present' : '✅ None'} |

---

## Smoke Suite — ${smoke?.passed ?? 0}/${smoke?.total ?? '?'} ${smokeOk ? '✅' : '❌'}

| Test | Result |
|------|--------|
${smokeTable || '| No results | — |'}

---

## Functional Suite — ${functional?.passed ?? 0}/${functional?.total ?? '?'} ${functionalOk ? '✅' : '❌'}

| Test | Result |
|------|--------|
${funcTable || '| No results | — |'}

${functional && functional.failed > 0 ? `### Failures requiring triage\n\n${functional.tests.filter(t => t.status !== 'passed').map(t => `- **${t.title}**: \`${(t.error ?? 'unknown').split('\n')[0].slice(0, 120)}\``).join('\n')}` : ''}

---

## Screenshot Suite

${screenshotLine}

---

## Hub Ledger IPC Verification

Run manually in Electron devtools:
\`\`\`js
window.ipcRenderer.invoke('hub:get-events', { limit: 10, offset: 0 })
window.ipcRenderer.invoke('hub:get-attribution', { limit: 10 })
window.ipcRenderer.invoke('hub:get-cost-summary', {})
\`\`\`

---

## Summary

| Gate | Status |
|------|--------|
| Build | ${buildOk ? '✅ Clean' : '❌ Failed'} |
| Smoke | ${smokeOk ? `✅ ${smoke?.passed}/${smoke?.total}` : `❌ ${smoke?.passed}/${smoke?.total}`} |
| Functional | ${functionalOk ? `✅ ${functional?.passed}/${functional?.total}` : `⚠️ ${functional?.passed}/${functional?.total}`} |
| Screenshots | ${SKIP_SCREENSHOTS ? '⏭ Skipped' : (screenshotResults?.failed === 0 ? `✅ ${screenshotResults?.passed}/${screenshotResults?.total}` : `❌ ${screenshotResults?.passed}/${screenshotResults?.total}`)} |
`

const reportPath = path.join(REPORTS_DIR, `e2e_test_run_${today}.md`)
fs.writeFileSync(reportPath, report)
console.log(`\n📄 Report written: ${reportPath}`)

// Cleanup temp JSON
if (fs.existsSync(JSON_OUT)) fs.rmSync(JSON_OUT)

// ─── Exit ────────────────────────────────────────────────────────────────────

const gatePass = buildOk && smokeOk && functionalOk
header(gatePass ? '✅  GATE PASSED' : '❌  GATE FAILED')
process.exit(gatePass ? 0 : 1)
