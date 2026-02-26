import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Send, Hash, FileText, Paperclip, ChevronDown } from 'lucide-react'
import { ChatMessage } from './ChatMessage'
import { ContextChip } from './ContextChip'
import { commandRegistry, CommandContext, Command } from '../../commands/registry'
import { DiffViewer } from '../Editor/DiffViewer'
import { useIpcError } from '../../hooks/useIpcError'

const ipcRenderer = (window as any).ipcRenderer

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  tokens?: number // Representing total output tokens
}

interface ContextItem {
  type: 'file' | 'story' | 'help'
  label: string
  content: string
}

interface ChatPanelProps {
  openFilePath?: string | null
  rootPath?: string
}

// ── CodeBlock Sub-component ────────────────────────────────────────────────

interface CodeBlockProps {
  language: string
  code: string
  openFilePath: string | null
  onApply?: (code: string) => void
}

const CodeBlock: React.FC<CodeBlockProps> = ({ language, code, openFilePath, onApply }) => {
  const invoke = useIpcError()
  const [applyError, setApplyError] = useState('')
  const [applied, setApplied] = useState(false)
  const [showDiff, setShowDiff] = useState(false)
  const [existingContent, setExistingContent] = useState('')

  const handleApply = async () => {
    if (!openFilePath) {
      setApplyError('No file open — open a file in the editor first')
      return
    }
    setApplyError('')
    try {
      const result = await invoke<{ ok: boolean; data?: string; error?: string }>('fs:open-file', openFilePath)
      if (result.ok && result.data !== undefined) {
        setExistingContent(result.data)
        setShowDiff(true)
      } else {
        // File might be new or unreadable — proceed directly to apply
        confirmApply()
      }
    } catch {
      // Error already toasted by useIpcError
    }
  }

  const confirmApply = () => {
    setShowDiff(false)
    invoke<{ ok: boolean; error?: string }>('fs:save-file', { filePath: openFilePath, content: code })
      .then((result) => {
        if (result.ok) {
          setApplied(true)
          onApply?.(code)
          setTimeout(() => setApplied(false), 2000)
        } else if (result.error) {
          setApplyError(result.error)
        }
      })
      .catch(() => { /* error already toasted */ })
  }

  return (
    <div className="relative group my-2">
      <div className="flex items-center justify-between bg-[#1a1a1a] border border-copernicus-steel/50 rounded-t px-3 py-1">
        <span className="text-[9px] text-zinc-500 uppercase">{language || 'code'}</span>
        <button
          onClick={handleApply}
          className={`text-[9px] px-2 py-0.5 rounded font-mono uppercase tracking-wider transition-colors
            ${applied
              ? 'bg-copernicus-phosphor/20 text-copernicus-phosphor'
              : 'bg-zinc-700 text-zinc-300 hover:bg-copernicus-phosphor/20 hover:text-copernicus-phosphor'
            }`}
        >
          {applied ? '✓ Applied' : 'Apply'}
        </button>
      </div>
      <pre className="bg-[#111] border border-t-0 border-copernicus-steel/50 rounded-b p-3 overflow-x-auto text-xs text-zinc-300 whitespace-pre-wrap">
        <code>{code}</code>
      </pre>
      {applyError && (
        <div className="text-[10px] text-red-400 mt-1">{applyError}</div>
      )}
      {showDiff && (
        <DiffViewer
          original={existingContent}
          modified={code}
          language={language}
          onConfirm={confirmApply}
          onCancel={() => setShowDiff(false)}
        />
      )}
    </div>
  )
}

// ── Main ChatPanel Component ───────────────────────────────────────────────

