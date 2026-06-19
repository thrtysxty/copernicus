export type StoryboardView = 'planner' | 'designer' | 'editor' | 'reporter' | 'orchestrator' | 'command-center' | 'memory' | 'github' | 'review' | 'git' | 'search' | 'diagnostics' | 'logs' | 'replay' | 'test-explorer' | 'debug' | 'knowledge-base' | 'browser' | 'database' | 'hub:org-chart' | 'hub:contract-proposals' | 'extensions' | 'intelligence'
export type PaneId = 'explorer' | 'editor' | 'inspector' | 'chat' | 'kanban' | 'orchestrator' | 'terminal'

export interface ReviewSession {
  sessionId: string
  stories: number[]
  changedFiles: string[]
  exitCode: number
}

export interface KanbanColumn {
  id: string
  status: string
  label: string
  color: string
  accent: string
  minimized?: number
}

export const PHOSPHOR_PRESETS = {
  green: { label: 'Green', hex: '#4ADE80', rgb: '74 222 128' },
  amber: { label: 'Amber', hex: '#FBBF24', rgb: '251 191 36' },
  white: { label: 'White', hex: '#F4F4F5', rgb: '244 244 245' },
  blue:  { label: 'Blue',  hex: '#60A5FA', rgb: '96 165 250' },
} as const

export type PhosphorColor = keyof typeof PHOSPHOR_PRESETS

export type CenterMode = 'code' | 'image' | 'binary' | 'preview' | 'builder' | 'canvas'

export interface TerminalSession {
  id: string
  label: string
  isBusy: boolean
  ephemeral?: boolean
  cwd?: string
}
