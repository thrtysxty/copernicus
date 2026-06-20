import { FileTree } from '../FileTree/FileTree'
import { ChatPanel } from '../chat/ChatPanel'
import { FlippablePanel } from './FlippablePanel'
import { CenterPanelRouter } from '../Editor/CenterPanelRouter'
import { ContainerViewer } from '../runtime/ContainerViewer'
import { useWorkspaceStore } from '../../store/workspace'
import { useLayoutClasses } from '../../hooks/useLayoutClasses'

export function EditorLayout() {
  const sidebarOpen = useWorkspaceStore(s => s.sidebarOpen)
  const spotlightPane = useWorkspaceStore(s => s.spotlightPane)
  const chatPanelOpen = useWorkspaceStore(s => s.chatPanelOpen)
  const isSessionEnded = useWorkspaceStore(s => s.isSessionEnded)
  const workingDir = useWorkspaceStore(s => s.workingDir)
  const activeFilePath = useWorkspaceStore(s => s.activeFilePath)
  const activeFileContent = useWorkspaceStore(s => s.activeFileContent)
  const activeFileLanguage = useWorkspaceStore(s => s.activeFileLanguage)
  const activeView = useWorkspaceStore(s => s.activeView)

  const { sidebarClass, centerClass, chatClass } = useLayoutClasses()
  const setSidebarOpen = useWorkspaceStore(s => s.setSidebarOpen)
  const setSpotlight = useWorkspaceStore(s => s.setSpotlight)
  const setChatPanelOpen = useWorkspaceStore(s => s.setChatPanelOpen)
  const toggleFlip = useWorkspaceStore(s => s.toggleFlip)
  const setActiveFileContent = useWorkspaceStore(s => s.setActiveFileContent)

  return (
    <>
      <div className={`${sidebarClass} min-w-0 transition-all duration-300 ease-in-out border-r border-copernicus-steel bg-[#080808] relative flex flex-col overflow-hidden`}>
        {(!sidebarOpen || spotlightPane === 'editor' || spotlightPane === 'chat') ? (
          <div className="h-full w-10 flex flex-col items-center justify-center bg-[#080808] border-r border-copernicus-steel cursor-pointer hover:bg-white/5 shrink-0" onClick={() => !sidebarOpen ? setSidebarOpen(true) : setSpotlight(null)}>
            <span className="text-[11px] font-mono text-zinc-600 uppercase" style={{ writingMode: 'vertical-rl' }}>Explorer</span>
          </div>
        ) : (
          <FlippablePanel
            id="sidebar"
            className="flex-1 overflow-hidden"
            front={<FileTree rootPath={workingDir} />}
            back={<ContainerViewer />}
          />
        )}
      </div>

      <div className="flex-1 flex min-w-0 overflow-hidden relative">
        <div className={`${centerClass} min-w-0 transition-all duration-300 ease-in-out flex flex-col overflow-hidden`}>
          {spotlightPane === 'explorer' ? (
            <div className="h-full w-10 flex flex-col items-center justify-center bg-[#080808] border-r border-copernicus-steel cursor-pointer hover:bg-white/5 shrink-0" onClick={() => setSpotlight(null)}>
              <span className="text-[11px] font-mono text-zinc-600 uppercase" style={{ writingMode: 'vertical-rl' }}>Editor</span>
            </div>
          ) : (
            <FlippablePanel
              id="center-panel"
              className="flex-1"
              front={
                <CenterPanelRouter
                  filePath={activeFilePath}
                  content={activeFileContent}
                  language={activeFileLanguage}
                  onChange={(v) => setActiveFileContent(v ?? '')}
                />
              }
              back={
                <div className="h-full w-full flex flex-col bg-zinc-900">
                  <div className="h-8 flex items-center justify-between px-3 border-b border-copernicus-steel bg-[#080808] shrink-0">
                    <span className="text-[11px] font-mono text-zinc-500 uppercase tracking-widest">Canvas</span>
                    <button
                      onClick={() => toggleFlip('center-panel')}
                      className="text-zinc-500 hover:text-zinc-200 transition-colors text-[11px] font-mono uppercase tracking-widest"
                      title="Flip to Editor"
                    >
                      ← Editor
                    </button>
                  </div>
                  <div className="flex-1 flex items-center justify-center font-mono text-xs text-zinc-600">CANVAS_PREVIEW_ACTIVE</div>
                </div>
              }
            />
          )}
        </div>

        <div className={`${chatClass} min-w-0 transition-all duration-300 ease-in-out border-l border-copernicus-steel flex flex-col overflow-hidden`}>
          {(!chatPanelOpen || spotlightPane === 'editor' || spotlightPane === 'explorer') ? (
            <div className="h-full w-10 flex flex-col items-center justify-center bg-[#080808] border-l border-copernicus-steel cursor-pointer hover:bg-white/5 shrink-0" onClick={() => !chatPanelOpen ? setChatPanelOpen(true) : setSpotlight(null)}>
              <span className="text-[11px] font-mono text-zinc-600 uppercase" style={{ writingMode: 'vertical-rl' }}>Chat</span>
            </div>
          ) : (
            <ChatPanel />
          )}
        </div>

        {isSessionEnded && (activeView === 'editor' || activeView === 'designer') && (
          <div className="absolute inset-0 z-50 pointer-events-auto bg-black/60 flex items-center justify-center">
            <div className="text-center font-mono">
              <div className="text-zinc-300 text-sm mb-1">Session ended</div>
              <div className="text-zinc-600 text-[11px]">Planning and reports are still accessible</div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
