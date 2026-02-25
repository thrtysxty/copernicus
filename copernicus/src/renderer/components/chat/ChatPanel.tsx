import React, { useState, useEffect, useRef } from 'react'
import { Send, Hash, FileText, Paperclip, ChevronDown } from 'lucide-react'
import { ChatMessage } from './ChatMessage'
import { ContextChip } from './ContextChip'

const ipcRenderer = (window as any).ipcRenderer

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  tokens?: number // Representing total output tokens
}

export const ChatPanel: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [model, _setModel] = useState('claude-3-5-sonnet-20240620')
  const [context, setContext] = useState<string[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const streamingIdRef = useRef<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  useEffect(() => {
    const removeToken = ipcRenderer.on(
      'chat:token',
      ({ sessionId, token }: { sessionId: string; token: string }) => {
        if (sessionId !== streamingIdRef.current) return
        setMessages(prev => {
          const updated = [...prev]
          const last = updated[updated.length - 1]
          if (last?.role === 'assistant') {
            updated[updated.length - 1] = { ...last, content: last.content + token }
          }
          return updated
        })
      }
    )

    const removeDone = ipcRenderer.on(
      'chat:done',
      ({ sessionId, outputTokens }: { sessionId: string; outputTokens: number }) => {
        if (sessionId !== streamingIdRef.current) return
        setIsStreaming(false)
        streamingIdRef.current = null
        setMessages(prev => {
          const updated = [...prev]
          const last = updated[updated.length - 1]
          if (last?.role === 'assistant') {
            updated[updated.length - 1] = { ...last, tokens: outputTokens }
          }
          return updated
        })
      }
    )

    const removeError = ipcRenderer.on(
      'chat:error',
      ({ sessionId, error }: { sessionId: string; error: string }) => {
        if (sessionId !== streamingIdRef.current) return
        setIsStreaming(false)
        streamingIdRef.current = null
        setMessages(prev => {
          const updated = [...prev]
          const last = updated[updated.length - 1]
          if (last?.role === 'assistant') {
            updated[updated.length - 1] = {
              ...last,
              content: `⚠ Error: ${error}`,
            }
          }
          return updated
        })
      }
    )

    return () => {
      removeToken()
      removeDone()
      removeError()
    }
  }, [])

  const handleSendMessage = async () => {
    if ((!input.trim() && context.length === 0) || isStreaming) return

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input
    }

    setMessages(prev => [...prev, userMsg])
    const currentInput = input.trim();
    const currentEnrichedInput = currentInput; // Placeholder for context attachment logic
    setInput('')
    setContext([])

    // Slash Command Handling
    if (currentInput.startsWith('/audit')) {
        ipcRenderer.send('command:audit');
        return;
    }

    // Context Injection Handling
    let enrichedContent = currentEnrichedInput;
    if (currentInput.includes('@help')) {
        try {
            const helpContent = await ipcRenderer.invoke('fs:read-file', 'docs/help/USER_GUIDE.md');
            enrichedContent = enrichedContent.replace('@help', `\n\n[CONTEXT: OPERATOR MANUAL]\n${helpContent}\n`);
        } catch (e) {
            console.error('Failed to inject @help context:', e);
        }
    }

    // Resolves AC 4: Real LLM Integration
    const sessionId = `chat-${Date.now()}`
    streamingIdRef.current = sessionId
    setIsStreaming(true)

    // Add placeholder assistant message
    setMessages(prev => [...prev, {
      id: `msg-${Date.now()}`,
      role: 'assistant',
      content: '',
    }])

    // Prepare history for API
    const history = messages.map(m => ({ role: m.role, content: m.content }))

    ipcRenderer.invoke('chat:send', {
      sessionId,
      messages: [...history, { role: 'user', content: enrichedContent }],
      model,
    }).catch((err: any) => {
      console.error('[ChatPanel] chat:send failed:', err)
      setIsStreaming(false)
      streamingIdRef.current = null
    })
  }

  return (
    <div className="flex flex-col h-full bg-copernicus-bg text-zinc-300 font-mono">
      {/* Chat Header / Model Selector */}
      <div className="h-8 flex items-center justify-between px-2 bg-copernicus-bg border-b border-hairline border-copernicus-steel">
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase text-zinc-500 font-bold tracking-tighter">Planning_Chat</span>
          <div className="flex items-center bg-zinc-900 border border-copernicus-steel rounded px-1.5 py-0.5 cursor-pointer hover:border-copernicus-phosphor transition-colors group">
            <span className="text-[9px] text-copernicus-phosphor">{model}</span>
            <ChevronDown size={10} className="text-zinc-600 group-hover:text-copernicus-phosphor" />
          </div>
        </div>
        <div className="text-[9px] text-zinc-600 uppercase">Strategic_Context_Active</div>
      </div>

      {/* Message Stream */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-thin scrollbar-thumb-copernicus-steel">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center opacity-20 grayscale grayscale-100">
            <Hash size={48} className="text-copernicus-phosphor mb-4" />
            <div className="text-[10px] uppercase tracking-[0.2em]">Awaiting_Strategic_Input</div>
          </div>
        ) : (
          messages.map(m => <ChatMessage key={m.id} {...m} />)
        )}
      </div>

      {/* Context Area (Chips) */}
      {context.length > 0 && (
        <div className="px-2 py-1 flex flex-wrap gap-1 bg-zinc-900/50 border-t border-hairline border-copernicus-steel">
          {context.map(c => <ContextChip key={c} label={c} onRemove={() => setContext(prev => prev.filter(i => i !== c))} />)}
        </div>
      )}

      {/* Input Area */}
      <div className="p-2 bg-copernicus-bg border-t border-hairline border-copernicus-steel">
        <div className="relative flex flex-col bg-zinc-900 border border-copernicus-steel focus-within:border-copernicus-phosphor transition-all rounded p-1.5">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSendMessage())}
            placeholder={isStreaming ? "Streaming in progress..." : "Type strategic intent... (@file to attach context)"}
            disabled={isStreaming}
            className="w-full bg-transparent border-none focus:ring-0 text-xs text-zinc-300 resize-none min-h-[40px] max-h-[200px] disabled:opacity-50"
          />
          <div className="flex items-center justify-between mt-1 pt-1 border-t border-copernicus-steel/20">
            <div className="flex gap-2 text-zinc-500">
              <button className="hover:text-copernicus-phosphor transition-colors" title="Attach File (@)" disabled={isStreaming}><Paperclip size={12} /></button>
              <button className="hover:text-copernicus-phosphor transition-colors" title="Attach Story (#)" disabled={isStreaming}><FileText size={12} /></button>
            </div>
            <button 
              onClick={handleSendMessage}
              disabled={isStreaming}
              className="p-1 hover:text-copernicus-phosphor text-zinc-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Send size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
