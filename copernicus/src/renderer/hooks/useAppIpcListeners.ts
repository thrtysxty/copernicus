import { useEffect } from 'react'
import log from '../utils/logger'
import { useWorkspaceStore, StoryboardView, PaneId } from '../store/layout'
import { useToastStore } from '../store/toastStore'
import { unwrapIpc, IpcResult, WorkspaceState } from '../types/ipc'

interface UseAppIpcListenersArgs {
  invoke: <T>(channel: string, ...args: any[]) => Promise<IpcResult<T>>
  setWorkingDir: (dir: string) => void
  setGitBranch: (branch: string) => void
  setGitDirty: (dirty: boolean) => void
  addTerminal: (id: string, label: string, ephemeral?: boolean) => void
  setTerminalBusy: (id: string, busy: boolean) => void
  removeTerminal: (id: string) => void
  toggleFlip: (target: 'editor' | 'chat') => void
  setSpotlight: (id: PaneId | null) => void
  toggleUIBuilder: () => void
  setCommandPaletteOpen: (open: boolean) => void
  setView: (view: StoryboardView) => void
  setCenterMode: (mode: 'code' | 'canvas' | 'binary') => void
  setPendingSystemMessage: (msg: any) => void
  setShowGenesis: (show: boolean) => void
  setInProgressCount: (count: number) => void
}

