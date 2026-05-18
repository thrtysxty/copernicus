import log from '../../utils/logger'
import React, { useState, useEffect, useRef } from 'react'
import { unwrapIpc } from '../../types/ipc'
import { Message, ModelInfo, AuthStatus } from './useChatPanel'
import { Save, Hash, ChevronDown, Minimize2, Maximize2, RotateCcw, ChevronRight, BookOpen } from 'lucide-react'
import { ChatMessage } from './ChatMessage'
import { UIUpdateChip } from './UIUpdateChip'
import { DiffViewer } from '../Editor/DiffViewer'
import { useIpcError } from '../../hooks/useIpcError'
import { useLayoutStore } from '../../store/layout'
import { useUIBuilderStore } from '../../store/uiBuilderStore'



interface ChatThreadProps {
  messages: Message[]
  openFilePath: string | null
  pendingModelSwitch: { model: string; reason: string; sessionId: string } | null
  acceptModelSwitch: (sw: { model: string; reason: string; sessionId: string }) => void
  rejectModelSwitch: () => void
  handleSaveToStory: (content: string) => Promise<void>
  model: string
  setModel: (v: string) => void
  availableModels: ModelInfo[]
  authStatus: AuthStatus[]
  showModelPicker: boolean
  setShowModelPicker: (v: boolean) => void
  isRepoActive: boolean
  isFlipped: boolean
  isStreaming: boolean
  invoke: any
  contextUpdate?: { usedTokens: number; maxTokens: number; percentage: number } | null
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
  const { setCanvasContent } = useLayoutStore()
  const { setUIComponents } = useUIBuilderStore()

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
    } catch (err) { console.warn("[Non-critical]", err) }
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

// ── ChatThread Component ───────────────────────────────────────────────────

