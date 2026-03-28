import log from '../utils/logger'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'


export type StoryboardView = 'planner' | 'designer' | 'editor' | 'reporter' | 'orchestrator' | 'command-center' | 'memory' | 'github' | 'review' | 'git' | 'search' | 'diagnostics' | 'logs' | 'replay' | 'test-explorer' | 'debug'
export type PaneId = 'explorer' | 'editor' | 'inspector' | 'chat' | 'kanban' | 'orchestrator' | 'terminal'

export interface ReviewSession {
  sessionId: string
  stories: number[]
  changedFiles: string[]
  exitCode: number
}

export const DEFAULT_COLUMNS: KanbanColumn[] = [
  { id: 'planning',       status: 'PLANNING',       label: 'Planning',        color: 'bg-slate-400/20 border-slate-300/60',    accent: 'bg-slate-300' },
  { id: 'storyboarding',  status: 'STORYBOARDING',  label: 'Storyboarding',   color: 'bg-violet-500/20 border-violet-400/70',  accent: 'bg-violet-400' },
  { id: 'sprint-planning',status: 'SPRINT_PLANNING', label: 'Sprint Planning', color: 'bg-indigo-500/20 border-indigo-400/70',  accent: 'bg-indigo-400' },
  { id: 'development',    status: 'IN_PROGRESS',     label: 'Development',     color: 'bg-yellow-400/20 border-yellow-300/70',  accent: 'bg-yellow-300' },
  { id: 'testing',        status: 'TESTING',         label: 'Testing',         color: 'bg-orange-500/20 border-orange-400/70',  accent: 'bg-orange-400' },
  { id: 'qa',             status: 'QA',              label: 'QA',              color: 'bg-amber-400/20 border-amber-300/70',    accent: 'bg-amber-300' },
  { id: 'documenting',    status: 'DOCUMENTING',     label: 'Documenting',     color: 'bg-cyan-500/20 border-cyan-300/70',      accent: 'bg-cyan-300' },
  { id: 'ready-to-build', status: 'READY',           label: 'Ready to Build',  color: 'bg-teal-500/20 border-teal-300/70',      accent: 'bg-teal-300' },
  { id: 'done',           status: 'COMPLETE',        label: 'Done',            color: 'bg-copernicus-phosphor/20 border-copernicus-phosphor/70', accent: 'bg-copernicus-phosphor' },
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
  minimized?: number
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
stitchTokens: { fonts: string[], colors: string[], spacing: string[] } | null
  setStitchTokens: (tokens: { fonts: string[], colors: string[], spacing: string[] } | null) => void
  stitchImportOpen: boolean
  setStitchImportOpen: (open: boolean) => void
  stitchVerifyOpen: boolean
  setStitchVerifyOpen: (open: boolean) => void
  spotlightPane: PaneId | null
  spotlightLane: string | null
  activeStoryId: string | null
  drawerStoryId: string | null
  activeRetroId: string | null
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



  // Browser Session
  browserSessionActive: boolean

  // NotebookLM
  notebooklmEnabled: boolean

  // Panel Modes
  flippedPanes: string[]
  chatPanelTab: 'chat' | 'guide'
  chatPanelOpen: boolean

  // Git & Working Dir
  workingDir: string
  gitBranch: string
  isGitDirty: boolean



  // Actions
  setView: (view: StoryboardView) => void
  toggleFlip: (paneId: string) => void
  setSpotlight: (paneId: PaneId | null) => void
  setSpotlightLane: (id: string | null) => void
  setActiveStoryId: (id: string | null) => void
  setDrawerStory: (id: string | null) => void
  setActiveRetroId: (id: string | null) => void

  setPhosphorColor: (color: PhosphorColor) => void
  setReviewEnabled: (enabled: boolean) => void
  setColumns: (columns: KanbanColumn[]) => void
  updateKanbanColumn: (id: string, updates: Partial<KanbanColumn>, invoke: (channel: string, ...args: unknown[]) => Promise<unknown>) => Promise<void>
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
  setNotebooklmEnabled: (enabled: boolean) => void

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

  // Intelligence Manager (Agents)
  agentsOpen: boolean
  setAgentsOpen: (v: boolean) => void

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
  pendingSystemMessage: { type: 'review-summary'; storyId: string; storyTitle: string; changedFiles: string[]; summary: string; timestamp: string } | null
  setPendingSystemMessage: (msg: { type: 'review-summary'; storyId: string; storyTitle: string; changedFiles: string[]; summary: string; timestamp: string } | null) => void
  clearPendingSystemMessage: () => void

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
  workspaceKey: number
  resetForWorkspaceSwitch: () => void
}

