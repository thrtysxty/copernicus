import { KanbanBoard } from '../kanban/KanbanBoard'
import { CapexDashboard } from '../capex/CapexDashboard'
import WorkflowCanvas from '../workflow/WorkflowCanvas'
import { TileInspector } from '../orchestrator/TileInspector'
import { OutputView } from '../output/OutputView'
import { MemoryReplayView } from '../memory/MemoryReplayView'
import { SourceControlView } from '../source-control/SourceControlView'
import { SearchPanel } from '../search/SearchPanel'
import { ReviewPanel } from '../review/ReviewPanel'
import { DebugPanel } from '../debug/DebugPanel'
import { KnowledgeBaseView } from '../kb/KnowledgeBaseView'
import { BrowserPanel } from '../browser/BrowserPanel'
import DatabasePanel from '../database/DatabasePanel'
import { OrgChartPanel } from '../hub/OrgChartPanel'
import { ContractProposalPanel } from '../hub/ContractProposalPanel'
import { ExtensionsPanel } from '../extensions/ExtensionsPanel'
import { IntelligenceManager } from '../intelligence/IntelligenceManager'
import { EditorLayout } from './EditorLayout'
import { useWorkspaceStore } from '../../store/workspace'

export function ViewRouter({ onStartSession }: { onStartSession: () => void }) {
  const activeView = useWorkspaceStore(s => s.activeView)

  switch (activeView) {
    case 'command-center':
      return <div className="flex-1">Command Center (Not Implemented)</div>
    case 'planner':
      return <KanbanBoard onStartSession={onStartSession} />
    case 'reporter':
      return <CapexDashboard />
    case 'orchestrator':
      return (
        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="flex flex-1 overflow-hidden">
            <WorkflowCanvas />
            <TileInspector />
          </div>
        </div>
      )
    case 'diagnostics':
      return <OutputView />
    case 'memory':
      return <MemoryReplayView />
    case 'git':
      return <SourceControlView />
    case 'search':
      return <SearchPanel />
    case 'review':
      return <ReviewPanel />
    case 'debug':
      return <DebugPanel />
    case 'knowledge-base':
      return <KnowledgeBaseView />
    case 'browser':
      return <BrowserPanel />
    case 'database':
      return <DatabasePanel />
    case 'hub:org-chart':
      return <OrgChartPanel />
    case 'hub:contract-proposals':
      return <ContractProposalPanel />
    case 'extensions':
      return <ExtensionsPanel />
    case 'intelligence':
      return <IntelligenceManager />
    case 'designer':
    case 'editor':
      return <EditorLayout />
    default:
      return <div className="flex-1">Unknown view: {activeView}</div>
  }
}
