import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Send, Hash, FileText, Paperclip, ChevronDown, Save, RotateCcw, Maximize2, Minimize2, Layout } from 'lucide-react'
import { ChatMessage } from './ChatMessage'
import { ContextChip } from './ContextChip'
import { UIUpdateChip } from './UIUpdateChip'
import { commandRegistry, CommandContext, Command } from '../../commands/registry'
import { DiffViewer } from '../Editor/DiffViewer'
import { useIpcError } from '../../hooks/useIpcError'
import { useLayoutStore } from '../../store/layout'
import log from '../../utils/logger'

const ipcRenderer = window.ipcRenderer

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
  const { setCanvasContent, setUIComponents } = useLayoutStore()

  // AC-8: Auto-apply component updates
  useEffect(() => {
    if (language === 'component-update') {
      try {
        const parsed = JSON.parse(code)
        if (Array.isArray(parsed)) {
          setUIComponents(parsed)
        }
      } catch (e) {
        log.error('Failed to parse component-update', e)
      }
    }
  }, [language, code, setUIComponents])

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
        confirmApply()
      }
    } catch { }
  }

  const handlePreview = () => {
    setCanvasContent(code)
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
      .catch(() => { })
  }

  const isWebCode = ['html', 'javascript', 'typescript', 'jsx', 'tsx', 'css'].includes(language?.toLowerCase())

  if (language === 'component-update') {
    return <UIUpdateChip />
  }

  return (
    <div className="relative group my-2">
      <div className="flex items-center justify-between bg-[#1a1a1a] border border-copernicus-steel/50 rounded-t px-3 py-1">
        <span className="text-[9px] text-zinc-500 uppercase">{language || 'code'}</span>
        <div className="flex gap-2">
          {isWebCode && (
            <button
              onClick={handlePreview}
              className="text-[9px] px-2 py-0.5 rounded font-mono uppercase tracking-wider bg-blue-900/20 text-blue-400 hover:bg-blue-900/40 transition-colors"
            >
              Preview
            </button>
          )}
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
  const [availableModels, setAvailableModels] = useState<any[]>([])
  const [showModelPicker, setShowModelPicker] = useState(false)
  const [context, setContext] = useState<ContextItem[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [isRepoActive, setIsRepoActive] = useState(false)
  const {
    activeStoryId,
    toggleFlip,
    setSpotlight,
    spotlightPane,
    centerMode,
    uiComponents,
    chatPanelTab,
    setChatPanelTab,
    tourStep,
    setTourStep,
    setHasCompletedTour,
    setView,
    setTourHighlight
  } = useLayoutStore()


  const [slashSuggestions, setSlashSuggestions] = useState<Command[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)

  // Picker state
  type PickerMode = 'none' | 'file' | 'story' | 'codebase'
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
    invoke<any>('models:list').then((r: any) => setAvailableModels(r?.data ?? r ?? [])).catch(log.error)

    // Check if session is active (implies repo context)
    invoke<any>('devtime:status').then(res => {
        const d = (res as any)?.data ?? res
        setIsRepoActive(!!(d && d.session))
    })
  }, [invoke])

  useEffect(() => {
    if (!ipcRenderer) return

    const removeToken = ipcRenderer.on(
      'chat:token',
      (_event: any, { sessionId, token }: { sessionId: string; token: string }) => {
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
      (_event: any, { sessionId, outputTokens }: { sessionId: string; outputTokens: number }) => {
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
      (_event: any, { sessionId, error }: { sessionId: string; error: string }) => {
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
    } else if (currentMode === 'codebase') {
      setContext(prev => [...prev, {
        type: 'file',
        label: `@codebase: ${item.label}`,
        content: `\n// Semantic match: ${item.value}\n${injectedContent}\n`,
      }])
    }

    // Remove the @query or #query from the input
    const atMarker = (currentMode === 'file' || currentMode === 'codebase') ? '@' : '#'
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
      const contextBlocks = context.map(c => `[CONTEXT: ${String(c.type || '').toUpperCase()} - ${c.label}]\n${c.content}`).join('\n\n')
      enrichedContent = `${contextBlocks}\n\n---\n\nUSER_INPUT: ${currentInput}`
    }

    // AC-7: UI Builder Context Injection
    if (centerMode === 'builder' && uiComponents.length > 0) {
      const treeJson = JSON.stringify(uiComponents, null, 2)
      enrichedContent += `\n\n<ui-canvas-context>\n${treeJson}\n</ui-canvas-context>`
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
            log.error('Failed to inject @help context:', e);
        }
    }

    const sessionId = `chat-${Date.now()}`
    streamingIdRef.current = sessionId
    setIsStreaming(true)

    // Inject LSP diagnostics for open file if available (Story 189)
    if (openFilePath) {
      try {
        const diagRes = await invoke<any>('lsp:get-diagnostics', openFilePath)
        const diags: any[] = diagRes?.data ?? diagRes ?? []
        if (Array.isArray(diags) && diags.length > 0) {
          const filename = openFilePath.split(/[/\\]/).pop() ?? openFilePath
          const summary = diags.slice(0, 10)
            .map((d: any) => `[${d.severity === 1 ? 'ERROR' : 'WARN'}] L${(d.range?.start?.line ?? 0) + 1}: ${d.message}`)
            .join('\n')
          enrichedContent = `[LSP diagnostics for ${filename}]\n${summary}\n\n---\n\n${enrichedContent}`
        }
      } catch { /* LSP not running — skip */ }
    }

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
      log.error('[ChatPanel] chat:send failed:', err)
      setIsStreaming(false)
      streamingIdRef.current = null
    })
  }

  const handleSaveToStory = async (content: string) => {
    if (!activeStoryId) return;
    try {
      const _rawContent = await invoke<any>('stories:get-content', activeStoryId);
      const currentContent: string = (_rawContent as any)?.data ?? _rawContent ?? '';

      // We want to update the "Implementation" section or append if not found
      let updatedContent = currentContent;
      const implMarker = '## Implementation';

      if (currentContent.includes(implMarker)) {
        const parts = currentContent.split(implMarker);
        updatedContent = `${parts[0]}${implMarker}\n${content}\n`;
      } else {
        updatedContent = `${currentContent}\n\n${implMarker}\n${content}\n`;
      }

      await invoke('stories:update-content', { id: activeStoryId, content: updatedContent });
      // Show success toast? (Assuming toast store is available)
      window.ipcRenderer.send('db:log-intent', `Architected ${activeStoryId} via Chat`, 'COMPLETED', 'chat');
    } catch (e) {
      log.error("Failed to save to story", e);
    }
  };

  function renderMessageContent(
    content: string,
    openPath: string | null
  ): React.ReactNode {
    const parts = content.split(/(```[\w]*\n[\s\S]*?```)/g)
    return (
      <>
        {parts.map((part, i) => {
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
        })}
        {activeStoryId && (
          <button
            onClick={() => handleSaveToStory(content)}
            className="mt-2 flex items-center gap-1.5 text-[9px] text-zinc-500 hover:text-copernicus-phosphor transition-colors uppercase font-bold tracking-wider"
          >
            <Save size={10} /> Save to active story
          </button>
        )}
      </>
    )
  }

  const handleFileAttach = async () => {
    try {
      const filePath = await invoke<string | null>('fs:select-file')
      if (!filePath) return

      const content = await invoke<string>('fs:read-file', filePath)
      if (typeof content !== 'string') return

      setContext(prev => [...prev, {
        type: 'file',
        label: filePath.split(/[/\\]/).pop() ?? filePath,
        content: `\n// File: ${filePath}\n${content}\n`,
      }])
    } catch (err) {
      log.error('[ChatPanel] File attach failed:', err)
    }
  }

  const triggerPicker = async (mode: PickerMode) => {
    setPickerMode(mode)
    if (mode === 'file') {
      const result = await invoke<{ ok: boolean; data: any[] }>('fs:list-dir', rootPath ?? '')
      const data = (result as any).data || result
      if (Array.isArray(data)) {
        setPickerResults(data.filter(n => !n.isDir).map(n => ({
          label: n.name,
          value: n.path,
          payload: n.path,
        })))
      }
    } else if (mode === 'story') {
      const stories = await invoke<any[]>('stories:list')
      const data = (stories as any).data || stories
      if (Array.isArray(data)) {
        setPickerResults(data.map((s: any) => ({
          label: s.title ?? s.id,
          value: s.id,
          payload: s.content ?? '',
        })))
      }
    }
  }

  return (
    <div className="flex flex-col h-full bg-copernicus-bg text-zinc-300 font-mono">
      {/* Tabs Header */}
      <div className="flex bg-[#0A0A0A] border-b border-copernicus-steel h-9">
        <button
          onClick={() => setChatPanelTab('chat')}
          className={`flex-1 flex items-center justify-center gap-2 text-[10px] font-bold tracking-widest uppercase transition-colors relative ${chatPanelTab === 'chat' ? 'text-copernicus-phosphor' : 'text-zinc-500 hover:text-zinc-300'}`}
        >
          CHAT
          {chatPanelTab === 'chat' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-copernicus-phosphor" />}
        </button>
        <button
          onClick={() => setChatPanelTab('guide')}
          className={`flex-1 flex items-center justify-center gap-2 text-[10px] font-bold tracking-widest uppercase transition-colors relative ${chatPanelTab === 'guide' ? 'text-copernicus-phosphor' : 'text-zinc-500 hover:text-zinc-300'}`}
        >
          GUIDE
          {chatPanelTab === 'guide' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-copernicus-phosphor" />}
        </button>
      </div>

      {chatPanelTab === 'chat' ? (
        <>
          {/* Redesigned Header */}
          <div className="h-6 flex items-center justify-between px-2 bg-copernicus-bg border-b border-hairline border-copernicus-steel select-none group">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <span className="text-[10px] uppercase text-zinc-500 font-bold tracking-widest flex-none">Chat</span>
              
              <div className="relative min-w-0 flex-1 max-w-[180px]">
                <div
                    className="flex items-center bg-zinc-900/50 border border-copernicus-steel/50 rounded px-1.5 py-0.5 cursor-pointer hover:border-copernicus-phosphor transition-colors group/picker"
                    onClick={() => setShowModelPicker(!showModelPicker)}
                >
                    <span className="text-[9px] text-copernicus-phosphor truncate flex-1">{model}</span>
                    <ChevronDown size={10} className="text-zinc-600 group-hover/picker:text-copernicus-phosphor flex-none ml-1" />
                </div>

                {showModelPicker && (
                    <div className="absolute top-full left-0 mt-1 w-64 bg-[#111] border border-copernicus-steel rounded shadow-xl z-[100] max-h-64 overflow-y-auto">
                    <div className="px-3 py-1.5 text-[9px] text-zinc-500 uppercase tracking-widest border-b border-copernicus-steel font-bold">Select Model</div>
                    {availableModels.map(m => (
                        <button
                        key={m.id}
                        className={`w-full text-left px-3 py-2 text-[10px] hover:bg-copernicus-phosphor/10 transition-colors flex flex-col ${model === m.id ? 'bg-copernicus-phosphor/5 border-l-2 border-copernicus-phosphor' : ''}`}
                        onClick={() => {
                            setModel(m.id)
                            setShowModelPicker(false)
                        }}
                        >
                        <span className={model === m.id ? 'text-copernicus-phosphor' : 'text-zinc-300'}>{m.name}</span>
                        <span className="text-[8px] text-zinc-600 uppercase">{m.provider} • {m.contextWindow.toLocaleString()} tokens</span>
                        </button>
                    ))}
                    </div>
                )}
              </div>

              {/* Context Indicator */}
              <div className="flex items-center gap-1 flex-none" title={isRepoActive ? "Repo Context Active" : "No Repo Context"}>
                 <div className={`w-1.5 h-1.5 rounded-full ${isRepoActive ? 'bg-green-500 shadow-[0_0_5px_rgba(34,197,94,0.5)]' : 'bg-red-500 animate-pulse shadow-[0_0_5px_rgba(239,68,68,0.5)]'}`} />
              </div>
            </div>

            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onClick={() => toggleFlip('chat')} className="text-zinc-500 hover:text-copernicus-phosphor transition-colors" title="Rotate Panel">
                <RotateCcw size={10} />
              </button>
              <button
                onClick={() => setSpotlight(spotlightPane === 'telemetry' ? null : 'telemetry')}
                className="text-zinc-500 hover:text-copernicus-phosphor transition-colors font-bold text-[10px] flex items-center justify-center min-w-[24px]"
                title={spotlightPane === 'telemetry' ? "Exit Spotlight" : "Spotlight Panel"}
              >
                {spotlightPane === 'telemetry' ? <Minimize2 size={10} /> : <Maximize2 size={10} />}
              </button>
            </div>
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
            {centerMode === 'builder' && uiComponents.length > 0 && (
              <div className="flex items-center gap-1.5 px-2 pb-2 text-[8px] text-copernicus-phosphor/60 font-mono uppercase tracking-tighter">
                <Layout size={10} />
                <span>UI context active ({uiComponents.length} components)</span>
              </div>
            )}
            
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
                <div className="absolute bottom-full left-0 right-0 mb-1 bg-[#111] border border-copernicus-steel rounded shadow-2xl z-50 max-h-48 overflow-y-auto">
                  <div className="px-3 py-1 text-[9px] text-zinc-500 uppercase tracking-widest border-b border-copernicus-steel">
                    {pickerMode === 'file' ? '@ File Context' : pickerMode === 'codebase' ? '⌖ Semantic Results' : '# Story Context'}
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

                  // @codebase <query> — LSP workspace/symbol search (Story 176)
                  const codebaseMatch = newValue.slice(atIndex).match(/^@codebase\s+(.+)$/)
                  if (atIndex !== -1 && codebaseMatch) {
                    const query = codebaseMatch[1]
                    setPickerMode('codebase')
                    invoke<any>('lsp:request', { method: 'workspace/symbol', params: { query } })
                      .then((raw: any) => {
                        const symbols: any[] = Array.isArray(raw?.data) ? raw.data : Array.isArray(raw) ? raw : []
                        setPickerResults(symbols.slice(0, 20).map((s: any) => ({
                          label: s.name ?? '',
                          value: (s.location?.uri ?? '').replace('file://', ''),
                          payload: `${s.containerName ? s.containerName + '.' : ''}${s.name}`,
                        })))
                      })
                      .catch(() => setPickerResults([]))
                  } else if (atIndex !== -1 && atIndex >= hashIndex && !newValue.slice(atIndex).includes(' ')) {
                    const query = newValue.slice(atIndex + 1)
                    setPickerMode('file')
                    invoke<{ ok: boolean; data: any[] }>('fs:list-dir', rootPath ?? '').then((result) => {
                      const data = (result as any).data || result
                      if (Array.isArray(data)) {
                        const filtered = data.filter(n =>
                          !n.isDir && n.name.toLowerCase().includes(query.toLowerCase())
                        )
                        setPickerResults(filtered.map(n => ({
                          label: n.name,
                          value: n.path,
                          payload: n.path,
                        })))
                      }
                    }).catch(log.error)
                  } else if (hashIndex !== -1 && hashIndex > atIndex && !newValue.slice(hashIndex).includes(' ')) {
                    const query = newValue.slice(hashIndex + 1)
                    setPickerMode('story')
                    invoke<any[]>('stories:list').then((stories) => {
                      const data = (stories as any).data || stories
                      if (Array.isArray(data)) {
                        const filtered = data.filter((s: any) =>
                          s.id?.toLowerCase().includes(query.toLowerCase()) ||
                          s.title?.toLowerCase().includes(query.toLowerCase())
                        )
                        setPickerResults(filtered.map((s: any) => ({
                          label: s.title ?? s.id,
                          value: s.id,
                          payload: s.content ?? '',
                        })))
                      }
                    }).catch(log.error)
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
                  <button
                    onClick={handleFileAttach}
                    className="hover:text-copernicus-phosphor transition-colors"
                    title="Attach File (Dialog)"
                    disabled={isStreaming}
                  >
                    <Paperclip size={12} />
                  </button>
                  <button
                    onClick={() => triggerPicker('story')}
                    className="hover:text-copernicus-phosphor transition-colors"
                    title="Attach Story (#)"
                    disabled={isStreaming}
                  >
                    <FileText size={12} />
                  </button>
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
        </>
      ) : (
        <div className="flex-1 flex flex-col p-4 space-y-4">
          {/* Copernicus Guide Persona */}
          <div className="flex items-center gap-3 border-b border-copernicus-steel pb-4">
            <div className="w-10 h-10 rounded bg-copernicus-phosphor/20 flex items-center justify-center phosphor-glow-border">
              <span className="text-copernicus-phosphor font-bold">C</span>
            </div>
            <div>
              <div className="text-xs font-bold text-copernicus-phosphor">COPERNICUS</div>
              <div className="text-[9px] text-zinc-500 uppercase tracking-widest">Guide Persona</div>
            </div>
          </div>

          {/* Tour Content */}
          <div className="flex-1 overflow-y-auto space-y-4 scrollbar-thin scrollbar-thumb-copernicus-steel">
            {tourStep === 0 && (
              <div className="space-y-4">
                <p className="text-xs leading-relaxed text-zinc-300">
                  Welcome. Want a 60-second tour before you dive in?
                </p>
                <div className="flex flex-col gap-3">
                  <button
                    onClick={() => {
                      setTourStep(1)
                      setView('designer')
                      setTourHighlight('planner')
                    }}
                    className="w-full py-2.5 bg-copernicus-phosphor/10 border border-copernicus-phosphor/40 text-copernicus-phosphor text-[10px] font-bold uppercase tracking-wider hover:bg-copernicus-phosphor/20 transition-all active:scale-[0.98]"
                  >
                    Let's go →
                  </button>
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => {
                        setHasCompletedTour()
                        setView('editor')
                      }}
                      className="text-left text-[9px] text-zinc-500 hover:text-copernicus-phosphor uppercase underline decoration-zinc-700 underline-offset-4 transition-colors"
                    >
                      Skip — take me to the Editor
                    </button>
                    <button
                      onClick={() => {
                        setHasCompletedTour()
                        setView('planner')
                      }}
                      className="text-left text-[9px] text-zinc-500 hover:text-copernicus-phosphor uppercase underline decoration-zinc-700 underline-offset-4 transition-colors"
                    >
                      Skip — take me to the Planner
                    </button>
                  </div>
                </div>
              </div>
            )}

            {tourStep > 0 && tourStep < 6 && (
              <div className="space-y-4">
                <div className="p-3 bg-zinc-900/50 border border-copernicus-steel/30 rounded">
                  <p className="text-xs leading-relaxed text-zinc-300">
                    {tourStep === 1 && "Your Kanban board — every idea becomes a story, every story becomes code. Nine lanes from idea to Done."}
                    {tourStep === 2 && "Write code with Claude. Monaco editor, LSP running live — Claude sees your diagnostics automatically."}
                    {tourStep === 3 && "The Canvas — UI building, image review, live Playwright browser previews. You're in it now."}
                    {tourStep === 4 && "Workflow engine — multi-step agent pipelines assigned to stories, running headlessly."}
                    {tourStep === 5 && "Your control tower — agent swarms, active tasks, LSP state, stalls. Check here when anything feels stuck."}
                  </p>
                </div>
                <button
                  onClick={() => {
                    const nextStep = tourStep + 1
                    setTourStep(nextStep)
                    if (nextStep === 2) setTourHighlight('editor')
                    else if (nextStep === 3) setTourHighlight('designer')
                    else if (nextStep === 4) setTourHighlight('orchestrator')
                    else if (nextStep === 5) setTourHighlight('reporter')
                    else if (nextStep === 6) setTourHighlight(null)
                  }}
                  className="w-full py-2.5 bg-copernicus-phosphor/10 border border-copernicus-phosphor/40 text-copernicus-phosphor text-[10px] font-bold uppercase tracking-wider hover:bg-copernicus-phosphor/20 transition-all active:scale-[0.98]"
                >
                  Next →
                </button>
                <button
                  onClick={() => setHasCompletedTour()}
                  className="text-[9px] text-zinc-500 hover:text-zinc-300 uppercase underline decoration-zinc-700 underline-offset-4"
                >
                  Skip Tour
                </button>
              </div>
            )}

            {tourStep === 6 && (
              <div className="space-y-4">
                <p className="text-xs leading-relaxed text-zinc-300">
                  That's everything. Where do you want to start?
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setHasCompletedTour()
                      setView('editor')
                    }}
                    className="flex-1 py-2.5 bg-copernicus-phosphor/10 border border-copernicus-phosphor/40 text-copernicus-phosphor text-[10px] font-bold uppercase tracking-wider hover:bg-copernicus-phosphor/20 transition-all active:scale-[0.98]"
                  >
                    Editor
                  </button>
                  <button
                    onClick={() => {
                      setHasCompletedTour()
                      setView('planner')
                    }}
                    className="flex-1 py-2.5 bg-zinc-900 border border-copernicus-steel text-zinc-400 text-[10px] font-bold uppercase tracking-wider hover:bg-zinc-800 transition-all active:scale-[0.98]"
                  >
                    Planner
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
