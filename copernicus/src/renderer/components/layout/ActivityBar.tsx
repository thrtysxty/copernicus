import React from 'react'
import {
  FolderOpen, Code, Palette, Workflow, BarChart2,
  Activity, Brain, Github, Settings, FolderPlus,
  Diff, GitBranch, Search, AlertTriangle
} from 'lucide-react'
import { useLayoutStore, StoryboardView } from '../../store/layout'

interface NavItemProps {
  id?: StoryboardView
  icon: React.ElementType
  label: string
  onClick?: () => void
  shortcut?: string
  isActive?: boolean
  badge?: number
  hasDot?: boolean
  highlightId?: string
  testId?: string
}

export const ActivityBar: React.FC = () => {
  const {
    activeView, setView, setCenterMode,
    tourHighlight,
    inProgressCount,
    pendingReview,
    settingsOpen, setSettingsOpen,
    diagnosticErrorCount,
  } = useLayoutStore()

  const NavItem: React.FC<NavItemProps> = ({
    id, icon: Icon, label, onClick, shortcut, isActive, badge, hasDot, highlightId, testId,
  }) => {
    const active = isActive !== undefined ? isActive : (id ? activeView === id : false)
    const handleClick = onClick ?? (id ? () => setView(id) : undefined)
    const highlight = highlightId ?? id
    return (
      <div className="group relative">
        <button
          onClick={handleClick}
          aria-label={label}
          aria-current={active ? 'page' : undefined}
          data-testid={testId || (id ? `nav-${id}` : undefined)}
          className={[
            'w-12 h-12 flex items-center justify-center transition-all duration-200',
            'focus-visible:ring-2 focus-visible:ring-copernicus-phosphor focus-visible:outline-none relative',
            active
              ? 'bg-copernicus-phosphor text-[#050505] rounded-none'
              : 'text-zinc-300 hover:text-zinc-100 hover:bg-zinc-900/50 rounded',
            highlight && tourHighlight === highlight ? 'ring-2 ring-copernicus-phosphor animate-pulse z-50' : '',
          ].join(' ')}
        >
          <Icon size={18} strokeWidth={active ? 2.5 : 1.5} />
          {badge !== undefined && badge > 0 && (
            <span className="absolute -top-1 -right-1 bg-copernicus-phosphor text-[#050505] text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center leading-none">
              {badge > 9 ? '9+' : badge}
            </span>
          )}
          {hasDot && (
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-copernicus-phosphor" />
          )}
        </button>
        <div className="pointer-events-none absolute left-full ml-2 top-1/2 -translate-y-1/2 bg-zinc-900 border border-zinc-700 text-zinc-300 text-[10px] font-mono px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-50">
          {label}{shortcut && <span className="text-zinc-500 ml-1">{shortcut}</span>}
        </div>
      </div>
    )
  }

  return (
    <aside className="w-12 flex-shrink-0 bg-[#080808] border-r border-copernicus-steel flex flex-col items-center z-50 h-full">
      {/* C Logo */}
      <div className="w-12 h-12 flex items-center justify-center border-b border-white/5 bg-zinc-950/30 shrink-0">
        <div className="w-6 h-6 bg-copernicus-phosphor/20 rounded-sm flex items-center justify-center phosphor-glow-border">
          <span className="text-copernicus-phosphor font-black text-[10px]">C</span>
        </div>
      </div>

      {/* Top Nav */}
      <div className="flex flex-col items-center w-full">
        <NavItem id="planner" icon={FolderOpen} label="Planner" shortcut="⌘1" badge={inProgressCount} testId="nav-planner" />
        <NavItem
          id="editor"
          icon={Code}
          label="Editor"
          shortcut="⌘2"
          testId="nav-editor"
          onClick={() => { setView('editor'); setCenterMode('code') }}
        />
        <NavItem
          id="designer"
          icon={Palette}
          label="Designer"
          shortcut="⌘3"
          testId="nav-designer"
          onClick={() => { setView('designer'); setCenterMode('canvas') }}
        />
        <NavItem id="orchestrator" icon={Workflow} label="Orchestrator" shortcut="⌘4" testId="nav-orchestrator" />
        <NavItem id="reporter" icon={BarChart2} label="Reporter" shortcut="⌘5" testId="nav-reporter" />
        <NavItem id="review" icon={Diff} label="Review" shortcut="⌘8" hasDot={!!pendingReview} testId="nav-review" />
        <NavItem id="command-center" icon={Activity} label="Telemetry" shortcut="⌘6" testId="nav-telemetry" />
        <NavItem id="memory" icon={Brain} label="Agent Memory" shortcut="⌘7" testId="nav-memory" />
        <NavItem id="git" icon={GitBranch} label="Git" shortcut="⌘9" testId="nav-git" />
        <NavItem id="search" icon={Search} label="Search" shortcut="⌘F2" testId="nav-search" />
        <NavItem id="diagnostics" icon={AlertTriangle} label="Problems" shortcut="⌘Shift+M" badge={diagnosticErrorCount} hasDot={diagnosticErrorCount > 0} testId="nav-diagnostics" />
      </div>

      <div className="flex-1" />

      {/* Bottom Tools */}
      <div className="flex flex-col items-center w-full pb-2">
        <NavItem id="github" icon={Github} label="GitHub" testId="nav-github" />
        <NavItem 
          icon={FolderPlus} 
          label="New Project" 
          testId="nav-genesis" 
          onClick={() => useLayoutStore.getState().setShowGenesis(true)} 
        />
        <NavItem
          icon={Settings}
          label="Settings"
          isActive={settingsOpen}
          testId="nav-settings"
          onClick={() => setSettingsOpen(true)}
        />
      </div>
    </aside>
  )
}
