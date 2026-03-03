import React, { useEffect, useState } from 'react'
import { Book } from 'lucide-react'
import { useIpcError } from '../hooks/useIpcError'
import { unwrapIpc } from '../types/ipc'

export const HelpPanel: React.FC = () => {
  const invoke = useIpcError()
  const [content, setContent] = useState<string>('Loading Manual...')

  useEffect(() => {
    const fetchManual = async () => {
      try {
        const _raw = await invoke<any>('app:get-user-guide')
        const text: string = unwrapIpc<any>(_raw) ?? ''
        setContent(text || 'Guide not found.')
      } catch (e) {
        setContent('Error loading user guide.')
      }
    }
    fetchManual()
  }, [])

  return (
    <div className="flex flex-col h-full bg-copernicus-bg overflow-hidden border-hairline border-copernicus-steel">
      <div className="h-8 flex items-center justify-between px-3 bg-copernicus-bg border-b border-hairline border-copernicus-steel">
        <div className="flex items-center gap-2 text-copernicus-phosphor">
          <Book size={14} />
          <span className="text-[10px] font-bold uppercase tracking-widest">Help // User Guide</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 font-mono selection:bg-copernicus-phosphor/30">
        <div className="max-w-3xl mx-auto prose prose-invert prose-phosphor">
          {/* Simple Markdown Rendering Logic */}
          {content.split('\n').map((line, i) => {
            if (line.startsWith('# ')) return <h1 key={i} className="text-2xl font-bold text-copernicus-phosphor mb-4 border-b border-copernicus-steel pb-2">{line.slice(2)}</h1>
            if (line.startsWith('## ')) return <h2 key={i} className="text-lg font-bold text-copernicus-phosphor mt-8 mb-3">{line.slice(3)}</h2>
            if (line.startsWith('### ')) return <h3 key={i} className="text-md font-bold text-zinc-300 mt-6 mb-2 uppercase tracking-tight">{line.slice(4)}</h3>
            if (line.startsWith('* ')) return <div key={i} className="flex gap-2 ml-4 mb-1 text-zinc-400"><span>•</span><span>{line.slice(2)}</span></div>
            if (line.trim() === '---') return <hr key={i} className="border-copernicus-steel my-8" />
            if (line.startsWith('|')) return <div key={i} className="font-mono text-[11px] bg-zinc-900/50 p-1 border-x border-copernicus-steel">{line}</div>
            return <p key={i} className="text-zinc-400 text-sm leading-relaxed mb-3">{line}</p>
          })}
        </div>
      </div>

      <div className="h-6 bg-copernicus-bg border-t border-hairline border-copernicus-steel flex items-center px-2 justify-between">
        <span className="text-[9px] text-zinc-600 uppercase">Copernicus Guide v0.1.0</span>
        <span className="text-[9px] text-copernicus-phosphor/50">Industrial Agentic Standard</span>
      </div>
    </div>
  )
}