export const ChatPanel: React.FC<ChatPanelProps> = ({ openFilePath = null, rootPath = '' }) => {
  const invoke = useIpcError()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [model, setModel] = useState('claude-3-5-sonnet-20240620')
  const [context, setContext] = useState<ContextItem[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  
  const [slashSuggestions, setSlashSuggestions] = useState<Command[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)

  // Picker state
  type PickerMode = 'none' | 'file' | 'story'
  const [pickerMode, setPickerMode] = useState<PickerMode>('none')
  const [pickerResults, setPickerResults] = useState<Array<{ label: string; value: string; payload: string }>>([])

  const streamingIdRef = useRef<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  useEffect(() => {
    if (!ipcRenderer) return

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

  const handlePickerSelect = useCallback(async (item: { label: string; value: string; payload: string }) => {
    const currentMode = pickerMode
    setPickerMode('none')
    setPickerResults([])

    let injectedContent = item.payload

    if (currentMode === 'file') {
      try {
        const result = await invoke<{ ok: boolean; data?: string; error?: string }>('fs:open-file', item.value)
        if (result.ok && result.data !== undefined) {
          injectedContent = result.data
        } else {
          injectedContent = `[Failed to read ${item.label}: ${result.error}]`
        }
      } catch {
        injectedContent = `[Failed to read ${item.label}]`
      }
      setContext(prev => [...prev, {
        type: 'file',
        label: item.label,
        content: `\n// File: ${item.value}\n${injectedContent}\n`,
      }])
    } else if (currentMode === 'story') {
      setContext(prev => [...prev, {
        type: 'story',
        label: item.label,
        content: injectedContent,
      }])
    }

    // Remove the @query or #query from the input
    const atMarker = currentMode === 'file' ? '@' : '#'
    setInput(prev => {
      const idx = prev.lastIndexOf(atMarker)
      return idx !== -1 ? prev.slice(0, idx) : prev
    })
  }, [pickerMode, invoke])

  const handleSendMessage = async () => {
    if ((!input.trim() && context.length === 0) || isStreaming) return

    const currentInput = input.trim();
    
    // Build the CommandContext that registry commands can use
    const cmdContext: CommandContext = {
      appendMessage: (role, content) =>
        setMessages(prev => [...prev, { id: `msg-${Date.now()}`, role, content }]),
      clearMessages: () => setMessages([]),
      setModel: (m) => setModel(m),
      getCurrentModel: () => model,
    }

    // Try slash command first
    if (currentInput.startsWith('/')) {
      const handled = commandRegistry.execute(currentInput, cmdContext)
      if (handled) {
        setInput('')
        setShowSuggestions(false)
        return
      }
    }

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input
    }

    setMessages(prev => [...prev, userMsg])
    
    // Enrich with context
    let enrichedContent = currentInput
    if (context.length > 0) {
      const contextBlocks = context.map(c => `[CONTEXT: ${c.type.toUpperCase()} - ${c.label}]\n${c.content}`).join('\n\n')
      enrichedContent = `${contextBlocks}\n\n---\n\nUSER_INPUT: ${currentInput}`
    }

    setInput('')
    setContext([])

    // Context Injection Handling for legacy @help
    if (currentInput.includes('@help')) {
        try {
            const result = await invoke<{ ok: boolean; data?: string }>('fs:open-file', 'docs/help/USER_GUIDE.md');
            if (result.ok && result.data) {
              enrichedContent = enrichedContent.replace('@help', `\n\n[CONTEXT: OPERATOR MANUAL]\n${result.data}\n`);
            }
        } catch (e) {
            console.error('Failed to inject @help context:', e);
        }
    }

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

    invoke('chat:send', {
      sessionId,
      messages: [...history, { role: 'user', content: enrichedContent }],
      model,
    }).catch((err: any) => {
      console.error('[ChatPanel] chat:send failed:', err)
      setIsStreaming(false)
      streamingIdRef.current = null
    })
  }

  function renderMessageContent(
    content: string,
    openPath: string | null
  ): React.ReactNode {
    const parts = content.split(/(```[\w]*\n[\s\S]*?```)/g)
    return parts.map((part, i) => {
      const match = part.match(/^```([\w]*)\n([\s\S]*?)```$/)
      if (match) {
        return (
          <CodeBlock
            key={i}
            language={match[1]}
            code={match[2]}
            openFilePath={openPath}
          />
        )
      }
      return <span key={i} className="whitespace-pre-wrap">{part}</span>
    })
  }

  return (
    <div className="flex flex-col h-full bg-copernicus-bg text-zinc-300 font-mono">
      {/* Chat Header / Model Selector */}
      <div className="h-8 flex items-center justify-between px-2 bg-copernicus-bg border-b border-hairline border-copernicus-steel">
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase text-zinc-500 font-bold tracking-tighter">Planning_Chat</span>
          <div className="flex items-center bg-zinc-900 border border-copernicus-steel rounded px-1.5 py-0.5 cursor-pointer hover:border-copernicus-phosphor transition-colors group" onClick={() => {}}>
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
          messages.map(m => (
            <ChatMessage 
              key={m.id} 
              role={m.role} 
              content={m.role === 'assistant' ? renderMessageContent(m.content, openFilePath) : m.content} 
              tokens={m.tokens ? { in: 0, out: m.tokens, cost: 0 } : undefined} 
            />
          ))
        )}
      </div>

      {/* Context Area (Chips) */}
      {context.length > 0 && (
        <div className="px-2 py-1 flex flex-wrap gap-1 bg-zinc-900/50 border-t border-hairline border-copernicus-steel">
          {context.map(c => <ContextChip key={c.label} label={c.label} onRemove={() => setContext(prev => prev.filter(i => i.label !== c.label))} />)}
        </div>
      )}

      {/* Input Area */}
      <div className="p-2 bg-copernicus-bg border-t border-hairline border-copernicus-steel">
        <div className="relative flex flex-col bg-zinc-900 border border-copernicus-steel focus-within:border-copernicus-phosphor transition-all rounded p-1.5">
          {/* Slash Suggestions */}
          {showSuggestions && slashSuggestions.length > 0 && (
            <div className="absolute bottom-full left-0 right-0 mb-1 bg-[#111] border border-copernicus-steel rounded overflow-hidden z-50">
              {slashSuggestions.map(cmd => (
                <button
                  key={cmd.name}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-copernicus-phosphor/10 flex items-center gap-3"
                  onClick={() => {
                    setInput(cmd.name + ' ')
                    setShowSuggestions(false)
                  }}
                >
                  <span className="text-copernicus-phosphor font-mono">{cmd.name}</span>
                  <span className="text-zinc-500">{cmd.description}</span>
                </button>
              ))}
            </div>
          )}

          {/* Context Picker Popover */}
          {pickerMode !== 'none' && pickerResults.length > 0 && (
            <div className="absolute bottom-full left-0 right-0 mb-1 bg-[#111] border border-copernicus-steel rounded overflow-hidden z-50 max-h-48 overflow-y-auto">
              <div className="px-3 py-1 text-[9px] text-zinc-500 uppercase tracking-widest border-b border-copernicus-steel">
                {pickerMode === 'file' ? '@ File Context' : '# Story Context'}
              </div>
              {pickerResults.map(item => (
                <button
                  key={item.value}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-copernicus-phosphor/10 transition-colors"
                  onClick={() => handlePickerSelect(item)}
                >
                  <span className="text-zinc-300">{item.label}</span>
                  <span className="text-zinc-600 ml-2 text-[10px] truncate">{item.value}</span>
                </button>
              ))}
            </div>
          )}

          <textarea
            value={input}
            onChange={(e) => {
              const newValue = e.target.value
              setInput(newValue)

              // Slash suggestions logic
              if (newValue.startsWith('/') && !newValue.includes(' ')) {
                const suggestions = commandRegistry.suggest(newValue)
                setSlashSuggestions(suggestions)
                setShowSuggestions(suggestions.length > 0)
              } else {
                setShowSuggestions(false)
              }

              // Context Picker logic
              const atIndex = newValue.lastIndexOf('@')
              const hashIndex = newValue.lastIndexOf('#')

              if (atIndex !== -1 && atIndex >= hashIndex && !newValue.slice(atIndex).includes(' ')) {
                const query = newValue.slice(atIndex + 1)
                setPickerMode('file')
                invoke<{ ok: boolean; data: any[] }>('fs:list-dir', rootPath ?? '').then((result) => {
                  if (result.ok) {
                    const filtered = result.data.filter(n =>
                      !n.isDir && n.name.toLowerCase().includes(query.toLowerCase())
                    )
                    setPickerResults(filtered.map(n => ({
                      label: n.name,
                      value: n.path,
                      payload: n.path,
                    })))
                  }
                }).catch(console.error)
              } else if (hashIndex !== -1 && hashIndex > atIndex && !newValue.slice(hashIndex).includes(' ')) {
                const query = newValue.slice(hashIndex + 1)
                setPickerMode('story')
                invoke<any[]>('stories:list').then((stories) => {
                  const filtered = stories.filter((s: any) =>
                    s.id?.toLowerCase().includes(query.toLowerCase()) ||
                    s.title?.toLowerCase().includes(query.toLowerCase())
                  )
                  setPickerResults(filtered.map((s: any) => ({
                    label: s.title ?? s.id,
                    value: s.id,
                    payload: s.content ?? '',
                  })))
                }).catch(console.error)
              } else {
                setPickerMode('none')
              }
            }}
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
