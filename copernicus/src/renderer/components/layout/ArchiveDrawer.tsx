import React, { useState, useEffect } from 'react'
import { Maximize2, RotateCcw, ChevronDown, Archive } from 'lucide-react'
import { useWorkspaceStore } from '../../store/workspace'
import { useIpcError } from '../../hooks/useIpcError'
import { unwrapIpc } from '../../types/ipc'

export const ArchiveDrawer: React.FC = () => {
  const invoke = useIpcError()
  const [archived, setArchived] = useState<{ id: string; title: string; date?: string }[]>([])
  const setTerminalOpen = useWorkspaceStore(s => s.setTerminalOpen)
  const toggleArchive = useWorkspaceStore(s => s.toggleArchive)
  const setSpotlight = useWorkspaceStore(s => s.setSpotlight)
  const spotlightPane = useWorkspaceStore(s => s.spotlightPane)

  useEffect(() => {
    invoke('stories:list', { status: 'ARCHIVED' })
      .then((res: any) => {
        const list = unwrapIpc<any>(res) ?? []
        if (Array.isArray(list)) setArchived(list)
      })
      .catch(() => {})
  }, [invoke])

  return (
    <div className="h-full flex flex-col bg-[#050505]">
      <div className="h-8 flex items-center border-t border-zinc-700 border-b border-copernicus-steel px-0 shrink-0 bg-[#080808]">
        <div className="flex-1 flex items-center px-3">
          <Archive size={10} className="text-copernicus-phosphor mr-2" />
          <span className="text-[11px] font-mono text-zinc-500 uppercase tracking-widest">Archive</span>
        </div>
        <div className="flex items-center gap-2 px-3 shrink-0">
          <button
            onClick={() => { toggleArchive() }}
            className="text-zinc-600 hover:text-zinc-300 transition-colors opacity-60 hover:opacity-100"
            title="Switch to Terminal"
          >
            <RotateCcw size={12} />
          </button>
          <button
            onClick={() => setSpotlight(spotlightPane === 'terminal' ? null : 'terminal')}
            className="text-zinc-600 hover:text-zinc-300 transition-colors opacity-60 hover:opacity-100"
            title="Spotlight"
          >
            <Maximize2 size={12} />
          </button>
          <button
            onClick={() => setTerminalOpen(false)}
            className="text-copernicus-phosphor hover:text-zinc-300 transition-colors opacity-60 hover:opacity-100"
            title="Close Archive"
          >
            <ChevronDown size={12} />
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-2 space-y-1">
        {!archived.length && (
          <p className="text-[11px] text-zinc-700 italic mt-2">No archived stories.</p>
        )}
        {archived.map(s => (
          <div key={s.id} className="flex items-center gap-3 text-[11px] font-mono text-zinc-600">
            <span className="text-zinc-700">{s.id}</span>
            <span className="truncate text-zinc-500">{s.title}</span>
            <span className="ml-auto text-zinc-700 shrink-0">{s.date ?? ''}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
