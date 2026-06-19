import log from '../utils/logger'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  StoryboardView,
  PaneId,
  ReviewSession,
  PhosphorColor,
  CenterMode,
  TerminalSession
} from '../types/layout'

interface WorkspaceState {
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
  stitchScreenId: string | null
  setStitchScreenId: (id: string | null) => void
  spotlightPane: PaneId | null
  spotlightLane: string | null
  activeStoryId: string | null
  activeKbArticleId: string | null
  setActiveKbArticleId: (id: string | null) => void
  drawerStoryId: string | null
  activeRetroId: string | null
  phosphorColor: PhosphorColor
  reviewEnabled: boolean
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
  editorFocusLine: { file: string, line: number, col?: number } | null
  setEditorFocusLine: (focus: { file: string, line: number, col?: number } | null) => void
}

export const useWorkspaceStore = create<WorkspaceState>()(
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
      stitchScreenId: null,
      setStitchScreenId: (id) => set({ stitchScreenId: id }),
      isFlipped: {
        sidebar: false,
        chat: false,
        terminal: false,
      },
      spotlightPane: null,
      spotlightLane: null,
      activeStoryId: null,
      activeKbArticleId: null,
      setActiveKbArticleId: (id) => set({ activeKbArticleId: id }),
      drawerStoryId: null,
      activeRetroId: null,
      phosphorColor: 'green',
      reviewEnabled: false,
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

      browserSessionActive: false,
      notebooklmEnabled: false,

      flippedPanes: [],
      chatPanelTab: 'chat',
      chatPanelOpen: true,

      workingDir: '',
      gitBranch: 'main',
      isGitDirty: false,

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
      editorFocusLine: null,
      setEditorFocusLine: (focus) => set({ editorFocusLine: focus }),
      resetForWorkspaceSwitch: () => set((state) => ({
        openFiles: [],
        activeFilePath: null,
        activeView: 'planner',
        isSessionEnded: false,
        workspaceKey: (state.workspaceKey || 0) + 1
      }))
    }),
    {
      name: 'copernicus-workspace-storage',
      partialize: (state) => {
        const { terminalOpen, ...persisted } = state
        return persisted
      },
      onRehydrateStorage: () => (state) => {
        if (!state) return
        state.agentsOpen = false
        state.showGenesis = false
        state.searchDrawerOpen = false
        state.stitchImportOpen = false
        state.stitchVerifyOpen = false
        state.spotlightPane = null
        state.isSessionEnded = false
        state.terminalOpen = false
      }
    }
  )
)