export const useLayoutStore = create<LayoutState>()(
  persist(
    (set) => ({
      searchDrawerOpen: false,
      activeView: 'editor',
stitchTokens: null,
      setStitchTokens: (tokens) => set({ stitchTokens: tokens }),
      stitchImportOpen: false,
      setStitchImportOpen: (open) => set({ stitchImportOpen: open }),
      stitchVerifyOpen: false,
      setStitchVerifyOpen: (open) => set({ stitchVerifyOpen: open }),
      isFlipped: {
        sidebar: false,
        chat: false,
        terminal: false,
      },
      spotlightPane: null,
      spotlightLane: null,
      activeStoryId: null,
      drawerStoryId: null,
      activeRetroId: null,
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

      browserSessionActive: false,
      notebooklmEnabled: false,



      flippedPanes: [],
      chatPanelTab: 'chat',
      chatPanelOpen: true,

      workingDir: '',
      gitBranch: 'main',
      isGitDirty: true,



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

      setActiveStoryId: (id) => set({ activeStoryId: id }),

      setDrawerStory: (id) => set({ drawerStoryId: id }),

      setActiveRetroId: (id) => set({ activeRetroId: id }),



      setPhosphorColor: (color) => set({ phosphorColor: color }),
      setReviewEnabled: (enabled) => set({ reviewEnabled: enabled }),
      setColumns: (columns) => set({ columns }),
      updateKanbanColumn: async (id, updates, invoke) => {
        try {
          await invoke('kanban:set-column', id, updates)
          set((state) => ({
            columns: state.columns.map(c => c.id === id ? { ...c, ...updates } : c)
          }))
        } catch (e) {
          log.error('Failed to update column', e)
        }
      },
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
      setNotebooklmEnabled: (enabled) => set({ notebooklmEnabled: enabled }),

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

      agentsOpen: false,
      setAgentsOpen: (v) => set({ agentsOpen: v }),

      basementOpen: false,
      setBasementOpen: (open) => set({ basementOpen: open }),

      inProgressCount: 0,
      setInProgressCount: (count) => set({ inProgressCount: count }),

      diagnosticErrorCount: 0,
      setDiagnosticErrorCount: (count) => set({ diagnosticErrorCount: count }),

      pendingReview: null,
      setPendingReview: (review) => set({ pendingReview: review }),

      pendingSystemMessage: null,
      setPendingSystemMessage: (msg) => set({ pendingSystemMessage: msg }),
      clearPendingSystemMessage: () => set({ pendingSystemMessage: null }),

      showArchive: false,
      toggleArchive: () => set((state) => ({ showArchive: !state.showArchive })),

      reviewMode: false,
      pendingDiff: null,
      setReviewMode: (files) => set({ reviewMode: true, pendingDiff: { files } }),
      clearReviewMode: () => set({ reviewMode: false, pendingDiff: null }),

      isSessionEnded: false,
      setSessionEnded: (v) => set({ isSessionEnded: v }),

      workspaceKey: 0,
      resetForWorkspaceSwitch: () => set((state) => ({
        openFiles: [],
        activeFilePath: null,
        activeView: 'planner',
        isSessionEnded: false,
        workspaceKey: (state.workspaceKey || 0) + 1
      }))
    }),
    {
      name: 'copernicus-layout-storage',
      onRehydrateStorage: () => (state) => {
        if (!state) return
        if (
          !state.columns ||
          state.columns.length !== 9 ||
          state.columns.some(c => !DEFAULT_COLUMNS.some(dc => dc.id === c.id))
        ) {
          state.columns = DEFAULT_COLUMNS
        }
        // Always reset transient overlay/modal state on startup
        state.agentsOpen = false
        state.showGenesis = false
        state.searchDrawerOpen = false
        state.stitchImportOpen = false
        state.stitchVerifyOpen = false
        state.spotlightPane = null
        state.tourHighlight = null
        state.isSessionEnded = false
      }
    }
  )
)
