import { useWorkspaceStore } from '../store/layout'

export function useLayoutClasses() {
  const spotlightPane = useWorkspaceStore(s => s.spotlightPane)
  const sidebarOpen = useWorkspaceStore(s => s.sidebarOpen)
  const chatPanelOpen = useWorkspaceStore(s => s.chatPanelOpen)
  const activeView = useWorkspaceStore(s => s.activeView)

  const sidebarClass = (() => {
    if (spotlightPane === 'explorer') return 'flex-1'
    if (spotlightPane === 'editor' || spotlightPane === 'chat') return 'w-10 flex-shrink-0'
    if (!sidebarOpen) return 'w-10 flex-shrink-0'
    return 'w-64 flex-shrink-0'
  })()

  const centerClass = (() => {
    if (spotlightPane === 'editor') return 'flex-[3]'
    if (activeView === 'editor' || activeView === 'designer') {
      return 'flex-1'
    }
    if (spotlightPane === 'chat') return 'w-0 opacity-0 pointer-events-none'
    if (spotlightPane === 'explorer') return 'w-10 flex-shrink-0'
    return 'flex-1'
  })()

  const chatClass = (() => {
    if (!chatPanelOpen) return 'w-10 flex-shrink-0'
    if (spotlightPane === 'chat') return 'flex-1'
    if (spotlightPane === 'editor' || spotlightPane === 'explorer') return 'w-10 flex-shrink-0'
    return 'w-80 flex-shrink-0'
  })()

  return { sidebarClass, centerClass, chatClass }
}
