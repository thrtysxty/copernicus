import React from 'react'
import { clsx } from 'clsx'
import { useIpcError } from '../../hooks/useIpcError'

interface ChatMessageProps {
  role: 'user' | 'assistant' | 'copernicus'
  content: React.ReactNode
  tokens?: { in: number; out: number; cost: number }
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ role, content, tokens }) => {
  const invoke = useIpcError()
  const ariaLabel = typeof content === 'string' 
    ? `${role}: ${content.substring(0, 80)}${content.length > 80 ? '...' : ''}`
    : `${role} message`

  return (
    <div 
      role="article"
      aria-label={ariaLabel}
      className={clsx(
      'flex flex-col max-w-[85%] group animate-in fade-in slide-in-from-bottom-2 duration-300',
      role === 'user' ? 'ml-auto items-end' : 'mr-auto items-start'
    )}>
      {/* Role Label */}
      <div className="flex items-center gap-2 mb-1 px-1">
        <span className={clsx(
          'text-[11px] uppercase tracking-widest font-bold',
          role === 'user' ? 'text-zinc-500' : 
          role === 'copernicus' ? 'text-copernicus-phosphor' : 'text-blue-400'
        )}>
          {role === 'user' ? 'DEVELOPER' : 'COPERNICUS'}
        </span>
      </div>

      {/* Message Bubble */}
      <div className={clsx(
        'p-3 text-xs leading-relaxed border transition-all duration-300',
        role === 'user'
          ? 'bg-zinc-900/50 border-copernicus-steel text-zinc-300 rounded-l-md rounded-tr-md'
          : role === 'copernicus'
          ? 'bg-copernicus-phosphor/5 border-copernicus-phosphor/20 text-zinc-200 rounded-r-md rounded-tl-md shadow-[0_0_15px_rgba(74,222,128,0.03)]'
          : 'bg-[#080808] border-blue-400/20 text-zinc-200 rounded-r-md rounded-tl-md'
      )}>
        <div className="whitespace-pre-wrap">{content}</div>
      </div>

      {/* Token Telemetry & Actions (Assistant Only) */}
      {role === 'assistant' && (
        <div className="mt-1 flex items-center justify-between w-full text-[11px] opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="flex items-center gap-2 text-zinc-600">
            {tokens && (
              <>
                <span>↑ {tokens.in} TOKENS</span>
                <span className="text-copernicus-steel">|</span>
                <span>↓ {tokens.out} TOKENS</span>
                <span className="text-copernicus-steel">|</span>
                <span className="text-copernicus-phosphor/60">${tokens.cost.toFixed(4)}</span>
              </>
            )}
          </div>
          <button
            onClick={() => {
              if (typeof content === 'string') {
                invoke('db:add-memory', { content, importance: 7, source: 'manual' }).catch(() => {})
              }
            }}
            title="Save to Memory"
            className="hover:text-copernicus-phosphor text-zinc-500 transition-colors focus:outline-none"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z"/>
              <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z"/>
            </svg>
          </button>
        </div>
      )}
    </div>
  )
}
