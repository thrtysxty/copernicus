import React from 'react'
import { clsx } from 'clsx'

interface ChatMessageProps {
  role: 'user' | 'assistant'
  content: string
  tokens?: { in: number; out: number; cost: number }
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ role, content, tokens }) => {
  return (
    <div className={clsx(
      'flex flex-col max-w-[85%] group animate-in fade-in slide-in-from-bottom-2 duration-300',
      role === 'user' ? 'ml-auto items-end' : 'mr-auto items-start'
    )}>
      {/* Role Label */}
      <div className="flex items-center gap-2 mb-1 px-1">
        <span className={clsx(
          'text-[8px] uppercase tracking-widest font-bold',
          role === 'user' ? 'text-zinc-500' : 'text-copernicus-phosphor'
        )}>
          {role === 'user' ? 'DEVELOPER' : 'STRATEGIC_CORE'}
        </span>
      </div>

      {/* Message Bubble */}
      <div className={clsx(
        'p-3 text-xs leading-relaxed border transition-all duration-300',
        role === 'user' 
          ? 'bg-zinc-900/50 border-copernicus-steel text-zinc-300 rounded-l-md rounded-tr-md' 
          : 'bg-[#080808] border-copernicus-phosphor/20 text-zinc-200 rounded-r-md rounded-tl-md shadow-[0_0_15px_rgba(74,222,128,0.03)]'
      )}>
        <p className="whitespace-pre-wrap">{content}</p>
      </div>

      {/* Token Telemetry (Assistant Only) */}
      {role === 'assistant' && tokens && (
        <div className="mt-1 flex items-center gap-2 text-[8px] text-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity">
          <span>↑ {tokens.in} TOKENS</span>
          <span className="text-copernicus-steel">|</span>
          <span>↓ {tokens.out} TOKENS</span>
          <span className="text-copernicus-steel">|</span>
          <span className="text-copernicus-phosphor/60">${tokens.cost.toFixed(4)}</span>
        </div>
      )}
    </div>
  )
}
