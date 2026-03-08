import { TouchBar, ipcMain, BrowserWindow } from 'electron'
import log from 'electron-log'
import { TouchBarConfig, DEFAULT_TOUCH_BAR_CONFIG } from './touch-bar-types'
import { ptyManager } from './pty-manager'
import { fsManager } from './fs-manager'

const {
  TouchBarButton, TouchBarLabel, TouchBarSpacer
} = TouchBar

// ALLOWED make targets (mirrors makefile:run handler)
const ALLOWED = new Set(['dev','test','build','lint','backlog','deploy','commit','agent','dashboard'])

export function createTouchBar(window: BrowserWindow, config: TouchBarConfig = DEFAULT_TOUCH_BAR_CONFIG) {

  // ── 1. Storyboard Segment ──────────────────────────────────────────────────
  // All 5 views; active view gets phosphor background
  const VIEWS = [
    { label: 'PLANNER',  id: 'planner'  },
    { label: 'EDITOR',   id: 'editor'   },
    { label: 'DESIGNER', id: 'designer' },
    { label: 'ORCHESTRATOR', id: 'orchestrator' },
    { label: 'REPORTER',     id: 'reporter'     },
  ] as const

  const viewBtns = VIEWS.map(v =>
    new TouchBarButton({
      label: v.label,
      backgroundColor: '#050505',
      click: () => window.webContents.send('layout:set-view', v.id),
    })
  )

  // ── 2. Command Tray ────────────────────────────────────────────────────────
  const commandBtns = config.commands.map(cmd =>
    new TouchBarButton({
      label: cmd.label,
      backgroundColor: '#3F3F46',
      click: () => runMakeTarget(cmd.target, window),
    })
  )

  // ── 3. Telemetry Labels ────────────────────────────────────────────────────
  const primaryLabel = new TouchBarLabel({ label: 'STORY: NONE', textColor: '#4ADE80' })
  const secondaryLabel = new TouchBarLabel({ label: '00:00:00',   textColor: '#4ADE80' })

  // ── 4. Instrument Toggles ──────────────────────────────────────────────────
  const flipBtn = new TouchBarButton({
    label: 'FLIP',
    click: () => window.webContents.send('layout:toggle-flip'),
  })
  const spotBtn = new TouchBarButton({
    label: 'SPOT',
    click: () => window.webContents.send('layout:toggle-spotlight'),
  })
  const uiBuilderBtn = new TouchBarButton({
    label: 'UI BUILD',
    click: () => window.webContents.send('layout:toggle-ui-builder'),
  })

  const touchBar = new TouchBar({
    items: [
      ...viewBtns,
      new TouchBarSpacer({ size: 'small' }),
      ...commandBtns,
      new TouchBarSpacer({ size: 'large' }),
      primaryLabel,
      new TouchBarSpacer({ size: 'small' }),
      secondaryLabel,
      new TouchBarSpacer({ size: 'large' }),
      flipBtn,
      spotBtn,
      uiBuilderBtn,
    ],
  })

  window.setTouchBar(touchBar)

  // ── Telemetry update handler ───────────────────────────────────────────────
  const onTelemetry = (_: any, data: {
    storyId?: string | null
    timer?: string
    view?: string
    gitBranch?: string
    capexTotal?: number
  }) => {
    // Active view highlighting
    VIEWS.forEach((v, i) => {
      const btn = viewBtns[i]
      if (btn) {
        btn.backgroundColor = v.id === data.view ? '#4ADE80' : '#050505'
      }
    })

    // Telemetry labels — mode-aware
    if (config.telemetryMode === 'story-timer') {
      primaryLabel.label   = `STORY: ${data.storyId ?? 'NONE'}`
      secondaryLabel.label = data.timer ?? '00:00:00'
    } else {
      primaryLabel.label   = data.gitBranch ? `⎇ ${data.gitBranch}` : '⎇ —'
      secondaryLabel.label = data.capexTotal != null ? `$${data.capexTotal.toFixed(4)}` : '$0.0000'
    }
  }

  ipcMain.on('telemetry:update-touchbar', onTelemetry)

  // Return cleanup + rebuild API
  return {
    remove: () => {
      ipcMain.removeListener('telemetry:update-touchbar', onTelemetry)
      if (window && !window.isDestroyed()) {
        window.setTouchBar(null as any)
      }
    },
  }
}

function runMakeTarget(target: string, window: BrowserWindow) {
  if (!ALLOWED.has(target)) {
    log.warn(`[touch-bar] blocked disallowed target: ${target}`)
    return
  }

  // Spawn as an ephemeral terminal tab — output routes to a real pane
  const tabId   = `touchbar-${target}-${Date.now()}`
  const tabLabel = target.toUpperCase()
  window.webContents.send('terminal:spawn', { id: tabId, label: tabLabel, ephemeral: true })

  ptyManager.createEphemeral(tabId, `make ${target}`, fsManager.getRootPath(), window)
}
