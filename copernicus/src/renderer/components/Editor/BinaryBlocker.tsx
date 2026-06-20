import { ShieldOff } from 'lucide-react'

export function BinaryBlocker({ filePath }: { filePath: string | null }) {
  const ext = filePath?.split('.').pop()?.toUpperCase() ?? 'BINARY'
  const name = filePath?.split('/').pop() ?? 'Unknown file'

  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-[#050505] p-8 text-center">
      <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-6 border border-red-500/20">
        <ShieldOff size={32} className="text-red-500/60" />
      </div>
      <h2 className="text-sm font-bold text-zinc-200 uppercase tracking-widest mb-2">
        Binary File Blocked
      </h2>
      <p className="text-[11px] text-zinc-500 font-mono mb-6 max-w-xs leading-relaxed">
        The file <span className="text-zinc-300">"{name}"</span> is a {ext} binary. 
        Copernicus Editor does not support direct binary manipulation to prevent accidental corruption.
      </p>
      <div className="px-3 py-1 rounded border border-zinc-800 bg-zinc-900/50 text-[11px] text-zinc-600 font-mono uppercase tracking-tighter">
        Security_Protocol_Alpha_Active
      </div>
    </div>
  )
}
