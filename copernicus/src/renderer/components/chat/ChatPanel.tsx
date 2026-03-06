import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Send, Hash, FileText, Paperclip, ChevronDown, Save, RotateCcw, Maximize2, Minimize2, Book, User, History, Info, Layers, FileCode, ChevronRight } from 'lucide-react'
import { ChatMessage } from './ChatMessage'
import { ContextChip } from './ContextChip'
import { UIUpdateChip } from './UIUpdateChip'
import { commandRegistry, CommandContext, Command } from '../../commands/registry'
import { DiffViewer } from '../Editor/DiffViewer'
import { useIpcError } from '../../hooks/useIpcError'
import { useLayoutStore } from '../../store/layout'
import log from '../../utils/logger'
import { FlippablePanel } from '../layout/FlippablePanel'
import { matchKnowledge } from './CopernicusKnowledgeBase'
import { unwrapIpc } from '../../types/ipc'

const ipcRenderer = window.ipcRenderer

interface Message {
  id: string
  role: 'user' | 'assistant' | 'copernicus'
  content: string
  tokens?: number
  showTourButton?: boolean
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
      const result = await invoke<any>('fs:read-file', openFilePath)
      const data = unwrapIpc<string>(result)
      if (data !== undefined) {
        setExistingContent(data)
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
    invoke<any>('fs:save-file', { filePath: openFilePath, content: code })
      .then((result) => {
        const data = unwrapIpc<any>(result)
        if (data?.ok || result === true) {
          setApplied(true)
          onApply?.(code)
          setTimeout(() => setApplied(false), 2000)
        } else if (data?.error) {
          setApplyError(data.error)
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
      <pre className="bg-[#111] border border-t-0 border-copernicus-steel/50 rounded-b p-3 overflow-x-auto text-xs text-zinc-300 whitespace-pre-wrap font-mono">
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
    retakeTour,
    setChatPanelOpen,
    flippedPanes
  } = useLayoutStore()


  const [slashSuggestions, setSlashSuggestions] = useState<Command[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)

  // Picker state
  type PickerMode = 'none' | 'file' | 'story' | 'codebase'
  const [pickerMode, setPickerMode] = useState<PickerMode>('none')
  const [pickerResults, setPickerResults] = useState<Array<{ label: string; value: string; payload: string }>>([])

  const streamingIdRef = useRef<string | null>(null)
  const isFirstCallAfterSwitch = useRef(false)
  const memoryInjectedRef = useRef(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  const [activeBackTab, setActiveBackTab] = useState('context')
  const [showBackTabPicker, setShowBackTabPicker] = useState(false)
  const isFlipped = flippedPanes.includes('chat')

  // Instruction files state
  const [instructionFiles, setInstructionFiles] = useState<{path: string, content: string}[]>([])
  const [activeInstructionPath, setActiveInstructionPath] = useState('AGENTS.md')
  const [instructionContent, setInstructionContent] = useState('')

  useEffect(() => {
    if (activeBackTab === 'guide') {
      const files = ['AGENTS.md', 'TECHNICAL_BIBLE.md', 'UX_BIBLE.md', 'gemini.md']
      Promise.all(files.map(async f => {
        try {
          const res = await invoke<any>('fs:read-file', f)
          return { path: f, content: unwrapIpc<string>(res) || '' }
        } catch { return { path: f, content: '' } }
      })).then(setInstructionFiles)
    }
  }, [activeBackTab, invoke])

  useEffect(() => {
    const file = instructionFiles.find(f => f.path === activeInstructionPath)
    if (file) setInstructionContent(file.content)
  }, [activeInstructionPath, instructionFiles])

  const handleSaveInstruction = async () => {
    try {
      await invoke('fs:save-file', { filePath: activeInstructionPath, content: instructionContent })
      setInstructionFiles(prev => prev.map(f => f.path === activeInstructionPath ? { ...f, content: instructionContent } : f))
    } catch (e) { log.error('Failed to save instruction', e) }
  }

  const handleClearContext = () => setContext([])

  const [authStatus, setAuthStatus] = useState<any>(null)
  useEffect(() => {
    invoke<any>('auth:status').then((r: any) => setAuthStatus(unwrapIpc<any>(r))).catch(() => {})
  }, [invoke, isFlipped])

  const [savedPrompts, setSavedPrompts] = useState<{id: string, name: string, text: string}[]>([])
  useEffect(() => {
    try {
      const stored = localStorage.getItem('copernicus:saved-prompts')
      if (stored) setSavedPrompts(JSON.parse(stored))
    } catch {}
  }, [isFlipped])

  const savePrompt = () => {
    const text = input.trim()
    if (!text) return
    const name = prompt('Enter a short name for this prompt:')
    if (!name) return
    const newPrompt = { id: Date.now().toString(), name, text }
    const updated = [...savedPrompts, newPrompt]
    setSavedPrompts(updated)
    localStorage.setItem('copernicus:saved-prompts', JSON.stringify(updated))
  }

  const deletePrompt = (id: string) => {
    const updated = savedPrompts.filter(p => p.id !== id)
    setSavedPrompts(updated)
    localStorage.setItem('copernicus:saved-prompts', JSON.stringify(updated))
  }

  const usePrompt = (text: string) => {
    setInput(text)
    toggleFlip('chat')
  }

  const exportChat = () => {
    const text = messages.map(m => `${m.role.toUpperCase()}:\n${m.content}\n`).join('\n---\n\n')
    const blob = new Blob([text], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `chat-export-${Date.now()}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  const totalTokens = messages.reduce((acc, m) => acc + (m.tokens || 0), 0)
  const contextMaxTokens = availableModels.find(m => m.id === model)?.contextWindow || 0

  const renderBackFace = () => {
    const tabs = [
      { id: 'context', label: 'Context', icon: Layers },
      { id: 'persona', label: 'Persona', icon: User },
      { id: 'prompts', label: 'Library', icon: Book },
      { id: 'history', label: 'History', icon: History },
      { id: 'guide', label: 'Guide', icon: FileCode }
    ]

    return (
      <div className="flex flex-col h-full bg-copernicus-bg text-zinc-300 font-mono">
        <div className="h-8 flex items-center px-2 bg-copernicus-bg border-b border-white/5 bg-black/20 shrink-0 gap-2 relative">
          <div className="flex items-center gap-1 min-w-0 flex-1">
            <span className="text-[9px] uppercase font-bold text-zinc-600 tracking-widest">Utility</span>
            <span className="text-[9px] text-zinc-700">/</span>
            <div 
              className="flex items-center gap-1.5 cursor-pointer hover:text-copernicus-phosphor transition-colors group/crumb min-w-0"
              onClick={() => setShowBackTabPicker(!showBackTabPicker)}
            >
              {(() => {
                const active = tabs.find(t => t.id === activeBackTab)
                const Icon = active?.icon || Info
                return (
                  <>
                    <Icon size={10} className="text-zinc-500 group-hover/crumb:text-copernicus-phosphor" />
                    <span className="text-[10px] font-bold uppercase tracking-widest truncate">{active?.label}</span>
                    <ChevronDown size={10} className="text-zinc-700 group-hover/crumb:text-copernicus-phosphor" />
                  </>
                )
              })()}
            </div>

            {showBackTabPicker && (
              <div className="absolute top-full left-2 mt-1 w-40 bg-[#111] border border-copernicus-steel rounded shadow-2xl z-[120] overflow-hidden">
                {tabs.map(tab => {
                  const TabIcon = tab.icon
                  return (
                    <button
                      key={tab.id}
                      className={`w-full flex items-center gap-3 px-3 py-2 text-[10px] uppercase font-bold tracking-widest transition-colors ${activeBackTab === tab.id ? 'bg-copernicus-phosphor text-[#050505]' : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'}`}
                      onClick={() => {
                        setActiveBackTab(tab.id)
                        setShowBackTabPicker(false)
                      }}
                    >
                      <TabIcon size={12} />
                      {tab.label}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          <div className="flex items-center gap-1">
            <button onClick={() => toggleFlip('chat')} aria-label="Close chat tools" className="p-1 text-zinc-600 hover:text-copernicus-phosphor transition-colors" title="Rotate Panel">
              <RotateCcw size={12} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 scrollbar-thin scrollbar-thumb-copernicus-steel">
          {activeBackTab === 'context' && (
            <div className="space-y-4">
              <div>
                <div className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1">Model Context Usage</div>
                <div className="text-xs">{model} • {availableModels.find(m => m.id === model)?.provider || '—'}</div>
                <div className="flex items-center gap-2 mt-2">
                  <div className="flex-1 h-1 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-copernicus-phosphor"
                      style={{ width: `${contextMaxTokens ? Math.min(100, (totalTokens / contextMaxTokens) * 100) : 0}%` }}
                    />
                  </div>
                  <div className="text-[10px] text-zinc-500">
                    {totalTokens} / {contextMaxTokens || '—'}
                  </div>
                </div>
              </div>

              <div>
                <div className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1 flex justify-between items-center">
                  <span>Attached Files ({context.length})</span>
                  {context.length > 0 && (
                    <button onClick={handleClearContext} className="hover:text-copernicus-phosphor transition-colors">Clear Context</button>
                  )}
                </div>
                {context.length === 0 ? (
                  <div className="text-xs text-zinc-600">—</div>
                ) : (
                  <div className="space-y-1 mt-2">
                    {context.map((c, i) => (
                      <div key={i} className="flex items-center justify-between bg-zinc-900 px-2 py-1 rounded border border-copernicus-steel/50">
                        <span className="text-xs truncate max-w-[200px]">{c.label}</span>
                        <button onClick={() => setContext(prev => prev.filter(x => x.label !== c.label))} className="text-zinc-500 hover:text-red-400">✕</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeBackTab === 'persona' && (
            <div className="space-y-4">
              <div>
                <div className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1">Active Persona</div>
                <div className="text-xs flex items-center gap-2">
                  <div className={`w-1.5 h-1.5 rounded-full ${authStatus?.isActive || model === 'copernicus-guide' ? 'bg-green-500' : 'bg-red-500'}`} />
                  {availableModels.find(m => m.id === model)?.name || model} ({model})
                </div>
                <div className="text-[10px] text-zinc-500 mt-1">Provider: {availableModels.find(m => m.id === model)?.provider || '—'}</div>
              </div>

              <div>
                <div className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1">Switch Model</div>
                <select
                  className="w-full bg-zinc-900 border border-copernicus-steel rounded px-2 py-1 text-xs text-zinc-300 focus:border-copernicus-phosphor outline-none"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                >
                  {availableModels.map(m => (
                    <option key={m.id} value={m.id}>{m.name} ({m.provider})</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {activeBackTab === 'prompts' && (
            <div className="space-y-4 flex flex-col h-full">
              <button
                onClick={savePrompt}
                className="w-full bg-zinc-900 hover:bg-copernicus-phosphor/10 border border-copernicus-steel hover:border-copernicus-phosphor text-zinc-300 transition-colors text-xs py-1.5 rounded flex items-center justify-center gap-2"
              >
                + Save Current Input
              </button>

              <div className="flex-1 space-y-2">
                {savedPrompts.length === 0 ? (
                  <div className="text-xs text-zinc-600 text-center py-4">No saved prompts yet.</div>
                ) : (
                  savedPrompts.map(p => (
                    <div key={p.id} className="bg-zinc-900 border border-copernicus-steel/50 rounded p-2">
                      <div className="text-xs font-bold text-copernicus-phosphor mb-1">{p.name}</div>
                      <div className="text-[10px] text-zinc-400 truncate mb-2">{p.text}</div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => usePrompt(p.text)}
                          className="text-[10px] px-2 py-0.5 bg-zinc-800 hover:bg-copernicus-phosphor/20 hover:text-copernicus-phosphor transition-colors rounded"
                        >
                          Use
                        </button>
                        <button
                          onClick={() => deletePrompt(p.id)}
                          className="text-[10px] px-2 py-0.5 bg-zinc-800 hover:bg-red-500/20 hover:text-red-400 transition-colors rounded"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {activeBackTab === 'history' && (
            <div className="space-y-4 flex flex-col h-full">
              <button
                onClick={exportChat}
                className="w-full bg-zinc-900 hover:bg-copernicus-phosphor/10 border border-copernicus-steel hover:border-copernicus-phosphor text-zinc-300 transition-colors text-xs py-1.5 rounded flex items-center justify-center gap-2"
              >
                Export Chat
              </button>

              <div className="flex-1 space-y-2">
                {messages.length === 0 ? (
                  <div className="text-xs text-zinc-600 text-center py-4">No history.</div>
                ) : (
                  messages.slice(-20).map((m, i) => (
                    <div key={i} className="bg-zinc-900 border border-copernicus-steel/50 rounded p-2">
                      <div className={`text-[10px] font-bold mb-1 ${m.role === 'user' ? 'text-zinc-400' : 'text-copernicus-phosphor'}`}>
                        {m.role === 'user' ? 'You' : model}
                      </div>
                      <div className="text-xs text-zinc-300 whitespace-pre-wrap truncate max-h-[40px]">
                        {m.content.substring(0, 120)}{m.content.length > 120 ? '...' : ''}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {activeBackTab === 'guide' && (
            <div className="h-full flex flex-col space-y-3">
              <div className="flex items-center justify-between">
                <select 
                  className="bg-zinc-900 border border-copernicus-steel text-[10px] rounded px-2 py-1 outline-none text-copernicus-phosphor"
                  value={activeInstructionPath}
                  onChange={(e) => setActiveInstructionPath(e.target.value)}
                >
                  {instructionFiles.map(f => <option key={f.path} value={f.path}>{f.path}</option>)}
                </select>
                <button onClick={handleSaveInstruction} className="text-[10px] bg-zinc-800 hover:bg-copernicus-phosphor/20 px-2 py-1 rounded flex items-center gap-1.5 transition-colors">
                  <Save size={10} /> Save Mandate
                </button>
              </div>
              <textarea 
                value={instructionContent}
                onChange={(e) => setInstructionContent(e.target.value)}
                className="flex-1 bg-zinc-950 border border-copernicus-steel p-3 text-xs font-mono text-zinc-400 resize-none outline-none focus:border-copernicus-phosphor/50 transition-colors"
                placeholder="Edit mandates..."
              />
            </div>
          )}
        </div>
      </div>
    )
  }

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  useEffect(() => {
    invoke<any>('models:list').then((r: any) => {
      const data = unwrapIpc<any[]>(r) ?? []
      const guideModel = { id: 'copernicus-guide', name: 'Copernicus Guide', provider: 'built-in', contextWindow: 0 }
      setAvailableModels([guideModel, ...data])
    }).catch(log.error)
    
    invoke<any>('devtime:status').then(res => {
        const d = unwrapIpc<any>(res)
        setIsRepoActive(!!(d && d.session))
    })
  }, [invoke])

  useEffect(() => {
    if (memoryInjectedRef.current) return
    memoryInjectedRef.current = true
    invoke<any>('db:search-memory', 5).then((res: any) => {
      if (res?.ok && res.data && res.data.length > 0) {
        const memories = res.data.map((m: any) => m.content).join('\n')
        setMessages([{ id: `msg-${Date.now()}`, role: 'assistant', content: `[Project Memory]\n${memories}\n\n---\n\nMemory injected silently.` }])
      }
    }).catch(() => {})
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
          if (last?.role === 'assistant' || last?.role === 'copernicus') {
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
          if (last?.role === 'assistant' || last?.role === 'copernicus') {
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
          if (last?.role === 'assistant' || last?.role === 'copernicus') {
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
        const result = await invoke<any>('fs:read-file', item.value)
        const data = unwrapIpc<string>(result)
        if (data !== undefined) {
          injectedContent = data
        } else {
          injectedContent = `[Failed to read ${item.label}]`
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

    const atMarker = (currentMode === 'file' || currentMode === 'codebase') ? '@' : '#'
    setInput(prev => {
      const idx = prev.lastIndexOf(atMarker)
      return idx !== -1 ? prev.slice(0, idx) : prev
    })
  }, [pickerMode, invoke])

  const handleSendMessage = async () => {
    if ((!input.trim() && context.length === 0) || isStreaming) return

    const currentInput = input.trim();

    const cmdContext: CommandContext = {
      appendMessage: (role, content) =>
        setMessages(prev => [...prev, { id: `msg-${Date.now()}`, role, content }]),
      clearMessages: () => setMessages([]),
      setModel: (m) => setModel(m),
      getCurrentModel: () => model,
      setBackTab: (tab) => setActiveBackTab(tab),
      flip: () => toggleFlip('chat')
    }

    if (currentInput.startsWith('/')) {
      const handled = commandRegistry.execute(currentInput, cmdContext)
      if (handled) {
        setInput('')
        setShowSuggestions(false)
        return
      }
    }

    // Story 188: Built-in Guide (forced if model is selected)
    const match = matchKnowledge(currentInput)
    if (match || model === 'copernicus-guide') {
      setMessages(prev => [...prev, { id: Date.now().toString(), role: 'user', content: currentInput }])
      setInput('')
      setTimeout(() => {
        setMessages(prev => [...prev, { 
          id: `cp-${Date.now()}`, 
          role: 'copernicus', 
          content: match ? match.response : "I don't have a specific answer for that in my knowledge base. Try asking about 'views', 'workflows', or 'jules'.",
          showTourButton: match ? !!match.showTourButton : false 
        }])
      }, 100)
      return
    }

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input
    }

    setMessages(prev => [...prev, userMsg])

    let enrichedContent = currentInput
    if (context.length > 0) {
      const contextBlocks = context.map(c => `[CONTEXT: ${String(c.type || '').toUpperCase()} - ${c.label}]\n${c.content}`).join('\n\n')
      enrichedContent = `${contextBlocks}\n\n---\n\nUSER_INPUT: ${currentInput}`
    }

    if (isFirstCallAfterSwitch.current) {
      isFirstCallAfterSwitch.current = false
      const snapRes = await invoke<any>('snapshot:restore', 'chat')
      const snapData = unwrapIpc<any>(snapRes)
      if (snapData?.messages) {
        try {
          const m = typeof snapData.messages === 'string' ? JSON.parse(snapData.messages) : snapData.messages
          const prevContext = m.map((msg: any) => `${msg.role}: ${msg.content}`).join('\n')
          enrichedContent = `[CONTEXT HANDOFF]\nPrevious session context:\n${prevContext}\n\n${enrichedContent}`
        } catch { }
      }
    }

    if (centerMode === 'builder' && uiComponents.length > 0) {
      const treeJson = JSON.stringify(uiComponents, null, 2)
      enrichedContent += `\n\n<ui-canvas-context>\n${treeJson}\n</ui-canvas-context>`
    }

    setInput('')
    setContext([])

    if (currentInput.includes('@help')) {
        try {
            const result = await invoke<any>('fs:read-file', 'docs/help/USER_GUIDE.md');
            const data = unwrapIpc<string>(result)
            if (data) {
              enrichedContent = enrichedContent.replace('@help', `\n\n[CONTEXT: OPERATOR MANUAL]\n${data}\n`);
            }
        } catch (e) {
            log.error('Failed to inject @help context:', e);
        }
    }

    const sessionId = `chat-${Date.now()}`
    streamingIdRef.current = sessionId
    setIsStreaming(true)

    if (openFilePath) {
      try {
        const diagRes = await invoke<any>('lsp:get-diagnostics', openFilePath)
        const diags: any[] = unwrapIpc<any>(diagRes) ?? []
        if (Array.isArray(diags) && diags.length > 0) {
          const filename = openFilePath.split(/[/\\]/).pop() ?? openFilePath
          const summary = diags.slice(0, 10)
            .map((d: any) => `[${d.severity === 1 ? 'ERROR' : 'WARN'}] L${(d.range?.start?.line ?? 0) + 1}: ${d.message}`)
            .join('\n')
          enrichedContent = `[LSP diagnostics for ${filename}]\n${summary}\n\n---\n\n${enrichedContent}`
        }
      } catch { }
    }

    setMessages(prev => [...prev, {
      id: `msg-${Date.now()}`,
      role: 'assistant',
      content: '',
    }])

    const history = messages.filter(m => m.role !== 'copernicus').map(m => ({ role: m.role, content: m.content }))

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
      const _rawContent = await invoke<any>('stories:hydrate', activeStoryId);
      const currentContent: string = unwrapIpc<any>(_rawContent) ?? '';
      let updatedContent = currentContent;
      const implMarker = '## Implementation';
      if (currentContent.includes(implMarker)) {
        const parts = currentContent.split(implMarker);
        updatedContent = `${parts[0]}${implMarker}\n${content}\n`;
      } else {
        updatedContent = `${currentContent}\n\n${implMarker}\n${content}\n`;
      }
      await invoke('stories:update', { id: activeStoryId, content: updatedContent });
      window.ipcRenderer.send('db:log-intent', `Architected ${activeStoryId} via Chat`, 'COMPLETED', 'chat');
    } catch (e) {
      log.error("Failed to save to story", e);
    }
  };

  function renderMessageContent(
    content: string,
    openPath: string | null,
    msgId: string
  ): React.ReactNode {
    const parts = content.split(/(```[\w]*\n[\s\S]*?```)/g)
    const msg = messages.find(m => m.id === msgId)

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
        {activeStoryId && msg?.role === 'assistant' && (
          <button
            onClick={() => handleSaveToStory(content)}
            className="mt-2 flex items-center gap-1.5 text-[9px] text-zinc-500 hover:text-copernicus-phosphor transition-colors uppercase font-bold tracking-wider"
          >
            <Save size={10} /> Save to active story
          </button>
        )}
        {msg?.showTourButton && (
          <button
            onClick={() => retakeTour()}
            className="mt-3 text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 bg-copernicus-phosphor text-[#050505] rounded-none hover:opacity-90 transition-opacity"
          >
            Start Tour
          </button>
        )}
      </>
    )
  }

  const handleFileAttach = async () => {
    try {
      const filePath = await invoke<string | null>('fs:open-file')
      if (!filePath) return
      const result = await invoke<any>('fs:read-file', filePath)
      const content = unwrapIpc<string>(result)
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
      const result = await invoke<any>('fs:list-dir', rootPath ?? '')
      const data = unwrapIpc<any[]>(result)
      if (Array.isArray(data)) {
        setPickerResults(data.filter(n => !n.isDir).map(n => ({
          label: n.name,
          value: n.path,
          payload: n.path,
        })))
      }
    } else if (mode === 'story') {
      const result = await invoke<any[]>('stories:list')
      const data = unwrapIpc<any[]>(result)
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
    <FlippablePanel
      id="chat"
      front={
        <div className="flex flex-col h-full bg-copernicus-bg text-zinc-300 font-mono">
          {/* Unified Chat Header */}
          <div className="h-8 flex items-center justify-between px-3 border-b border-white/5 bg-black/20 shrink-0 select-none group/chat">
            <div className="flex items-center gap-2">
              <div className="relative">
                <button
                  onClick={() => setShowModelPicker(!showModelPicker)}
                  className="flex items-center gap-1.5 text-[10px] font-bold text-zinc-400 hover:text-white transition-colors uppercase tracking-wider"
                >
                  <div className={`w-1.5 h-1.5 rounded-full ${model === 'copernicus-guide' ? 'bg-copernicus-phosphor shadow-[0_0_5px_rgba(74,222,128,0.8)]' : 'bg-copernicus-phosphor animate-pulse shadow-[0_0_5px_rgba(74,222,128,0.5)]'}`} />
                  {availableModels.find(m => m.id === model)?.name || 'Model'}
                  <ChevronDown size={10} className={`transition-transform duration-200 ${showModelPicker ? 'rotate-180' : ''}`} />
                </button>

                {showModelPicker && (
                    <div className="absolute top-full left-0 mt-1 w-48 bg-[#111] border border-copernicus-steel rounded shadow-2xl z-50 py-1 overflow-hidden">
                    {availableModels.map(m => (
                        <button
                        key={m.id}
                        className={`w-full text-left px-3 py-2 text-[10px] hover:bg-copernicus-phosphor/10 transition-colors flex flex-col ${model === m.id ? 'bg-copernicus-phosphor/5 border-l-2 border-copernicus-phosphor' : ''}`}
                        onClick={() => {
                            if (model !== m.id) {
                              if (model !== 'copernicus-guide' && m.id !== 'copernicus-guide') {
                                invoke('snapshot:save', { panel_id: 'chat', model_id: model, provider: availableModels.find((x: any) => x.id === model)?.provider || 'unknown', messages: messages.filter(m => m.role !== 'copernicus') }).catch(() => {})
                                isFirstCallAfterSwitch.current = true
                              }
                              setMessages(prev => [...prev, { id: `msg-divider-${Date.now()}`, role: 'assistant', content: `↔ Switched to ${m.name}` }])
                            }
                            setModel(m.id)
                            setShowModelPicker(false)
                        }}
                        >
                        <span className={model === m.id ? 'text-copernicus-phosphor' : 'text-zinc-300'}>{m.name}</span>
                        <span className="text-[8px] text-zinc-600 uppercase">{m.provider} {m.contextWindow > 0 ? `• ${m.contextWindow.toLocaleString()} tokens` : ''}</span>
                        </button>
                    ))}
                    </div>
                )}
              </div>

              <div className="flex items-center gap-1 flex-none" title={isRepoActive ? "Repo Context Active" : "No Repo Context"}>
                 <div className={`w-1.5 h-1.5 rounded-full ${isRepoActive ? 'bg-green-500 shadow-[0_0_5px_rgba(34,197,94,0.5)]' : 'bg-red-500 animate-pulse shadow-[0_0_5px_rgba(239,68,68,0.5)]'}`} />
              </div>
            </div>

            <div className="flex items-center gap-1 opacity-0 group-hover/chat:opacity-100 transition-opacity">
              <button
                onClick={() => setSpotlight(spotlightPane === 'chat' ? null : 'chat')}
                className={`p-1 rounded hover:bg-white/5 ${spotlightPane === 'chat' ? 'text-copernicus-phosphor' : 'text-zinc-600 hover:text-zinc-300'}`}
                title={spotlightPane === 'chat' ? "Exit Spotlight" : "Spotlight Chat"}
              >
                {spotlightPane === 'chat' ? <Minimize2 size={10} /> : <Maximize2 size={10} />}
              </button>
              <button
                onClick={() => toggleFlip('chat')}
                className="p-1 text-zinc-600 hover:text-copernicus-phosphor transition-colors"
                title="Rotate Chat Tools"
              >
                <RotateCcw size={10} />
              </button>
              <button
                onClick={() => setChatPanelOpen(false)}
                className="p-1 text-zinc-600 hover:text-red-400 transition-colors"
                title="Collapse Chat"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-thin scrollbar-thumb-copernicus-steel">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center opacity-20 grayscale grayscale-100">
                <Hash size={48} className="text-copernicus-phosphor mb-4" />
                <div className="text-[10px] uppercase tracking-[0.2em]">Awaiting_Strategic_Input</div>
              </div>
            ) : (
              messages.map(m => (
                <div key={m.id} role="article">
                  <ChatMessage
                    role={m.role}
                    content={m.role !== 'user' ? renderMessageContent(m.content, openFilePath, m.id) : m.content}
                    tokens={m.tokens ? { in: 0, out: m.tokens, cost: 0 } : undefined}
                  />
                </div>
              ))
            )}
          </div>

          {context.length > 0 && (
            <div className="px-2 py-1 flex flex-wrap gap-1 bg-zinc-900/50 border-t border-hairline border-copernicus-steel">
              {context.map(c => <ContextChip key={c.label} label={c.label} onRemove={() => setContext(prev => prev.filter(i => i.label !== c.label))} />)}
            </div>
          )}

          <div className="p-2 bg-copernicus-bg border-t border-hairline border-copernicus-steel">
            <div className="relative flex flex-col bg-zinc-900 border border-copernicus-steel focus-within:border-copernicus-phosphor transition-all rounded p-1.5 shadow-sm">
              {/* Suggestion Popover (AC-2) */}
              {showSuggestions && slashSuggestions.length > 0 && (
                <div className="absolute bottom-full left-0 right-0 mb-1 bg-[#111] border border-copernicus-steel rounded shadow-2xl z-50 py-1 overflow-hidden">
                  {slashSuggestions.map(cmd => (
                    <button
                      key={cmd.name}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-copernicus-phosphor/10 transition-colors flex items-center gap-3"
                      onClick={() => {
                        setInput(cmd.name + ' ')
                        setShowSuggestions(false)
                      }}
                    >
                      <span className="text-copernicus-phosphor font-mono">{cmd.name}</span>
                      <span className="text-[10px] text-zinc-500 uppercase tracking-tighter">{cmd.description}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Context Picker Popover (AC-2) */}
              {pickerMode !== 'none' && pickerResults.length > 0 && (
                <div className="absolute bottom-full left-0 right-0 mb-1 bg-[#111] border border-copernicus-steel rounded shadow-2xl z-50 max-h-48 overflow-y-auto">
                  <div className="px-3 py-1 text-[9px] text-zinc-500 uppercase tracking-widest border-b border-copernicus-steel bg-black/40">
                    {pickerMode === 'file' ? '@ File Context' : pickerMode === 'codebase' ? '⌖ Semantic Results' : '# Story Context'}
                  </div>
                  {pickerResults.map(item => (
                    <button
                      key={item.value}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-copernicus-phosphor/10 transition-colors flex flex-col"
                      onClick={() => handlePickerSelect(item)}
                    >
                      <span className="text-zinc-300 font-bold">{item.label}</span>
                      <span className="text-[9px] text-zinc-600 truncate">{item.value}</span>
                    </button>
                  ))}
                </div>
              )}

              <textarea
                value={input}
                aria-label="Chat input"
                data-chat-input
                onChange={(e) => {
                  const newValue = e.target.value
                  setInput(newValue)
                  
                  if (newValue.startsWith('/') && !newValue.includes(' ')) {
                    setSlashSuggestions(commandRegistry.suggest(newValue))
                    setShowSuggestions(true)
                  } else {
                    setShowSuggestions(false)
                  }

                  // Context Picker logic
                  const atIndex = newValue.lastIndexOf('@')
                  const hashIndex = newValue.lastIndexOf('#')

                  const codebaseMatch = newValue.slice(atIndex).match(/^@codebase\s+(.+)$/)
                  if (atIndex !== -1 && codebaseMatch) {
                    const query = codebaseMatch[1]
                    setPickerMode('codebase')
                    invoke<any>('lsp:request', { method: 'workspace/symbol', params: { query } })
                      .then((raw: any) => {
                        const data = unwrapIpc<any[]>(raw)
                        const symbols: any[] = Array.isArray(data) ? data : []
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
                    invoke<any>('fs:list-dir', rootPath ?? '').then((result) => {
                      const data = unwrapIpc<any[]>(result)
                      if (Array.isArray(data)) {
                        const filtered = data.filter(n => !n.isDir && n.name.toLowerCase().includes(query.toLowerCase()))
                        setPickerResults(filtered.map(n => ({ label: n.name, value: n.path, payload: n.path })))
                      }
                    }).catch(log.error)
                  } else if (hashIndex !== -1 && hashIndex > atIndex && !newValue.slice(hashIndex).includes(' ')) {
                    const query = newValue.slice(hashIndex + 1)
                    setPickerMode('story')
                    invoke<any[]>('stories:list').then((result) => {
                      const data = unwrapIpc<any[]>(result)
                      if (Array.isArray(data)) {
                        const filtered = data.filter((s: any) => (s.id?.toLowerCase().includes(query.toLowerCase()) || s.title?.toLowerCase().includes(query.toLowerCase())))
                        setPickerResults(filtered.map((s: any) => ({ label: s.title ?? s.id, value: s.id, payload: s.content ?? '' })))
                      }
                    }).catch(log.error)
                  } else {
                    setPickerMode('none')
                  }
                }}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSendMessage())}
                placeholder={isStreaming ? "Streaming..." : "Strategic intent... (@file, #story)"}
                disabled={isStreaming}
                className="w-full bg-transparent border-none focus:ring-0 text-xs text-zinc-300 resize-none min-h-[40px] max-h-[200px] disabled:opacity-50 font-mono"
              />
              <div className="flex items-center justify-between mt-1 pt-1 border-t border-copernicus-steel/20">
                <div className="flex gap-2 text-zinc-500">
                  <button onClick={handleFileAttach} className="hover:text-copernicus-phosphor transition-colors" title="Attach File"><Paperclip size={12} /></button>
                  <button onClick={() => triggerPicker('story')} className="hover:text-copernicus-phosphor transition-colors" title="Attach Story"><FileText size={12} /></button>
                </div>
                <button onClick={handleSendMessage} disabled={isStreaming} className="p-1 hover:text-copernicus-phosphor text-zinc-600 transition-colors disabled:opacity-40"><Send size={14} /></button>
              </div>
            </div>
          </div>
        </div>
      }
      back={renderBackFace()}
    />
  )
}