export function useAppIpcListeners({
  invoke,
  setWorkingDir,
  setGitBranch,
  setGitDirty,
  addTerminal,
  setTerminalBusy,
  removeTerminal,
  toggleFlip,
  setSpotlight,
  toggleUIBuilder,
  setCommandPaletteOpen,
  setView,
  setCenterMode,
  setPendingSystemMessage,
  setShowGenesis,
  setInProgressCount,
}: UseAppIpcListenersArgs) {
  useEffect(() => {
    const removeWorkspaceChanged = window.ipcRenderer.on('app:workspace-changed', (_e, workspaceState: WorkspaceState) => {
      setWorkingDir(workspaceState.path)
      setGitBranch(workspaceState.branch)
      setGitDirty(workspaceState.isDirty)
      // AC4: Context reset on switch
      useWorkspaceStore.getState().resetForWorkspaceSwitch()

      // Verify env state consistency
      invoke<IpcResult<WorkspaceState>>('app:get-env-state').then((r) => {
        const envState = unwrapIpc<WorkspaceState>(r)
        if (envState?.drift?.length) {
          log.warn('[workspace] State drift detected after switch:', envState.drift)
        }
      }).catch(() => {})

      // Re-fetch stories for new workspace
      invoke<IpcResult<{ status: string }[]>>('stories:list').then((r) => {
        const list = unwrapIpc<{ status: string }[]>(r) ?? []
        setInProgressCount(list.filter((s) => s.status === 'IN PROGRESS').length)
      }).catch(() => {})
    })

    const removeActivateTab = window.ipcRenderer.on('terminal:activate-tab', (_e, { agentId }: { agentId: string }) => {
      addTerminal(`terminal-${agentId}`, agentId.toUpperCase())
    })

    const removeSpawnTerminal = window.ipcRenderer.on('terminal:spawn', (_e, { id, label, ephemeral }: { id: string; label: string; ephemeral?: boolean }) => {
      addTerminal(id, label, ephemeral ?? false)
    })

    const removeBusyState = window.ipcRenderer.on('terminal:set-busy', (_e, { id, busy }: { id: string; busy: boolean }) => {
      setTerminalBusy(id, busy)
    })

    const removeTerminalClosed = window.ipcRenderer.on('terminal-closed', (_e, { id }: { id: string }) => {
      removeTerminal(id)
    })

    const removeTerminalRemove = window.ipcRenderer.on('terminal:remove', (_e, { id }: { id: string }) => {
      removeTerminal(id)
    })

    const removeFlipListener = window.ipcRenderer.on('layout:toggle-flip', () => {
      const target = useWorkspaceStore.getState().spotlightPane ?? 'chat'
      toggleFlip(target as 'editor' | 'chat')
    })

    const removeSpotListener = window.ipcRenderer.on('layout:toggle-spotlight', () => {
      const current = useWorkspaceStore.getState().spotlightPane
      setSpotlight(current ? null : 'editor')
    })

    const removeUiBuilderListener = window.ipcRenderer.on('layout:toggle-ui-builder', () => {
      toggleUIBuilder()
    })

    const removePaletteListener = window.ipcRenderer.on('layout:open-palette', () => {
      setCommandPaletteOpen(true)
    })

    const removeSetViewListener = window.ipcRenderer.on('layout:set-view', (_e, viewId: string) => {
      setView(viewId as StoryboardView)
    })

    const removeToggleSidebarListener = window.ipcRenderer.on('layout:toggle-sidebar', () => {
      const state = useWorkspaceStore.getState()
      state.setSidebarOpen(!state.sidebarOpen)
    })

    const removeKbOpenArticleListener = window.ipcRenderer.on('kb:open-article', (_e, articleId: string) => {
      useWorkspaceStore.getState().setView('knowledge-base')
      useWorkspaceStore.getState().setActiveKbArticleId(articleId)
    })

    const removeReviewSession = window.ipcRenderer.on('review:session-complete', (_e, data: any) => {
      const storyId = data.stories && data.stories.length > 0 ? data.stories[0].toString() : 'UNKNOWN'
      const storyTitle = data.stories && data.stories.length > 0 ? `Story ${data.stories[0]}` : 'Untitled Story'

      setPendingSystemMessage({
        type: 'review-summary',
        storyId,
        storyTitle,
        changedFiles: data.changedFiles ? data.changedFiles.slice(0, 10) : [],
        summary: `Story ${storyId} implementation complete. ${data.changedFiles ? data.changedFiles.length : 0} file(s) changed.`,
        timestamp: new Date().toISOString()
      })
    })

    const views = ['planner', 'editor', 'designer', 'orchestrator', 'reporter', 'command-center', 'memory', 'review', 'git'] as const
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'p') { e.preventDefault(); setCommandPaletteOpen(true) }
      if ((e.metaKey || e.ctrlKey) && e.key >= '1' && e.key <= '9') {
        e.preventDefault()
        const v = views[parseInt(e.key) - 1]
        if (v) {
          setView(v)
          if (v === 'editor') setCenterMode('code')
          else if (v === 'designer') setCenterMode('canvas')
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)

    // Fetch initial state
    invoke<IpcResult<string | null>>('app:get-root-path').then((r) => {
      const root = unwrapIpc<string | null>(r)
      if (root) {
        setWorkingDir(root)
      } else {
        setShowGenesis(true)
      }
    }).catch(() => setShowGenesis(true))
    invoke<IpcResult<string>>('git:branch').then((r) => setGitBranch(unwrapIpc<string>(r))).catch(() => {})
    invoke<IpcResult<{ status: string }[]>>('stories:list').then((r) => {
      const list = unwrapIpc<{ status: string }[]>(r) ?? []
      setInProgressCount(list.filter((s) => s.status === 'IN PROGRESS').length)
    }).catch(() => {})

    const removeStoriesUpdated = window.ipcRenderer.on('stories:updated', (_e, stories: { status: string }[]) => {
      setInProgressCount(stories.filter((s) => s.status === 'IN PROGRESS').length)
    })

    const removeCriticalError = window.ipcRenderer.on('app:critical-error', (_e, payload) => {
      const p = payload as { type: string; message: string }
      useToastStore.getState().addToast(`[Main] ${p.type}: ${p.message}`, 'error')
    })

    return () => {
      removeCriticalError()
      removeStoriesUpdated()
      removeWorkspaceChanged()
      removeActivateTab()
      removeSpawnTerminal()
      removeBusyState()
      removeTerminalClosed()
      removeTerminalRemove()
      removeFlipListener()
      removeSpotListener()
      removeUiBuilderListener()
      removePaletteListener()
      removeSetViewListener()
      removeReviewSession()
      removeToggleSidebarListener()
      removeKbOpenArticleListener()
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [
    invoke,
    setWorkingDir,
    setGitBranch,
    setGitDirty,
    addTerminal,
    setTerminalBusy,
    removeTerminal,
    toggleFlip,
    setSpotlight,
    toggleUIBuilder,
    setCommandPaletteOpen,
    setView,
    setCenterMode,
    setPendingSystemMessage,
    setShowGenesis,
    setInProgressCount,
  ])
}
