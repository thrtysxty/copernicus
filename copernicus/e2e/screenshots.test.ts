/**
 * Screenshot generation for the User Guide.
 *
 * Output: docs/help/screenshots/*.png
 *
 * Run with:   npm run docs:screenshots
 * Prerequisite: npm run build:app
 *
 * Each test captures one screen state. Tests are tagged @screenshot so they
 * can be run independently of the smoke suite.
 */
import fs from 'fs'
import { test, expect, setView, screenshotPath } from './fixture'

// Allow enough settle time after navigation for animations to complete
const SETTLE = 800

// Re-entrance guard — skip captures that already exist unless --force
const FORCE = process.argv.includes('--force')
function shouldCapture(name: string): boolean {
  if (FORCE) return true
  return !fs.existsSync(screenshotPath(name))
}

// ─── Wizard flow ────────────────────────────────────────────────────────────

test.describe('Wizard', () => {
  // Override fixture: do NOT skip wizard for these tests
  test.use({ skipWizard: false })

  test('wizard-welcome @screenshot', async ({ window }) => {
    // Wizard renders immediately on first run
    await window.waitForTimeout(SETTLE)
    await window.screenshot({ path: screenshotPath('wizard-welcome'), fullPage: false })
  })
})

// ─── Main IDE views ──────────────────────────────────────────────────────────

test.describe('Main IDE', () => {
  // skipWizard: true is the default

  test('main-layout @screenshot', async ({ app, window }) => {
    await setView(app, 'blueprint')
    await window.waitForTimeout(SETTLE)
    await window.screenshot({ path: screenshotPath('main-layout'), fullPage: false })
  })

  test('kanban-board @screenshot', async ({ app, window }) => {
    await setView(app, 'blueprint')
    await window.waitForTimeout(SETTLE)
    // Click the blueprint / kanban nav if needed — it's the default view
    await window.screenshot({ path: screenshotPath('kanban-board'), fullPage: false })
  })

  test('studio-view @screenshot', async ({ app, window }) => {
    await setView(app, 'studio')
    await window.waitForTimeout(SETTLE)
    await window.screenshot({ path: screenshotPath('studio-view'), fullPage: false })
  })

  test('engine-room @screenshot', async ({ app, window }) => {
    await setView(app, 'engine-room')
    await window.waitForTimeout(SETTLE)
    await window.screenshot({ path: screenshotPath('engine-room'), fullPage: false })
  })

  test('workflow-canvas @screenshot', async ({ app, window }) => {
    await setView(app, 'workflow')
    await window.waitForTimeout(SETTLE)
    await window.screenshot({ path: screenshotPath('workflow-canvas'), fullPage: false })
  })

  test('capex-dashboard @screenshot', async ({ app, window }) => {
    await setView(app, 'capex')
    await window.waitForTimeout(SETTLE)
    await window.screenshot({ path: screenshotPath('capex-dashboard'), fullPage: false })
  })
})

// ─── Overlays ────────────────────────────────────────────────────────────────

test.describe('Overlays', () => {
  test('command-palette @screenshot', async ({ app, window }) => {
    await setView(app, 'blueprint')
    await window.waitForTimeout(300)
    // Open command palette via IPC (same as Cmd+K shortcut)
    await app.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows()[0]?.webContents.send('layout:open-palette')
    })
    await window.waitForTimeout(SETTLE)
    await window.screenshot({ path: screenshotPath('command-palette'), fullPage: false })
    // Dismiss
    await window.keyboard.press('Escape')
  })

  test('settings-panel @screenshot', async ({ window }) => {
    // Settings is opened by clicking the gear icon in the status bar or activity bar.
    // Use keyboard shortcut Cmd+, which should trigger settings open.
    // Alternatively click via selector — look for settings gear button.
    const settingsBtn = window.locator('[title*="Settings"], [aria-label*="Settings"]').first()
    if (await settingsBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await settingsBtn.click()
    } else {
      await window.keyboard.press('Meta+,')
    }
    await window.waitForTimeout(SETTLE)
    await window.screenshot({ path: screenshotPath('settings-panel'), fullPage: false })
    await window.keyboard.press('Escape')
  })

  test('spotlight-search @screenshot', async ({ app, window }) => {
    await app.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows()[0]?.webContents.send('layout:toggle-spotlight')
    })
    await window.waitForTimeout(SETTLE)
    await window.screenshot({ path: screenshotPath('spotlight-search'), fullPage: false })
    await app.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows()[0]?.webContents.send('layout:toggle-spotlight')
    })
  })
})

// ─── Story 530 — User Guide Screenshots ──────────────────────────────────────

