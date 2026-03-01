// Mirror of copernicus/electron/touch-bar-types.ts — renderer-safe (no Node imports)
export interface TouchBarCommand {
  target: string
  label: string
}

export interface TouchBarConfig {
  enabled: boolean
  commands: [TouchBarCommand, TouchBarCommand, TouchBarCommand]
  telemetryMode: 'story-timer' | 'branch-cost'
}

export const DEFAULT_TOUCH_BAR_CONFIG: TouchBarConfig = {
  enabled: true,
  commands: [
    { target: 'build', label: 'BUILD' },
    { target: 'test',  label: 'TEST'  },
    { target: 'lint',  label: 'LINT'  },
  ],
  telemetryMode: 'story-timer',
}
