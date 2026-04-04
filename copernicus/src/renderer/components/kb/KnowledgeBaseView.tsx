import React from 'react'

export const KnowledgeBaseView: React.FC = () => {
  return (
    <div className="flex h-full w-full bg-copernicus-bg text-zinc-300 font-sans overflow-hidden">
      {/* Sidebar for Content Tree */}
      <div className="w-64 flex flex-col border-r border-copernicus-steel bg-[#080808] shrink-0">
        <header className="h-8 px-3 border-b border-white/5 shrink-0 flex items-center bg-black/20">
          <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Knowledge Base</span>
        </header>
        <div className="flex-1 p-4 overflow-y-auto">
          <div className="text-[10px] text-zinc-600 font-mono italic">
            Content tree placeholder
          </div>
        </div>
      </div>

      {/* Main Area for Articles */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#050505]">
        <header className="h-8 px-3 border-b border-white/5 shrink-0 flex items-center bg-black/20">
          <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Article</span>
        </header>
        <div className="flex-1 p-6 overflow-y-auto">
          <div className="text-[10px] text-zinc-600 font-mono italic">
            Article area placeholder
          </div>
        </div>
      </div>
    </div>
  )
}
