import { useState, useEffect } from 'react'
import { useLayoutStore } from './store/layout'
import { useIpcError } from './hooks/useIpcError'
import { ApplicationHeader } from './components/layout/ApplicationHeader'
import { ActivityBar } from './components/layout/ActivityBar'
import { StatusBar } from './components/layout/StatusBar'
import { FileTree } from './components/FileTree/FileTree'
import { ChatPanel } from './components/chat/ChatPanel'
import { TerminalTabs } from './components/Terminal/TerminalTabs'
import { KanbanBoard } from './components/KanbanBoard'
import { CapexDashboard } from './components/capex/CapexDashboard'
import WorkflowCanvas from './components/workflow/WorkflowCanvas'
import { SettingsPanel } from './components/settings/SettingsPanel'
import { CommandPalette } from './components/layout/CommandPalette'
import { GithubDashboard } from './components/github/GithubDashboard'
import { CommandCenter } from './components/command/CommandCenter'
import { FlippablePanel } from './components/layout/FlippablePanel'
import { CenterPanelRouter } from './components/Editor/CenterPanelRouter'
import { SharedPanelHeader } from './components/layout/SharedPanelHeader'
import Wizard from './components/wizard/Wizard'
import SplashScreen from './components/layout/SplashScreen'
import { unwrapIpc } from './types/ipc'

const TERMINAL_HEIGHT = 200

