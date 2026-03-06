import React from 'react'
import { 
  Kanban, Palette, Code, Workflow, 
  Monitor, Brain, BarChart2, Github, Settings
} from 'lucide-react'
import { useLayoutStore, StoryboardView } from '../../store/layout'

export const ActivityBar: React.FC = () => {
  const { activeView, setView } = useLayoutStore()

  const NavItem = ({ id, icon: Icon, label }: { id: StoryboardView, icon: any, label: string }) => (
    <button
      onClick={() => setView(id)}
      className={`w-12 h-12 flex items-center justify-center transition-all duration-200 relative group
        ${activeView === id ? 'text-copernicus-phosphor bg-copernicus-phosphor/5' : 'text-zinc-600 hover:text-zinc-300 hover:bg-zinc-900/50'}`}
      title={label}
    >
      <Icon size={20} strokeWidth={activeView === id ? 2.5 : 1.5} />
      {activeView === id && (
        <div className="absolute left-0 top-2 bottom-2 w-0.5 bg-copernicus-phosphor shadow-[0_0_8px_rgba(74,222,128,0.8)]" />
      )}
    </button>
  )

  return (
    <aside className="w-12 flex-shrink-0 bg-[#080808] border-r border-copernicus-steel flex flex-col items-center z-50 h-full">
      {/* Top Item: 'c' Logo */}
      <div className="w-12 h-12 flex items-center justify-center border-b border-white/5 bg-zinc-950/30">
        <div className="w-6 h-6 bg-copernicus-phosphor/20 rounded-sm flex items-center justify-center phosphor-glow-border">
          <span className="text-copernicus-phosphor font-black text-[10px]">C</span>
        </div>
      </div>

      {/* Main Navigation */}
      <div className="flex flex-col items-center w-full">
        <NavItem id="planner" icon={Kanban} label="Planner" />
        <NavItem id="designer" icon={Palette} label="Designer" />
        <NavItem id="editor" icon={Code} label="Editor" />
        <NavItem id="orchestrator" icon={Workflow} label="Orchestrator" />
      </div>

      <div className="flex-1" />

      {/* Bottom Tools */}
      <div className="flex flex-col items-center w-full pb-2">
        <NavItem id="command-center" icon={Monitor} label="Telemetry" />
        <NavItem id="memory" icon={Brain} label="Memory Browser" />
        <NavItem id="reporter" icon={BarChart2} label="Reports" />
        <NavItem id="github" icon={Github} label="GitHub" />
        <button className="w-12 h-12 flex items-center justify-center text-zinc-600 hover:text-zinc-300 transition-colors" title="Settings">
          <Settings size={18} />
        </button>
      </div>
    </aside>
  )
}