test.describe('Story530 Kanban', () => {
  test('kanban-overview @screenshot', async ({ app, window }) => {
    if (!shouldCapture('kanban-overview')) return
    await setView(app, 'blueprint')
    await window.waitForSelector('[data-testid="column-planning"]', { timeout: 10_000 }).catch(() => null)
    await window.waitForTimeout(SETTLE)
    await window.screenshot({ path: screenshotPath('kanban-overview'), fullPage: false })
  })

  test('kanban-story-card @screenshot', async ({ app, window }) => {
    if (!shouldCapture('kanban-story-card')) return
    await setView(app, 'blueprint')
    await window.waitForSelector('[data-testid="story-card"], .story-card, [class*="StoryCard"]', { timeout: 10_000 }).catch(() => null)
    await window.waitForTimeout(SETTLE)
    await window.screenshot({ path: screenshotPath('kanban-story-card'), fullPage: false })
  })
})

test.describe('Story530 Studio', () => {
  test('chat-active @screenshot', async ({ app, window }) => {
    if (!shouldCapture('chat-active')) return
    await setView(app, 'studio')
    await window.waitForTimeout(SETTLE)
    await window.screenshot({ path: screenshotPath('chat-active'), fullPage: false })
  })

  test('chat-model-picker @screenshot', async ({ app, window }) => {
    if (!shouldCapture('chat-model-picker')) return
    await setView(app, 'studio')
    await window.waitForTimeout(SETTLE)
    const picker = window.locator('[data-testid="model-picker"], [class*="ModelPicker"], [aria-label*="model"]').first()
    if (await picker.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await picker.click()
      await window.waitForTimeout(400)
    }
    await window.screenshot({ path: screenshotPath('chat-model-picker'), fullPage: false })
  })

  test('editor-with-lsp @screenshot', async ({ app, window }) => {
    if (!shouldCapture('editor-with-lsp')) return
    await setView(app, 'studio')
    await window.waitForSelector('.monaco-editor', { timeout: 10_000 }).catch(() => null)
    await window.waitForTimeout(SETTLE)
    await window.screenshot({ path: screenshotPath('editor-with-lsp'), fullPage: false })
  })

  test('editor-file-tree @screenshot', async ({ app, window }) => {
    if (!shouldCapture('editor-file-tree')) return
    await setView(app, 'studio')
    await window.waitForTimeout(SETTLE)
    await window.screenshot({ path: screenshotPath('editor-file-tree'), fullPage: false })
  })

  test('review-panel-diff @screenshot', async ({ app, window }) => {
    if (!shouldCapture('review-panel-diff')) return
    await setView(app, 'studio')
    await window.waitForTimeout(SETTLE)
    await window.screenshot({ path: screenshotPath('review-panel-diff'), fullPage: false })
  })

  test('review-panel-tsc @screenshot', async ({ app, window }) => {
    if (!shouldCapture('review-panel-tsc')) return
    await setView(app, 'studio')
    await window.waitForTimeout(SETTLE)
    await window.screenshot({ path: screenshotPath('review-panel-tsc'), fullPage: false })
  })
})

test.describe('Story530 Workflow', () => {
  test('workflow-canvas @screenshot', async ({ app, window }) => {
    if (!shouldCapture('workflow-canvas')) return
    await setView(app, 'workflow')
    await window.waitForSelector('[data-testid="workflow-canvas"], svg', { timeout: 10_000 }).catch(() => null)
    await window.waitForTimeout(SETTLE)
    await window.screenshot({ path: screenshotPath('workflow-canvas'), fullPage: false })
  })

  test('workflow-node-inspector @screenshot', async ({ app, window }) => {
    if (!shouldCapture('workflow-node-inspector')) return
    await setView(app, 'workflow')
    await window.waitForTimeout(SETTLE)
    const node = window.locator('[data-testid="workflow-node"], [class*="WorkflowNode"]').first()
    if (await node.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await node.click()
      await window.waitForTimeout(400)
    }
    await window.screenshot({ path: screenshotPath('workflow-node-inspector'), fullPage: false })
  })

  test('workflow-templates @screenshot', async ({ app, window }) => {
    if (!shouldCapture('workflow-templates')) return
    await setView(app, 'workflow')
    await window.waitForTimeout(SETTLE)
    const templateBtn = window.locator('[data-testid="workflow-templates"], [aria-label*="template"], [title*="template"]').first()
    if (await templateBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await templateBtn.click()
      await window.waitForTimeout(400)
    }
    await window.screenshot({ path: screenshotPath('workflow-templates'), fullPage: false })
  })
})

test.describe('Story530 Capex', () => {
  test('capex-financial @screenshot', async ({ app, window }) => {
    if (!shouldCapture('capex-financial')) return
    await setView(app, 'capex')
    await window.waitForTimeout(SETTLE)
    await window.screenshot({ path: screenshotPath('capex-financial'), fullPage: false })
  })

  test('capex-heatmap @screenshot', async ({ app, window }) => {
    if (!shouldCapture('capex-heatmap')) return
    await setView(app, 'capex')
    await window.waitForTimeout(SETTLE)
    const heatmapTab = window.locator('[data-testid="tab-heatmap"], [aria-label*="heatmap"], button:has-text("Heatmap")').first()
    if (await heatmapTab.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await heatmapTab.click()
      await window.waitForTimeout(400)
    }
    await window.screenshot({ path: screenshotPath('capex-heatmap'), fullPage: false })
  })
})

