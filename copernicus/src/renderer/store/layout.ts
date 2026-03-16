import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { UIComponent } from '../components/Editor/ui-builder/types'

export type StoryboardView = 'planner' | 'designer' | 'editor' | 'reporter' | 'orchestrator' | 'command-center' | 'memory' | 'github' | 'review' | 'git' | 'search' | 'diagnostics' | 'logs' | 'replay'
export type PaneId = 'explorer' | 'editor' | 'inspector' | 'chat' | 'kanban' | 'orchestrator' | 'terminal'

export interface ReviewSession {
  sessionId: string
  stories: number[]
  changedFiles: string[]
  exitCode: number
}

export const DEFAULT_COLUMNS: KanbanColumn[] = [
  { id: 'planning',       status: 'PLANNING',       label: 'Planning',        color: 'bg-slate-500/10 border-slate-500/30',   accent: 'bg-slate-500' },
  { id: 'storyboarding',  status: 'STORYBOARDING',  label: 'Storyboarding',   color: 'bg-purple-500/10 border-purple-500/30', accent: 'bg-purple-500' },
  { id: 'sprint-planning',status: 'SPRINT_PLANNING', label: 'Sprint Planning', color: 'bg-indigo-500/10 border-indigo-500/30', accent: 'bg-indigo-500' },
  { id: 'development',    status: 'IN_PROGRESS',     label: 'Development',     color: 'bg-yellow-500/10 border-yellow-500/30', accent: 'bg-yellow-500' },
  { id: 'testing',        status: 'TESTING',         label: 'Testing',         color: 'bg-orange-500/10 border-orange-500/30', accent: 'bg-orange-500' },
  { id: 'qa',             status: 'QA',              label: 'QA',              color: 'bg-amber-500/10 border-amber-500/30',   accent: 'bg-amber-500' },
  { id: 'documenting',    status: 'DOCUMENTING',     label: 'Documenting',     color: 'bg-cyan-500/10 border-cyan-500/30',     accent: 'bg-cyan-500' },
  { id: 'ready-to-build', status: 'READY',           label: 'Ready to Build',  color: 'bg-teal-500/10 border-teal-500/30',     accent: 'bg-teal-500' },
  { id: 'done',           status: 'COMPLETE',        label: 'Done',            color: 'bg-green-500/10 border-green-500/30',   accent: 'bg-green-500' },
]

export const PHOSPHOR_PRESETS = {
  green: { label: 'Green', hex: '#4ADE80', rgb: '74 222 128' },
  amber: { label: 'Amber', hex: '#FBBF24', rgb: '251 191 36' },
  white: { label: 'White', hex: '#F4F4F5', rgb: '244 244 245' },
  blue:  { label: 'Blue',  hex: '#60A5FA', rgb: '96 165 250' },
} as const

export type PhosphorColor = keyof typeof PHOSPHOR_PRESETS

export type CenterMode = 'code' | 'image' | 'binary' | 'preview' | 'builder' | 'canvas'

export interface KanbanColumn {
  id: string
  status: string
  label: string
  color: string
  accent: string
}

interface AgentTelemetry {
  tokensIn: number
  tokensOut: number
  limit: number
  cost: number
}

export interface TerminalSession {
  id: string
  label: string
  isBusy: boolean
  ephemeral?: boolean
  cwd?: string
}

interface LayoutState {
  searchDrawerOpen: boolean
  setSearchDrawerOpen: (v: boolean) => void

  activeView: StoryboardView
  isFlipped: Record<string, boolean>
  spotlightPane: PaneId | null
  spotlightLane: string | null
  collapsedPanes: PaneId[]
  activeStoryId: string | null
  drawerStoryId: string | null
  phosphorColor: PhosphorColor
  reviewEnabled: boolean
  columns: KanbanColumn[]
  activeWorkflowTemplate: string | null
  centerMode: CenterMode
  activeFilePath: string | null
  activeFileContent: string
  activeFileLanguage: string
  openFiles: { path: string; isDirty: boolean }[]

