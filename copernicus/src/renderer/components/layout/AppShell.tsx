import { ErrorBoundary } from '../ErrorBoundary'
import { ApplicationHeader } from './ApplicationHeader'
import { ActivityBar } from './ActivityBar'
import { ArchiveDrawer } from './ArchiveDrawer'
import { StatusBar } from './StatusBar'
import { SettingsPanel } from '../settings/SettingsPanel'
import { CommandPalette } from './CommandPalette'
import { ProjectSelectorDialog } from './ProjectSelectorDialog'
import GenesisWizard from '../genesis/GenesisWizard'
import { CRTOverlay } from '../effects/CRTOverlay'
import { CapabilityApprovalDialog } from '../extensions/CapabilityApprovalDialog'
import { TerminalTabs } from '../Terminal/TerminalTabs'
import { ViewRouter } from './ViewRouter'
import { useWorkspaceStore } from '../../store/workspace'
import { useTelemetryStore } from '../../store/telemetryStore'
import { useIpcError } from '../../hooks/useIpcError'
import { unwrapIpc, IpcResult } from '../../types/ipc'

export function AppShell({
  projectSelectorOpen,
  setProjectSelectorOpen,
  commandPaletteOpen,
  setCommandPaletteOpen,
}: {
  projectSelectorOpen: boolean
  setProjectSelectorOpen: (v: boolean) => void
  commandPaletteOpen: boolean
  setCommandPaletteOpen: (v: boolean) => void
}) {
  const invoke = useIpcError()
  const workspaceKey = useWorkspaceStore(s => s.workspaceKey)
  const terminalOpen = useWorkspaceStore(s => s.terminalOpen)
  const setTerminalOpen = useWorkspaceStore(s => s.setTerminalOpen)
  const showArchive = useWorkspaceStore(s => s.showArchive)
  const spotlightPane = useWorkspaceStore(s => s.spotlightPane)
  const settingsOpen = useWorkspaceStore(s => s.settingsOpen)
  const setSettingsOpen = useWorkspaceStore(s => s.setSettingsOpen)
  const showGenesis = useWorkspaceStore(s => s.showGenesis)
  const setShowGenesis = useWorkspaceStore(s => s.setShowGenesis)
  const setWorkingDir = useWorkspaceStore(s => s.setWorkingDir)
  const crtMode = useWorkspaceStore(s => s.crtMode)
  const agentTelemetry = useTelemetryStore(s => s.agentTelemetry)
  const anyAgentActive = Object.keys(agentTelemetry ?? {}).length > 0
  const heavyLoad = Object.keys(agentTelemetry ?? {}).length >= 3

  return (
    <div className="flex flex-col h-screen w-screen bg-copernicus-bg text-zinc-300 font-sans overflow-hidden">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:bg-copernicus-phosphor focus:text-[#050505] focus:px-4 focus:py-2 focus:rounded"
      >
        Skip to main content
      </a>

      <ApplicationHeader />

      <div className="flex flex-1 w-full overflow-hidden">
        <ActivityBar />

        <main id="main-content" className="flex-1 flex flex-col overflow-hidden relative" key={workspaceKey}>
          <ErrorBoundary>
            <div className="flex-1 flex overflow-hidden">
              <ViewRouter onStartSession={() => setProjectSelectorOpen(true)} />
            </div>

            <div
              className={`bg-[#050505] transition-all duration-300 ease-in-out overflow-hidden${!terminalOpen ? ' cursor-pointer' : ''}`}
              style={{ height: !terminalOpen ? '32px' : spotlightPane === 'terminal' ? '60vh' : '200px' }}
              onClick={!terminalOpen ? () => setTerminalOpen(true) : undefined}
            >
              {showArchive ? <ArchiveDrawer /> : <TerminalTabs />}
            </div>

            <StatusBar />
          </ErrorBoundary>
        </main>
      </div>

      {settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} />}
      <CommandPalette open={commandPaletteOpen} onClose={() => setCommandPaletteOpen(false)} />
      <div className="hidden">
        <ProjectSelectorDialog open={projectSelectorOpen} onClose={() => setProjectSelectorOpen(false)} />
      </div>
      {showGenesis && (
        <GenesisWizard
          onComplete={() => {
            setShowGenesis(false);
            invoke<IpcResult<string | null>>('app:get-root-path').then((r) => {
              const root = unwrapIpc<string | null>(r);
              if (root) setWorkingDir(root);
            }).catch(() => {});
          }}
        />
      )}
      <CRTOverlay enabled={crtMode} anyAgentActive={anyAgentActive} heavyLoad={heavyLoad} />
      <CapabilityApprovalDialog />
    </div>
  )
}
