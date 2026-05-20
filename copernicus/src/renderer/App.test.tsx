import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import React from 'react'
import App from './App'
import { useLayoutStore } from './store/layout'
import * as useIpcErrorModule from './hooks/useIpcError'

vi.mock('./store/layout', () => ({
  useLayoutStore: vi.fn(),
  StoryboardView: {}
}))

vi.mock('./hooks/useIpcError', () => ({
  useIpcError: vi.fn()
}))

vi.mock('./store/uiBuilderStore', () => ({
  useUIBuilderStore: vi.fn(() => vi.fn())
}))

vi.mock('./store/telemetryStore', () => ({
  useTelemetryStore: vi.fn(() => vi.fn())
}))

vi.mock('./store/toastStore', () => ({
  useToastStore: vi.fn(() => vi.fn())
}))

vi.mock('./store/extensionStore', () => ({
  useExtensionStore: vi.fn(() => vi.fn())
}))

vi.mock('./components/layout/ActivityBar', () => ({ ActivityBar: () => null }))
vi.mock('./components/layout/ApplicationHeader', () => ({ ApplicationHeader: () => null }))
vi.mock('./components/layout/ProjectSelectorDialog', () => ({ ProjectSelectorDialog: () => null }))
vi.mock('./components/command/CommandCenter', () => ({ CommandCenter: () => null }))
vi.mock('./components/FileTree/FileTree', () => ({ FileTree: () => null }))
vi.mock('./components/chat/ChatPanel', () => ({ ChatPanel: () => null }))
vi.mock('./components/layout/StatusBar', () => ({ StatusBar: () => null }))
vi.mock('./components/layout/FlippablePanel', () => ({ FlippablePanel: () => null }))
vi.mock('./components/Editor/CenterPanelRouter', () => ({ CenterPanelRouter: () => null }))
vi.mock('./components/Terminal/TerminalTabs', () => ({ TerminalTabs: () => null }))
vi.mock('./components/kanban/KanbanBoard', () => ({ KanbanBoard: () => null }))
vi.mock('./components/capex/CapexDashboard', () => ({ CapexDashboard: () => null }))
vi.mock('./components/workflow/WorkflowCanvas', () => ({ default: () => null }))
vi.mock('./components/orchestrator/TileInspector', () => ({ TileInspector: () => null }))
vi.mock('./components/settings/SettingsPanel', () => ({ SettingsPanel: () => null }))
vi.mock('./components/layout/CommandPalette', () => ({ CommandPalette: () => null }))
vi.mock('./components/wizard/Wizard', () => ({ default: () => null }))
vi.mock('./components/genesis/GenesisWizard', () => ({ default: () => null }))
vi.mock('./components/intelligence/IntelligenceManager', () => ({ IntelligenceManager: () => null }))
vi.mock('./components/layout/SplashScreen', () => ({ default: ({ onComplete }: any) => {
  // immediately complete splash screen for tests
  React.useEffect(() => { onComplete() }, [onComplete])
  return null
} }))
vi.mock('./components/effects/CRTOverlay', () => ({ CRTOverlay: () => null }))
vi.mock('./components/runtime/ContainerViewer', () => ({ ContainerViewer: () => null }))
vi.mock('./components/debug/DebugPanel', () => ({ DebugPanel: () => null }))
vi.mock('./components/source-control/SourceControlView', () => ({ SourceControlView: () => null }))
vi.mock('./components/memory/MemoryReplayView', () => ({ MemoryReplayView: () => null }))
vi.mock('./components/output/OutputView', () => ({ OutputView: () => null }))
vi.mock('./components/search/SearchPanel', () => ({ SearchPanel: () => null }))
vi.mock('./components/review/ReviewPanel', () => ({ ReviewPanel: () => null }))

// Mock window.ipcRenderer
Object.defineProperty(window, 'ipcRenderer', {
  value: {
    on: vi.fn(() => vi.fn()),
    send: vi.fn(),
    invoke: vi.fn()
  },
  writable: true
})

// Mock ResizeObserver
global.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
}

describe('App - Escape Key Handling', () => {
  const invokeMock = vi.fn().mockResolvedValue({ ok: true, data: null })

  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(useIpcErrorModule, 'useIpcError').mockReturnValue(invokeMock)

    // Setup default layout store returns
    const defaultStoreState: Record<string, any> = {
      activeView: 'planner',
      workspaceKey: 'test',
      sidebarOpen: false,
      terminalOpen: false,
      showArchive: false,
      spotlightPane: null,
      isSessionEnded: false,
      workingDir: '/test',
      gitBranch: 'main',
      activeStoryId: null,
      activeFilePath: null,
      activeFileContent: null,
      activeFileLanguage: null,
      chatPanelOpen: false,
      hasCompletedTour: true,
      tourHighlight: null,
      settingsOpen: false,
      crtMode: false,
      setView: vi.fn(),
      setTerminalOpen: vi.fn(),
      setSpotlight: vi.fn(),
      toggleFlip: vi.fn(),
      setWorkingDir: vi.fn(),
      setGitBranch: vi.fn(),
      setGitDirty: vi.fn(),
      addTerminal: vi.fn(),
      removeTerminal: vi.fn(),
      setTerminalBusy: vi.fn(),
      setActiveFileContent: vi.fn(),
      setCenterMode: vi.fn(),
      setTourHighlight: vi.fn(),
      setChatPanelTab: vi.fn(),
      setInProgressCount: vi.fn(),
      setPendingReview: vi.fn(),
      setPendingSystemMessage: vi.fn(),
      setSettingsOpen: vi.fn(),
      setSidebarOpen: vi.fn(),
      setChatPanelOpen: vi.fn(),
      showGenesis: false,
      setShowGenesis: vi.fn(),
      resetForWorkspaceSwitch: vi.fn(),
      setColumns: vi.fn()
    }

    vi.mocked(useLayoutStore).mockImplementation((selector: any) => {
      return selector(defaultStoreState)
    })
    ;(useLayoutStore as any).getState = vi.fn(() => defaultStoreState)
  })

  it('closes intelligence view on escape', () => {
    // Override store state for this test
    const setViewMock = vi.fn()
    vi.mocked(useLayoutStore).mockImplementation((selector: any) => {
      return selector({ ...vi.mocked(useLayoutStore).getState(), activeView: 'intelligence', setView: setViewMock })
    })

    render(<App />)

    // Simulate escape key
    fireEvent.keyDown(document, { key: 'Escape' })

    expect(setViewMock).toHaveBeenCalledWith('planner')
    expect(invokeMock).not.toHaveBeenCalledWith('window:exit-fullscreen')
  })
})
