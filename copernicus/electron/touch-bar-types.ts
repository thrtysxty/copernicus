export interface TouchBarCommand {
  target: string   // make target name — must be in ALLOWED list
  label: string    // text shown on button (max ~8 chars)
}

export interface TouchBarConfig {
  enabled: boolean
  commands: [TouchBarCommand, TouchBarCommand, TouchBarCommand]  // exactly 3 slots
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
