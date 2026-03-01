import React from 'react'
import { Layout, CheckCircle2 } from 'lucide-react'

export const UIUpdateChip: React.FC = () => {
  return (
    <div className="my-2 flex items-center gap-2 p-2 bg-green-500/10 border border-green-500/20 rounded-lg animate-in fade-in slide-in-from-left-2">
      <div className="p-1.5 rounded bg-green-500/20 text-green-400">
        <Layout size={14} />
      </div>
      <div>
        <div className="text-[10px] font-bold text-green-400 uppercase tracking-widest flex items-center gap-1.5">
          UI Component Tree Updated
          <CheckCircle2 size={10} />
        </div>
        <p className="text-[9px] text-zinc-500 font-mono">The visual builder has been synchronised with agent suggestions.</p>
      </div>
    </div>
  )
}