  // Appearance
  uiDensity: 'compact' | 'normal' | 'comfortable'
  fontSize: number
  animationsEnabled: boolean
  crtMode: boolean

  // Sidebar
  sidebarOpen: boolean

  // Terminal State
  terminalOpen: boolean
  activeTerminalId: string
  terminals: TerminalSession[]

  // Canvas State
  canvasContent: string | null
  canvasUrl: string | null

  // Tour State
  hasCompletedTour: boolean
  tourHighlight: string | null
  tourStep: number
  tourActive: boolean

  // UI Builder State
  uiBuilderOpen: boolean
  uiTestingDrawerOpen: boolean
  paletteOpen: boolean
  inspectorOpen: boolean
  uiComponents: UIComponent[]

  // Browser Session
  browserSessionActive: boolean

  // Panel Modes
  leftPanelMode: 'explorer' | 'command-deck'
  rightPanelMode: 'telemetry' | 'kanban'
  flippedPanes: string[]
  chatPanelTab: 'chat' | 'guide'
  chatPanelOpen: boolean

  // Telemetry
  workingDir: string
  gitBranch: string
  isGitDirty: boolean
  capexTotal: number
  capexSessionTime: number
  capexTimer: string
  agentTelemetry: Record<string, AgentTelemetry>

  // Actions
  setView: (view: StoryboardView) => void
  toggleFlip: (paneId: string) => void
  setSpotlight: (paneId: PaneId | null) => void
  setSpotlightLane: (id: string | null) => void
  setPaneCollapsed: (paneId: PaneId, collapsed: boolean) => void
  setActiveStoryId: (id: string | null) => void
  setDrawerStory: (id: string | null) => void
  setTelemetry: (data: Partial<LayoutState>) => void
  setCapexTimer: (timer: string) => void
  updateAgentTelemetry: (agentId: string, data: Partial<AgentTelemetry>) => void
  toggleLeftPanelMode: () => void
  toggleRightPanelMode: () => void
  setPhosphorColor: (color: PhosphorColor) => void
  setReviewEnabled: (enabled: boolean) => void
  setColumns: (columns: KanbanColumn[]) => void
  setActiveWorkflowTemplate: (id: string | null) => void
  setCenterMode: (mode: CenterMode) => void
  setActiveFilePath: (path: string | null) => void
  setActiveFileContent: (content: string) => void
  setActiveFileLanguage: (language: string) => void
  openFile: (path: string) => void
  closeFile: (path: string) => void
  setActiveFile: (path: string) => void
  setFileDirty: (path: string, dirty: boolean) => void
  setAppearance: (patch: Partial<{ uiDensity: 'compact' | 'normal' | 'comfortable', fontSize: number, animationsEnabled: boolean, crtMode: boolean }>) => void
  toggleUIBuilder: () => void
  setPaletteOpen: (open: boolean) => void
  setInspectorOpen: (open: boolean) => void
  toggleUITestingDrawer: () => void
  setUIComponents: (components: UIComponent[]) => void
  setWorkingDir: (dir: string) => void
  setGitBranch: (branch: string) => void
  setGitDirty: (dirty: boolean) => void
  setSidebarOpen: (open: boolean) => void
  setChatPanelOpen: (open: boolean) => void

  // Terminal Actions
  setTerminalOpen: (open: boolean) => void
  setActiveTerminal: (id: string) => void
  addTerminal: (id: string, label: string, ephemeral?: boolean) => void
  removeTerminal: (id: string) => void
  setTerminalBusy: (id: string, busy: boolean) => void
  setTerminalCwd: (id: string, cwd: string) => void
  setChatPanelTab: (tab: 'chat' | 'guide') => void

  // Canvas Actions
  setCanvasContent: (content: string | null) => void
  setCanvasUrl: (url: string | null) => void
  setBrowserSessionActive: (active: boolean) => void