export const ChatThread: React.FC<ChatThreadProps> = ({
  messages,
  openFilePath,
  pendingModelSwitch,
  acceptModelSwitch,
  rejectModelSwitch,
  handleSaveToStory,
  model,
  setModel,
  availableModels,
  authStatus,
  showModelPicker,
  setShowModelPicker,
  isRepoActive,
  isFlipped,
  invoke,
  contextUpdate,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null)
  const { 
    activeStoryId, 
    retakeTour, 
    setSpotlight, 
    spotlightPane, 
    toggleFlip, 
    setChatPanelOpen,
    pendingSystemMessage, // Changed from pendingReviewSummary
    clearPendingSystemMessage, // Added
    setView, // Added
  } = useLayoutStore()

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, pendingSystemMessage]) // Changed from pendingReviewSummary

  // New component for rendering the structured summary message
  const ReviewSummaryCard: React.FC = () => {
    if (!pendingSystemMessage || pendingSystemMessage.type !== 'review-summary') return null

    const { storyId, changedFiles, summary } = pendingSystemMessage
    const invoke = useIpcError()

    const handleApprove = async () => {
      await invoke('stories:set-status', { id: storyId, status: 'COMPLETE' })
      clearPendingSystemMessage()
    }

    return (
      <div className="mx-4 mb-6 bg-zinc-900/50 border border-zinc-700/30 rounded p-3 text-[10px] font-mono">
        <div className="text-zinc-300">✓ {summary}</div>
        <div className="text-zinc-500 mt-1">What changed: {changedFiles.join(', ')}</div>
        <div className="flex gap-2 mt-3">
          <button 
            onClick={() => setView('review')} 
            className="px-2 py-0.5 text-[9px] border border-zinc-700 rounded hover:border-copernicus-phosphor text-zinc-400 hover:text-copernicus-phosphor"
          >
            View Diff →
          </button>
          <button 
            onClick={handleApprove} 
            className="px-2 py-0.5 text-[9px] border border-zinc-700 rounded hover:border-copernicus-phosphor text-zinc-400 hover:text-copernicus-phosphor"
          >
            Approve →
          </button>
        </div>
      </div>
    )
  }

  function renderMessageContent(
    content: string,
    openPath: string | null,
    msgId: string
  ): React.ReactNode {
    const parts = content.split(/(```[\w]*\n[\s\S]*?```)/g)
    const msg = messages.find(m => m.id === msgId)

    return (
      <>
        {msg?.imageBase64 && (
          <div className="mb-2">
            <img 
              src={`data:${msg.imageMimeType};base64,${msg.imageBase64}`} 
              className="max-w-[200px] rounded mt-1 cursor-pointer border border-copernicus-steel hover:border-copernicus-phosphor transition-colors shadow-lg" 
              onClick={() => setLightboxSrc(`data:${msg.imageMimeType};base64,${msg.imageBase64}`)}
            />
          </div>
        )}
        {parts.map((part, i) => {
          const match = part.match(/^```([\w]*)\n([\s\S]*?)```$/)
          if (match) {
            return (
              <CodeBlock
                key={i}
                language={match[1] ?? ''}
                code={match[2] ?? ''}
                openFilePath={openPath}
              />
            )
          }

          // Parse for KB links within text nodes
          const textParts = part.split(/(\[KB:[^\]]+\]\([^)]+\))/g)

          return <span key={i} className="whitespace-pre-wrap">
            {textParts.map((tPart: string, tIndex: number) => {
              const kbMatch = tPart.match(/^\[KB:([^\]]+)\]\(([^)]+)\)$/)
              if (kbMatch) {
                const [_, title, id] = kbMatch
                return (
                  <button
                    key={tIndex}
                    onClick={async () => {
                      const deltaMessages = messages.slice(-5).map(m => ({
                        ...m,
                        content: (typeof m.content === 'string' ? m.content : '').slice(0, 40)
                      }))

                      const result = await invoke('snapshot:save', {
                        panel_id: `kb:${id}`,
                        messages: deltaMessages
                      })

                      if (!result.ok) { /* non-fatal — proceed anyway */ }

                      // Dispatch to open article
                      window.dispatchEvent(new CustomEvent('kb:open-article', { detail: id }))

                      useLayoutStore.getState().setView('knowledge-base')
                      if (id) {
                        useLayoutStore.getState().setActiveKbArticleId(id)
                      }
                    }}
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 mx-1 bg-transparent text-copernicus-phosphor hover:bg-copernicus-phosphor hover:text-[#050505] rounded-none border border-copernicus-phosphor transition-colors align-middle text-[10px] font-bold"
                  >
                    <BookOpen size={10} />
                    {title}
                  </button>
                )
              }
              return tPart
            })}
          </span>
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

  return (
    <>
      {/* Lightbox Overlay */}
      {lightboxSrc && (
        <div 
          className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-8 cursor-pointer"
          onClick={() => setLightboxSrc(null)}
        >
          <img 
            src={lightboxSrc} 
            className="max-w-full max-h-full object-contain rounded shadow-2xl" 
          />
        </div>
      )}

      {/* Unified Chat Header */}
      <div className="h-8 flex items-center justify-between px-3 border-b border-white/5 bg-black/20 shrink-0 select-none group/chat">
        <div className="flex items-center gap-2">
          <div className="relative">
            <button
              onClick={() => setShowModelPicker(!showModelPicker)}
              className="flex items-center gap-1.5 text-[10px] font-bold text-zinc-400 hover:text-white transition-colors uppercase tracking-wider"
            >
              <div className="w-1.5 h-1.5 rounded-full bg-copernicus-phosphor animate-pulse shadow-[0_0_5px_rgba(74,222,128,0.5)]" />
              {availableModels.find(m => m.id === model)?.name || 'Model'}
              <ChevronDown size={10} className={`transition-transform duration-200 ${showModelPicker ? 'rotate-180' : ''}`} />
            </button>

            {showModelPicker && (
                <div className="absolute top-full left-0 mt-1 w-48 bg-[#111] border border-copernicus-steel rounded shadow-2xl z-50 py-1 overflow-hidden">
                {['openai', 'anthropic', 'google', 'ollama', 'openrouter', 'deepinfra'].map(provider => {
                  const s = authStatus.find(a => a.provider === provider)
                  const isActive = s?.hasKey || provider === 'ollama' // ollama might be active without key if running locally
                  const pModels = availableModels.filter(m => m.provider === provider)
                  if (pModels.length === 0 && isActive) return null // Hide if no models fetched
                  
                  return (
                    <div key={provider}>
                      <div className="px-3 py-1 text-[8px] uppercase tracking-widest text-zinc-500 bg-black/40 border-y border-copernicus-steel/50 mt-1 first:mt-0">
                        {provider}
                      </div>
                      {!isActive ? (
                        <div className="px-3 py-1 text-[9px] text-zinc-600 italic">
                          Configure in Settings
                        </div>
                      ) : (
                        pModels.map(m => (
                          <button
                            key={m.id}
                            className={`w-full text-left px-3 py-1.5 text-[10px] hover:text-zinc-300 transition-colors flex flex-col ${model === m.id ? 'bg-copernicus-phosphor text-[#050505] rounded-none border-l-2 border-copernicus-phosphor' : 'border-l-2 border-transparent'}`}
                            onClick={() => {
                                if (model !== m.id) {
                                  invoke('snapshot:save', { panel_id: 'chat', model_id: m.id, provider: m.provider, messages: messages.filter(msg => msg.role !== 'copernicus') }).catch(() => {})
                                }
                                setModel(m.id)
                                setShowModelPicker(false)
                            }}
                          >
                            <span className={model === m.id ? 'text-copernicus-phosphor' : 'text-zinc-300'}>{m.name}</span>
                            <span className="text-[8px] text-zinc-600 uppercase">{m.contextWindow > 0 ? `${m.contextWindow.toLocaleString()} tokens` : '—'}</span>
                          </button>
                        ))
                      )}
                    </div>
                  )
                })}
                </div>
            )}
          </div>

          {contextUpdate && (
            <div className="flex items-center gap-2 text-[9px] font-mono text-zinc-500 uppercase tracking-tight">
              <span>{contextUpdate.usedTokens.toLocaleString()} / {contextUpdate.maxTokens.toLocaleString()} tokens</span>
            </div>
          )}

          {isRepoActive && (
            <div className="flex items-center gap-1 flex-none" title="Repo Context Active">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_5px_rgba(34,197,94,0.5)]" />
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 opacity-0 group-hover/chat:opacity-100 transition-opacity">
          <button
            onClick={() => setSpotlight(spotlightPane === 'chat' ? null : 'chat')}
            className={`p-1 rounded hover:bg-white/5 focus-visible:ring-2 focus-visible:ring-copernicus-phosphor focus-visible:outline-none ${spotlightPane === 'chat' ? 'text-copernicus-phosphor' : 'text-zinc-600 hover:text-zinc-300'}`}
            title={spotlightPane === 'chat' ? "Exit Spotlight" : "Spotlight Chat"}
            aria-label={spotlightPane === 'chat' ? "Exit Spotlight" : "Spotlight Chat"}
          >
            {spotlightPane === 'chat' ? <Minimize2 size={10} /> : <Maximize2 size={10} />}
          </button>
          <button
            onClick={() => toggleFlip('chat')}
            className="p-1 text-zinc-600 hover:text-copernicus-phosphor transition-colors focus-visible:ring-2 focus-visible:ring-copernicus-phosphor focus-visible:outline-none"
            title="Rotate Chat Tools"
            aria-label={isFlipped ? "Close chat tools" : "Open chat tools"}
          >
            <RotateCcw size={10} />
          </button>
          <button
            onClick={() => setChatPanelOpen(false)}
            className="p-1 text-zinc-600 hover:text-red-400 transition-colors focus-visible:ring-2 focus-visible:ring-copernicus-phosphor focus-visible:outline-none"
            title="Collapse Chat"
            aria-label="Collapse Chat"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      <div 
        ref={scrollRef} 
        role="log"
        aria-live="polite"
        className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-thin scrollbar-thumb-copernicus-steel"
      >
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center opacity-20 grayscale grayscale-100">
            <Hash size={48} className="text-copernicus-phosphor mb-4" />
            <div className="text-[10px] uppercase tracking-[0.2em]">Awaiting_Strategic_Input</div>
          </div>
        ) : (
          <>
            {messages.map(m => (
              <div key={m.id}>
                <ChatMessage
                  role={m.role}
                  content={m.role !== 'user' ? renderMessageContent(m.content, openFilePath, m.id) : m.content}
                  tokens={m.tokens ? { in: 0, out: m.tokens, cost: 0 } : undefined}
                />
              </div>
            ))}
            <ReviewSummaryCard />
            {pendingModelSwitch && (
              <div className="mx-4 mb-2 p-2 bg-zinc-900 border border-amber-500/30 rounded text-[10px]">
                <span className="text-amber-400 font-mono">Orchestrator → </span>
                <span className="text-zinc-300">Use <strong>{pendingModelSwitch.model}</strong> for {pendingModelSwitch.reason}</span>
                <div className="flex gap-2 mt-1.5">
                  <button
                    onClick={() => acceptModelSwitch(pendingModelSwitch)}
                    className="px-2 py-0.5 bg-copernicus-phosphor text-[#050505] rounded-none text-[9px] font-bold"
                  >
                    Accept
                  </button>
                  <button
                    onClick={() => rejectModelSwitch()}
                    className="px-2 py-0.5 border border-zinc-700 text-zinc-500 rounded text-[9px]"
                  >
                    Reject
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </>
  )
}