export default function App() {
  const invoke = useIpcError()
  const {
    activeView, setView,
    sidebarOpen, setSidebarOpen,
    chatPanelOpen, setChatPanelOpen,
    terminalOpen,
    spotlightPane,
    toggleFlip,
    workingDir, setWorkingDir,
    
    
    activeFilePath, setActiveFilePath,
    setCenterMode,
    setInProgressCount
  } = useLayoutStore()

  const [settingsOpen, setSettingsOpen] = useState(false)
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)
  const [isWizard, setIsWizard] = useState(false)
  const [showSplash, setShowSplash] = useState(true)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('window') === 'wizard') setIsWizard(true)

    const removeWorkspaceChanged = (window as any).ipcRenderer.on('app:workspace-changed', (_e: any, { path }: any) => setWorkingDir(path))
    const removePaletteListener = (window as any).ipcRenderer.on('layout:open-palette', () => setCommandPaletteOpen(true))
    const removeSetViewListener = (window as any).ipcRenderer.on('layout:set-view', (_e: any, viewId: any) => setView(viewId))

    invoke<any>('app:get-root-path').then((r: any) => {
      const root = unwrapIpc<any>(r)
      if (root) setWorkingDir(root)
      else setIsWizard(true)
    }).catch(() => setIsWizard(true))
    
    
    invoke<any>('stories:list').then((r: any) => {
      const data = unwrapIpc<any>(r)
      const list: any[] = Array.isArray(data) ? data : []
      setInProgressCount(list.filter((s: any) => s.status === 'IN PROGRESS').length)
    }).catch(() => {})

    return () => {
      removeWorkspaceChanged()
      removePaletteListener()
      removeSetViewListener()
    }
  }, [invoke, setWorkingDir,  setView, setInProgressCount])

  if (showSplash) return <SplashScreen onComplete={() => setShowSplash(false)} />
  if (isWizard) return <Wizard onComplete={() => { setIsWizard(false); setView('planner'); }} />

  const is3PanelLayout = ['editor', 'designer', 'orchestrator', 'planner'].includes(activeView)

  const CollapsedStrip = ({ name, onClick }: { name: string, onClick: () => void }) => (
    <div 
      className="w-6 h-full bg-[#080808] border-r border-copernicus-steel flex flex-col items-center py-4 cursor-pointer hover:bg-zinc-900 transition-colors group shrink-0"
      onClick={onClick}
    >
      <span 
        className="text-[9px] font-bold text-zinc-600 uppercase tracking-tighter origin-center whitespace-nowrap group-hover:text-copernicus-phosphor"
        style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
      >
        {name}
      </span>
    </div>
  )

  return (
    <div className="flex flex-col h-screen w-screen bg-copernicus-bg text-zinc-300 font-sans overflow-hidden">
      
      {/* Level 0: Application Header (Top Fixed) */}
      <ApplicationHeader />

      <div className="flex-1 flex overflow-hidden">
        
        {/* Level 1: Activity Bar (Left, Header to Status Bar) */}
        <ActivityBar />

        {/* Level 2: Main Content (3-Panel Grid or Full Panel) */}
        <main className="flex-1 flex flex-col overflow-hidden relative">
          
          <div className="flex-1 flex overflow-hidden">
            {is3PanelLayout ? (
              <>
                {/* Left Panel: Explorer */}
                {!sidebarOpen ? (
                  <CollapsedStrip name="Explorer" onClick={() => setSidebarOpen(true)} />
                ) : (
                  <div className={`transition-all duration-300 border-r border-copernicus-steel bg-[#080808] flex flex-col shrink-0 ${spotlightPane === ('explorer' as any) ? 'flex-1' : (spotlightPane && spotlightPane !== ('explorer' as any) ? 'w-0 opacity-0 pointer-events-none overflow-hidden' : 'w-64')}`}>
                    <SharedPanelHeader 
                      id="explorer" 
                      name="Explorer" 
                      direction="left" 
                      onChevron={() => setSidebarOpen(false)}
                      onRotate={() => toggleFlip('sidebar')}
                    />
                    <div className="flex-1 overflow-hidden">
                      <FlippablePanel
                        id="sidebar"
                        front={<FileTree rootPath={workingDir} />}
                        back={<div className="p-4 text-[10px] font-mono text-zinc-600 uppercase tracking-widest italic bg-black/20 h-full">Git_View_Stub</div>}
                      />
                    </div>
                  </div>
                )}

                {/* Center Panel: Main View (Single Header Row) */}
                <div className={`flex-1 flex flex-col border-r border-copernicus-steel transition-all duration-500 overflow-hidden ${spotlightPane === 'editor' || spotlightPane === 'kanban' || spotlightPane === 'orchestrator' ? 'flex-[3]' : (spotlightPane && !['editor','kanban','orchestrator'].includes(spotlightPane!) ? 'w-0 opacity-0 pointer-events-none' : 'flex-1')}`}>
                  <SharedPanelHeader 
                    id={activeView === 'planner' ? 'kanban' : (activeView === 'orchestrator' ? 'orchestrator' : 'editor')}
                    name={activeView.toUpperCase()}
                    onRotate={() => toggleFlip('center-panel')}
                  >
                    {activeView === 'orchestrator' && (
                      <div className="flex items-center gap-2 mr-2">
                        <button onClick={() => window.ipcRenderer.send('workflow:save')} className="px-2 py-0.5 rounded font-mono text-[9px] font-bold uppercase tracking-wider bg-zinc-900 text-zinc-400 border border-white/10 hover:bg-zinc-800 transition-colors">Save</button>
                        <button onClick={() => window.ipcRenderer.send('workflow:reset-canvas')} className="px-2 py-0.5 rounded font-mono text-[9px] font-bold uppercase tracking-wider bg-zinc-900 text-zinc-400 border border-white/10 hover:bg-zinc-800 transition-colors">Reset</button>
                        <button onClick={() => window.ipcRenderer.send('workflow:run-canvas')} className="px-3 py-0.5 rounded font-mono text-[9px] font-bold uppercase tracking-wider bg-copernicus-phosphor/20 text-copernicus-phosphor border border-copernicus-phosphor/40 hover:bg-copernicus-phosphor/30 transition-colors">Run</button>
                      </div>
                    )}
                  </SharedPanelHeader>
                  <div className="flex-1 overflow-hidden relative bg-black/20">
                    {activeView === 'planner' ? <KanbanBoard /> :
                     activeView === 'orchestrator' ? <WorkflowCanvas /> :
                     <CenterPanelRouter filePath={activeFilePath} onChange={(v: string | undefined) => setActiveFilePath(v || null)} />}
                  </div>
                </div>

                {/* Right Panel: Assistant */}
                {!chatPanelOpen ? (
                  <CollapsedStrip name="Assistant" onClick={() => setChatPanelOpen(true)} />
                ) : (
                  <div className={`transition-all duration-500 bg-black/10 flex flex-col shrink-0 ${spotlightPane === ('chat' as any) || spotlightPane === ('inspector' as any) ? 'flex-1' : (spotlightPane && spotlightPane !== ('chat' as any) && spotlightPane !== ('inspector' as any) ? 'w-0 opacity-0 pointer-events-none overflow-hidden' : 'w-80')}`}>
                    <SharedPanelHeader 
                      id={spotlightPane === ('inspector' as any) ? 'inspector' : 'chat'}
                      name={spotlightPane === ('inspector' as any) ? "Inspector" : "Assistant"}
                      direction="right"
                      onChevron={() => setChatPanelOpen(false)}
                      onRotate={() => toggleFlip('chat')}
                    />
                    <div className="flex-1 overflow-hidden">
                      <FlippablePanel
                        id="chat"
                        front={<ChatPanel />}
                        back={<div className="p-4 text-[10px] font-mono text-zinc-600 uppercase tracking-widest italic bg-black/20 h-full">Quick_Edits_Stub</div>}
                      />
                    </div>
                  </div>
                )}
              </>
            ) : (
              /* Solo Layout (Reports, Telemetry, etc.) with Single Header Row */
              <div className="flex-1 flex flex-col overflow-hidden">
                <SharedPanelHeader id="editor" name={activeView.toUpperCase()} />
                <div className="flex-1 overflow-hidden bg-copernicus-bg p-4">
                  {activeView === 'command-center' && <CommandCenter />}
                  {activeView === 'reporter' && <CapexDashboard />}
                  {activeView === 'github' && <GithubDashboard />}
                  {activeView === 'memory' && <div className="h-full flex items-center justify-center font-mono text-zinc-600 uppercase tracking-tighter italic border border-white/5 bg-zinc-950/50 rounded">Memory_Browser_Online</div>}
                </div>
              </div>
            )}
          </div>

          {/* Terminal Drawer (Main Stage relative) */}
          <div 
            className={`bg-[#050505] transition-all duration-300 border-t border-copernicus-steel overflow-hidden flex flex-col ${spotlightPane === 'terminal' ? 'flex-1' : (terminalOpen ? `h-[${TERMINAL_HEIGHT}px]` : 'h-0')}`} 
            style={{ height: spotlightPane === 'terminal' ? '100%' : (terminalOpen ? `${TERMINAL_HEIGHT}px` : '0px') }}
          >
            {terminalOpen && <SharedPanelHeader id="terminal" name="Terminal" />}
            <div className="flex-1 overflow-hidden">
              <TerminalTabs />
            </div>
          </div>

          <StatusBar />
        </main>
      </div>

      {/* Overlays */}
      {settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} />}
      {commandPaletteOpen && (
        <CommandPalette
          mode="all"
          onClose={() => setCommandPaletteOpen(false)}
          onFileOpen={(path) => {
            setActiveFilePath(path)
            setCenterMode('code')
            setCommandPaletteOpen(false)
          }}
          rootPath={workingDir}
        />
      )}
    </div>
  )
}
