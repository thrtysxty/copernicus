import React from 'react'
import {
  FolderOpen, Code, Palette, Workflow, BarChart2,
  Activity, Brain, Settings, Wand2, BookOpen,
  Diff, GitBranch, FlaskConical, Bug, Globe,
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
      {/* Traffic light spacer + C logo merged into one draggable header */}
      <div
        className="w-12 h-10 flex items-center justify-center border-b border-white/5 bg-zinc-950/30 shrink-0"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        <div className="w-5 h-5 bg-copernicus-phosphor/20 rounded-sm flex items-center justify-center phosphor-glow-border" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          <span className="text-copernicus-phosphor font-black text-[9px]">C</span>
        </div>
      </div>

      {/* Primary Nav */}
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
          onClick={() => {
            setView('designer')
            setCenterMode('canvas')
            const { flippedPanes, toggleFlip } = useLayoutStore.getState()
            if (flippedPanes.includes('center-panel')) toggleFlip('center-panel')
          }}
        />
        <NavItem id="orchestrator" icon={Workflow} label="Orchestrator" shortcut="⌘4" testId="nav-orchestrator" />
        <NavItem id="command-center" icon={Activity} label="Telemetry" shortcut="⌘5" testId="nav-telemetry" />
        <NavItem
          icon={Brain}
          label="Agent Memory"
          shortcut="⌘6"
          isActive={activeView === 'memory' || activeView === 'replay'}
          onClick={() => setView('memory')}
          testId="nav-memory"
        />
        <NavItem id="review" icon={Diff} label="Reviews" shortcut="⌘7" hasDot={!!pendingReview} testId="nav-review" />
        <NavItem
          icon={FlaskConical}
          label="Testing"
          shortcut="⌘8"
          badge={diagnosticErrorCount}
          hasDot={diagnosticErrorCount > 0}
          isActive={activeView === 'diagnostics' || activeView === 'test-explorer' || activeView === 'logs'}
          onClick={() => setView('diagnostics')}
          testId="nav-diagnostics"
        />
        <NavItem
          icon={GitBranch}
          label="Source Control"
          shortcut="⌘9"
          isActive={activeView === 'git' || activeView === 'github'}
          onClick={() => setView('git')}
          testId="nav-git"
        />
        <NavItem id="reporter" icon={BarChart2} label="Reporter" shortcut="⌘0" testId="nav-reporter" />
        <NavItem id="debug" icon={Bug} label="Debug" testId="nav-debug" />
        <NavItem id="browser" icon={Globe} label="Browser" testId="nav-browser" />
      </div>

      <div className="flex-1" />

      {/* Bottom Tools */}
      <div className="flex flex-col items-center w-full pb-2">
        <NavItem
          icon={Wand2}
          label="New Project"
          testId="nav-genesis"
          onClick={() => useLayoutStore.getState().setShowGenesis(true)}
        />
        <NavItem
          id="knowledge-base"
          icon={BookOpen}
          label="Knowledge Base"
          testId="nav-kb"
          onClick={() => setView('knowledge-base')}
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