  // Tour Actions
  setHasCompletedTour: () => void
  setTourHighlight: (id: string | null) => void
  setTourStep: (step: number) => void
  setTourActive: (active: boolean) => void
  retakeTour: () => void

  // Settings
  settingsOpen: boolean
  setSettingsOpen: (v: boolean) => void

  // Activity Bar
  activityBarCollapsed: boolean
  setActivityBarCollapsed: (collapsed: boolean) => void

  // Genesis Wizard
  showGenesis: boolean
  setShowGenesis: (show: boolean) => void

  // Basement Archive
  basementOpen: boolean
  setBasementOpen: (open: boolean) => void

  // Story stats
  inProgressCount: number
  setInProgressCount: (count: number) => void

  // Diagnostics
  diagnosticErrorCount: number
  setDiagnosticErrorCount: (count: number) => void

  // Review
  pendingReview: ReviewSession | null
  setPendingReview: (review: ReviewSession | null) => void
  pendingReviewSummary: ReviewSession | null
  setPendingReviewSummary: (review: ReviewSession | null) => void

  // Archive
  showArchive: boolean
  toggleArchive: () => void

  // Diff Review
  reviewMode: boolean
  pendingDiff: { files: { path: string, original: string, modified: string, status: 'added' | 'modified' | 'deleted' }[] } | null
  setReviewMode: (files: { path: string, original: string, modified: string, status: 'added' | 'modified' | 'deleted' }[]) => void
  clearReviewMode: () => void

  // Session
  isSessionEnded: boolean
  setSessionEnded: (v: boolean) => void

  // Workspace Switch
  resetForWorkspaceSwitch: () => void
}

