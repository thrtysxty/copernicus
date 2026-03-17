import React from 'react'
import { 
  GitBranch, 
  Search, 
  CheckCircle, 
  Box, 
  Monitor,
  ChevronRight,
  ChevronDown,
  ChevronLeft
} from 'lucide-react'
import { ORCHESTRATOR_TILES } from './tiles'
import { OrchestratorTile } from '../../store/orchestrator'

const ICON_MAP: Record<string, any> = {
  'GitBranch': GitBranch,
  'MagnifyingGlass': Search,
  'CheckCircle': CheckCircle,
  'Cube': Box,
  'Browser': Monitor,
}

const CATEGORY_LABELS: Record<string, string> = {
  vcs: 'Source Control',
  search: 'Search & Index',
  review: 'Quality & Review',
  container: 'Infrastructure',
  browser: 'Browser Automation',
}

const CategorySection: React.FC<{ 
  category: string; 
  tiles: OrchestratorTile[] 
}> = ({ category, tiles }) => {
  const [expanded, setExpanded] = React.useState(true)

  return (
    <div className="mb-4">
      <button 
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center px-3 py-1.5 bg-[#080808] border-b border-zinc-800 hover:bg-zinc-900 transition-colors group"
      >
        {expanded ? <ChevronDown size={10} className="mr-2 text-zinc-500" /> : <ChevronRight size={10} className="mr-2 text-zinc-500" />}
        <span className="text-[10px] font-mono font-bold uppercase tracking-[0.15em] text-zinc-400 group-hover:text-zinc-200">
          {CATEGORY_LABELS[category] || category}
        </span>
      </button>
      
      {expanded && (
        <div className="p-2 grid grid-cols-1 gap-1">
          {tiles.map(tile => {
            const Icon = ICON_MAP[tile.icon] || Box
            return (
              <div
                key={tile.id}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('tile-id', tile.id)
                  e.dataTransfer.effectAllowed = 'copy'
                }}
                className="flex items-center gap-2 px-3 py-2 rounded bg-zinc-900/50 border border-zinc-800/50 
                           hover:bg-zinc-800 hover:border-copernicus-phosphor/30 transition-all cursor-grab active:cursor-grabbing group"
              >
                <Icon size={14} className="text-zinc-500 group-hover:text-copernicus-phosphor" />
                <span className="text-[11px] font-mono text-zinc-400 group-hover:text-zinc-200">{tile.label}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export const TileLibrary: React.FC = () => {
  const [collapsed, setCollapsed] = React.useState(false)
  const tilesByCategory = React.useMemo(() => {
    const groups: Record<string, OrchestratorTile[]> = {}
    ORCHESTRATOR_TILES.forEach(tile => {
      const cat = tile.category
      if (!groups[cat]) groups[cat] = []
      groups[cat].push(tile)
    })
    return groups
  }, [])

  return (
    <aside className={`${collapsed ? 'w-8' : 'w-[220px]'} flex-shrink-0 bg-[#050505] border-r border-copernicus-steel flex flex-col h-full overflow-hidden select-none transition-all duration-200`}>
      <div className="h-9 flex items-center px-3 border-b border-copernicus-steel bg-[#080808] shrink-0">
        {!collapsed && (
          <span className="text-[10px] font-mono uppercase tracking-[0.2em] font-black text-copernicus-phosphor flex-1">
            Tile Library
          </span>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="text-zinc-500 hover:text-copernicus-phosphor transition-colors ml-auto p-1"
        >
          {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
        </button>
      </div>
      
      {!collapsed && (
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {Object.entries(tilesByCategory).map(([category, tiles]) => (
            <CategorySection key={category} category={category} tiles={tiles} />
          ))}
        </div>
      )}
      
      {!collapsed && (
        <div className="p-4 border-t border-zinc-800 bg-[#080808]/50 mt-auto">
          <p className="text-[9px] font-mono text-zinc-600 leading-relaxed uppercase tracking-wider">
            Drag tiles to canvas to add new operations to your workflow.
          </p>
        </div>
      )}
    </aside>
  )
}