test.describe('Story530 Settings', () => {
  test('settings-providers @screenshot', async ({ app, window }) => {
    if (!shouldCapture('settings-providers')) return
    await setView(app, 'engine-room')
    await window.waitForTimeout(SETTLE)
    const tab = window.locator('[data-testid="tab-providers"], button:has-text("Providers")').first()
    if (await tab.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await tab.click()
      await window.waitForTimeout(400)
    }
    await window.screenshot({ path: screenshotPath('settings-providers'), fullPage: false })
  })

  test('settings-mcp @screenshot', async ({ app, window }) => {
    if (!shouldCapture('settings-mcp')) return
    await setView(app, 'engine-room')
    await window.waitForTimeout(SETTLE)
    const tab = window.locator('[data-testid="tab-mcp"], button:has-text("MCP")').first()
    if (await tab.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await tab.click()
      await window.waitForTimeout(400)
    }
    await window.screenshot({ path: screenshotPath('settings-mcp'), fullPage: false })
  })
})

test.describe('Story530 Overlays', () => {
  test('command-palette @screenshot', async ({ app, window }) => {
    if (!shouldCapture('command-palette')) return
    await setView(app, 'blueprint')
    await window.waitForTimeout(300)
    await app.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows()[0]?.webContents.send('layout:open-palette')
    })
    await window.waitForTimeout(SETTLE)
    await window.screenshot({ path: screenshotPath('command-palette'), fullPage: false })
    await window.keyboard.press('Escape')
  })

  test('spotlight-collapsed @screenshot', async ({ app, window }) => {
    if (!shouldCapture('spotlight-collapsed')) return
    await setView(app, 'blueprint')
    await window.waitForTimeout(SETTLE)
    await window.screenshot({ path: screenshotPath('spotlight-collapsed'), fullPage: false })
  })

  test('activity-bar @screenshot', async ({ app, window }) => {
    if (!shouldCapture('activity-bar')) return
    await setView(app, 'blueprint')
    await window.waitForTimeout(SETTLE)
    const activityBar = window.locator('[data-testid="activity-bar"], [class*="ActivityBar"], nav').first()
    const box = await activityBar.boundingBox().catch(() => null)
    if (box) {
      await window.screenshot({ path: screenshotPath('activity-bar'), clip: box, fullPage: false })
    } else {
      await window.screenshot({ path: screenshotPath('activity-bar'), fullPage: false })
    }
  })
})

// ─── Missing views ───────────────────────────────────────────────────────────

test.describe('Missing Views', () => {
  test('designer-canvas @screenshot', async ({ app, window }) => {
    if (!shouldCapture('designer-canvas')) return
    // Click the Designer nav button directly — it sets view + centerMode + unflips
    await window.locator('[data-testid="nav-designer"]').click()
    await window.waitForTimeout(SETTLE)
    await window.screenshot({ path: screenshotPath('designer-canvas'), fullPage: false })
  })

  test('memory-replay @screenshot', async ({ app, window }) => {
    if (!shouldCapture('memory-replay')) return
    await setView(app, 'memory')
    await window.waitForTimeout(SETTLE)
    await window.screenshot({ path: screenshotPath('memory-replay'), fullPage: false })
  })

  test('source-control @screenshot', async ({ app, window }) => {
    if (!shouldCapture('source-control')) return
    await setView(app, 'git')
    await window.waitForTimeout(SETTLE)
    await window.screenshot({ path: screenshotPath('source-control'), fullPage: false })
  })

  test('debug-panel @screenshot', async ({ app, window }) => {
    if (!shouldCapture('debug-panel')) return
    await setView(app, 'debug')
    await window.waitForTimeout(SETTLE)
    await window.screenshot({ path: screenshotPath('debug-panel'), fullPage: false })
  })

  test('intel-overlay @screenshot', async ({ app, window }) => {
    if (!shouldCapture('intel-overlay')) return
    await setView(app, 'blueprint')
    await window.waitForTimeout(300)
    await window.locator('button:has-text("INTEL")').click()
    await window.waitForTimeout(SETTLE)
    await window.screenshot({ path: screenshotPath('intel-overlay'), fullPage: false })
  })
})

// ─── Status Bar ──────────────────────────────────────────────────────────────

test.describe('Status Bar', () => {
  test('status-bar-detail @screenshot', async ({ app, window }) => {
    await setView(app, 'blueprint')
    await window.waitForTimeout(SETTLE)
    // Crop to bottom strip
    const rootBox = await window.locator('#root').boundingBox()
    if (rootBox) {
      await window.screenshot({
        path: screenshotPath('status-bar'),
        clip: {
          x: rootBox.x,
          y: rootBox.y + rootBox.height - 30,
          width: rootBox.width,
          height: 30,
        },
      })
    }
  })
})