export const useLayoutStore = create<LayoutState>()(
  persist(
    (set) => ({
      searchDrawerOpen: false,
      activeView: 'editor',
      isFlipped: {
        sidebar: false,
        chat: false,
        terminal: false,
      },
      spotlightPane: null,
      spotlightLane: null,
      collapsedPanes: [],
      activeStoryId: null,
      drawerStoryId: null,
      phosphorColor: 'green',
      reviewEnabled: false,
      columns: DEFAULT_COLUMNS,
      activeWorkflowTemplate: null,
      centerMode: 'code',
      activeFilePath: null,
      activeFileContent: '',
      activeFileLanguage: 'typescript',
      openFiles: [],

      uiDensity: 'normal',
      fontSize: 12,
      animationsEnabled: true,
      crtMode: false,

      sidebarOpen: true,

      terminalOpen: false,
      activeTerminalId: 'terminal-local',
      terminals: [
        { id: 'terminal-local', label: 'Terminal', isBusy: false },
      ],

      canvasContent: null,
      canvasUrl: null,

      hasCompletedTour: false,
      tourHighlight: null,
      tourStep: 0,
      tourActive: false,

      uiBuilderOpen: false,
      uiTestingDrawerOpen: false,
      paletteOpen: true,
      inspectorOpen: true,
      uiComponents: [],
      browserSessionActive: false,

      leftPanelMode: 'explorer',
      rightPanelMode: 'telemetry',
      flippedPanes: [],
      chatPanelTab: 'chat',
      chatPanelOpen: true,

      workingDir: '',
      gitBranch: 'main',
      isGitDirty: true,
      capexTotal: 0,
      capexSessionTime: 0,
      capexTimer: '00:00:00',
      agentTelemetry: {
        claude: { tokensIn: 0, tokensOut: 0, limit: 200000, cost: 0 },
        gemini: { tokensIn: 0, tokensOut: 0, limit: 1000000, cost: 0 },
        jules: { tokensIn: 0, tokensOut: 0, limit: 128000, cost: 0 },
      },

      setSearchDrawerOpen: (v) => set({ searchDrawerOpen: v }),

      setView: (view) => set((state) => {
        if (view === 'search') return { ...state, searchDrawerOpen: true }
        return { ...state, activeView: view }
      }),

      toggleFlip: (paneId) => set((state) => {
        const newFlipped = [...state.flippedPanes]
        const index = newFlipped.indexOf(paneId)
        if (index > -1) {
          newFlipped.splice(index, 1)
        } else {
          newFlipped.push(paneId)
        }
        return { flippedPanes: newFlipped }
      }),

      setSpotlight: (paneId) => set({ spotlightPane: paneId }),

      setSpotlightLane: (id) => set({ spotlightLane: id }),

      setPaneCollapsed: (paneId, collapsed) => set((state) => {
        const newCollapsed = [...state.collapsedPanes]
        const idx = newCollapsed.indexOf(paneId)
        if (collapsed && idx === -1) newCollapsed.push(paneId)
        if (!collapsed && idx > -1) newCollapsed.splice(idx, 1)
        return { collapsedPanes: newCollapsed }
      }),

      setActiveStoryId: (id) => set({ activeStoryId: id }),

      setDrawerStory: (id) => set({ drawerStoryId: id }),

      setTelemetry: (data) => set((state) => ({ ...state, ...data })),

      setCapexTimer: (timer) => set({ capexTimer: timer }),

      updateAgentTelemetry: (agentId, data) => set((state) => {
        const existing = state.agentTelemetry[agentId] || { tokensIn: 0, tokensOut: 0, cost: 0, limit: 1000000 }
        return {
          agentTelemetry: {
            ...state.agentTelemetry,
            [agentId]: { ...existing, ...data }
          }
        }
      }),

      toggleLeftPanelMode: () => set((state) => ({
        leftPanelMode: state.leftPanelMode === 'explorer' ? 'command-deck' : 'explorer'
      })),

      toggleRightPanelMode: () => set((state) => ({
        rightPanelMode: state.rightPanelMode === 'telemetry' ? 'kanban' : 'telemetry'
      })),

      setPhosphorColor: (color) => set({ phosphorColor: color }),
      setReviewEnabled: (enabled) => set({ reviewEnabled: enabled }),
      setColumns: (columns) => set({ columns }),
      setActiveWorkflowTemplate: (id) => set({ activeWorkflowTemplate: id }),
      setCenterMode: (mode) => set({ centerMode: mode }),
      setActiveFilePath: (path) => set({ activeFilePath: path }),
      setActiveFileContent: (content) => set({ activeFileContent: content }),
      setActiveFileLanguage: (language) => set({ activeFileLanguage: language }),
      openFile: (path) => set((state) => {
        const alreadyOpen = state.openFiles.some(f => f.path === path)
        const nextFiles = alreadyOpen ? state.openFiles : [...state.openFiles, { path, isDirty: false }]
        return { openFiles: nextFiles, activeFilePath: path }
      }),
      closeFile: (path) => set((state) => {
        const nextFiles = state.openFiles.filter(f => f.path !== path)
        let nextActive = state.activeFilePath
        if (state.activeFilePath === path) {
          const idx = state.openFiles.findIndex(f => f.path === path)
          const nextIdx = Math.min(idx, nextFiles.length - 1)
          nextActive = nextFiles[nextIdx]?.path || null
        }
        return { openFiles: nextFiles, activeFilePath: nextActive }
      }),
      setActiveFile: (path) => set((state) => {
        if (!state.openFiles.some(f => f.path === path)) return state
        return { activeFilePath: path }
      }),
      setFileDirty: (path, dirty) => set((state) => ({
        openFiles: state.openFiles.map(f => f.path === path ? { ...f, isDirty: dirty } : f)
      })),
      setAppearance: (patch) => set((state) => ({ ...state, ...patch })),
      toggleUIBuilder: () => set((state) => ({ uiBuilderOpen: !state.uiBuilderOpen })),
      setPaletteOpen: (open) => set({ paletteOpen: open }),
      setInspectorOpen: (open) => set({ inspectorOpen: open }),
      toggleUITestingDrawer: () => set((state) => ({ uiTestingDrawerOpen: !state.uiTestingDrawerOpen })),
      setUIComponents: (components) => set({ uiComponents: components }),
      setWorkingDir: (dir) => set({ workingDir: dir }),
      setGitBranch: (branch) => set({ gitBranch: branch }),
      setGitDirty: (dirty) => set({ isGitDirty: dirty }),
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      setChatPanelOpen: (open) => set({ chatPanelOpen: open }),

      setTerminalOpen: (open) => set({ terminalOpen: open }),
      setActiveTerminal: (id) => set({ activeTerminalId: id }),
      addTerminal: (id, label, ephemeral = false) => set((state) => {
        if (state.terminals.find(t => t.id === id)) return { ...state, activeTerminalId: id, terminalOpen: true }
        return {
          terminals: [...state.terminals, { id, label, isBusy: false, ephemeral }],
          activeTerminalId: id,
          terminalOpen: true
        }
      }),
      removeTerminal: (id) => set((state) => {
        const newTerms = state.terminals.filter(t => t.id !== id)
        const nextId = state.activeTerminalId === id ? (newTerms[0]?.id || '') : state.activeTerminalId
        return { terminals: newTerms, activeTerminalId: nextId }
      }),
      setTerminalBusy: (id, busy) => set((state) => ({
        terminals: state.terminals.map(t => t.id === id ? { ...t, isBusy: busy } : t)
      })),
      setTerminalCwd: (id, cwd) => set((state) => ({
        terminals: state.terminals.map(t => t.id === id ? { ...t, cwd } : t)
      })),
      setChatPanelTab: (tab) => set({ chatPanelTab: tab }),

      setCanvasContent: (content) => set({ canvasContent: content }),
      setCanvasUrl: (url) => set({ canvasUrl: url }),
      setBrowserSessionActive: (active) => set({ browserSessionActive: active }),

      setHasCompletedTour: () => set({ hasCompletedTour: true }),
      setTourHighlight: (id) => set({ tourHighlight: id }),
      setTourStep: (step) => set({ tourStep: step }),
      setTourActive: (active) => set({ tourActive: active }),
      retakeTour: () => set({ tourActive: true, activeView: 'designer' as StoryboardView, centerMode: 'canvas' as CenterMode }),

      settingsOpen: false,
      setSettingsOpen: (v) => set({ settingsOpen: v }),

      activityBarCollapsed: false,
      setActivityBarCollapsed: (collapsed) => set({ activityBarCollapsed: collapsed }),

      showGenesis: false,
      setShowGenesis: (show) => set({ showGenesis: show }),

      basementOpen: false,
      setBasementOpen: (open) => set({ basementOpen: open }),

      inProgressCount: 0,
      setInProgressCount: (count) => set({ inProgressCount: count }),

      diagnosticErrorCount: 0,
      setDiagnosticErrorCount: (count) => set({ diagnosticErrorCount: count }),

      pendingReview: null,
      setPendingReview: (review) => set({ pendingReview: review }),

      pendingReviewSummary: null,
      setPendingReviewSummary: (review) => set({ pendingReviewSummary: review }),

      showArchive: false,
      toggleArchive: () => set((state) => ({ showArchive: !state.showArchive })),

      reviewMode: false,
      pendingDiff: null,
      setReviewMode: (files) => set({ reviewMode: true, pendingDiff: { files } }),
      clearReviewMode: () => set({ reviewMode: false, pendingDiff: null }),

      isSessionEnded: false,
      setSessionEnded: (v) => set({ isSessionEnded: v }),

      resetForWorkspaceSwitch: () => set({
        openFiles: [],
        activeFilePath: null,
        activeView: 'planner',
        isSessionEnded: false
      })
    }),
    {
      name: 'copernicus-layout-storage',
      onRehydrateStorage: () => (state) => {
        if (!state) return
        if (
          !state.columns ||
          state.columns.length !== 9 ||
          state.columns.some(c => ['blueprint', 'ui-design', 'staging'].includes(c.id))
        ) {
          state.columns = DEFAULT_COLUMNS
        }
      }
    }
  )
)
