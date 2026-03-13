import React, { useState } from 'react'
import { RotateCcw, Brain } from 'lucide-react'
import { GuideCopernicus } from './GuideCopernicus'
import { Message, ContextItem, ModelInfo, AuthStatus, SavedPrompt } from './useChatPanel'

interface ChatBackFaceProps {
  input: string
  activeBackTab: string
  setActiveBackTab: (v: string) => void
  toggleFlip: (id: string) => void
  model: string
  setModel: (v: string) => void
  availableModels: ModelInfo[]
  totalTokens: number
  contextMaxTokens: number
  context: ContextItem[]
  setContext: React.Dispatch<React.SetStateAction<ContextItem[]>>
  handleClearContext: () => void
  authStatus: AuthStatus[]
  isSavingPrompt: boolean
  setIsSavingPrompt: (v: boolean) => void
  newPromptName: string
  setNewPromptName: (v: string) => void
  confirmSavePrompt: () => void
  savedPrompts: SavedPrompt[]
  usePrompt: (text: string) => void
  deletePrompt: (id: string) => void
  messages: Message[]
  exportChat: () => void
  guideMessages: Message[]
  guideInput: string
  setGuideInput: (v: string) => void
  handleGuideSubmit: () => void
  showClaudeFallback: boolean
  handleAskClaude: () => void
  setShowClaudeFallback: (v: boolean) => void
  guideScrollRef: React.RefObject<HTMLDivElement>
  invoke: any
}

export const ChatBackFace: React.FC<ChatBackFaceProps> = ({
  input,
  activeBackTab,
  setActiveBackTab,
  toggleFlip,
  model,
  setModel,
  availableModels,
  totalTokens,
  contextMaxTokens,
  context,
  setContext,
  handleClearContext,
  authStatus,
  isSavingPrompt,
  setIsSavingPrompt,
  newPromptName,
  setNewPromptName,
  confirmSavePrompt,
  savedPrompts,
  usePrompt,
  deletePrompt,
  messages,
  exportChat,
  guideMessages,
  guideInput,
  setGuideInput,
  handleGuideSubmit,
  showClaudeFallback,
  handleAskClaude,
  setShowClaudeFallback,
  guideScrollRef,
  invoke,
}) => {
  const tabs = [
    { id: 'context', label: 'Context' },
    { id: 'persona', label: 'Persona' },
    { id: 'prompts', label: 'Prompts' },
    { id: 'history', label: 'History' },
    { id: 'guide', label: 'Guide' }
  ]

  const lastAssistantMsg = [...messages].reverse().find(m => m.role === 'assistant' || m.role === 'copernicus')
  const [showSaved, setShowSaved] = useState(false)

  const handleSaveToMemory = async () => {
    if (!lastAssistantMsg) return
    try {
      await invoke('db:add-memory', { 
        content: lastAssistantMsg.content, 
        importance: 7, 
        source: 'chat-manual' 
      })
      setShowSaved(true)
      setTimeout(() => setShowSaved(false), 2000)
    } catch (err) {
      console.error('Failed to save memory', err)
    }
  }

  return (
    <div className="flex flex-col h-full bg-copernicus-bg text-zinc-300 font-mono">
      {/* Tab Bar AC-1 */}
      <div className="flex bg-[#111] border-b border-copernicus-steel/30 shrink-0">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveBackTab(tab.id)}
            className={`flex-1 py-2 text-[9px] uppercase font-bold tracking-widest transition-colors ${
              activeBackTab === tab.id
                ? 'bg-copernicus-phosphor text-[#050505] rounded-none'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
        <button 
          onClick={() => toggleFlip('chat')} 
          className="px-3 text-zinc-600 hover:text-copernicus-phosphor transition-colors border-l border-white/5"
          title="Rotate Panel"
        >
          <RotateCcw size={12} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 scrollbar-thin scrollbar-thumb-copernicus-steel">
        {/* AC-2 Context Tab */}
        {activeBackTab === 'context' && (
          <div className="space-y-6">
            <div>
              <div className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1">Model Context Usage</div>
              <div className="text-xs flex items-center justify-between">
                <span>{model} • {availableModels.find(m => m.id === model)?.provider || '—'}</span>
              </div>
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
              <div className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1">LSP Status</div>
              <div className="text-xs text-zinc-400">LSP: connecting…</div>
            </div>

            <div>
              <div className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1 flex justify-between items-center">
                <span>Attached Files ({context.length})</span>
                {context.length > 0 && (
                  <button 
                    onClick={handleClearContext} 
                    className="text-[9px] hover:text-copernicus-phosphor transition-colors border border-zinc-800 px-1.5 py-0.5 rounded"
                  >
                    Clear Context
                  </button>
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

        {/* AC-3 Persona Tab */}
        {activeBackTab === 'persona' && (
          <div className="space-y-6">
            <div>
              <div className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1">Current Persona</div>
              <div className="flex items-center justify-between bg-zinc-900 border border-copernicus-steel/30 p-3 rounded">
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-bold text-copernicus-phosphor">
                    {availableModels.find(m => m.id === model)?.name || model}
                  </span>
                  <span className="text-[9px] text-zinc-500 uppercase">
                    {availableModels.find(m => m.id === model)?.provider || '—'} • {model}
                  </span>
                </div>
                <div 
                  className={`w-2 h-2 rounded-full ${authStatus?.length > 0 ? 'bg-green-500 shadow-[0_0_5px_rgba(34,197,94,0.5)]' : 'bg-red-500'}`} 
                  title={authStatus?.length > 0 ? 'Authenticated' : 'Not Authenticated'}
                />

              </div>
            </div>

            <div>
              <div className="text-[10px] text-zinc-500 uppercase tracking-widest mb-2">Switch Model</div>
              <select
                className="w-full bg-zinc-900 border border-copernicus-steel rounded px-2 py-2 text-xs text-zinc-300 focus:border-copernicus-phosphor outline-none appearance-none"
                value={model}
                onChange={async (e) => {
                  const newModel = e.target.value
                  try {
                      await invoke('models:set-active', newModel)
                      setModel(newModel)
                  } catch (err) {
                      console.error('Failed to set model', err)
                  }
                }}
              >
                {availableModels.map(m => (
                  <option key={m.id} value={m.id}>{m.name} ({m.provider})</option>
                ))}
              </select>
              <div className="mt-2 text-[9px] text-zinc-600 text-center italic">
                Select a model to switch the global active persona.
              </div>
            </div>
          </div>
        )}

        {/* AC-4 Prompts Tab */}
        {activeBackTab === 'prompts' && (
          <div className="space-y-4 flex flex-col h-full">
            {isSavingPrompt ? (
              <div className="bg-zinc-900 border border-copernicus-phosphor p-3 rounded space-y-3">
                <div className="text-[10px] text-copernicus-phosphor uppercase font-bold">New Saved Prompt</div>
                <input
                  autoFocus
                  placeholder="Enter short name..."
                  className="w-full bg-black border border-copernicus-steel rounded px-2 py-1.5 text-xs text-zinc-300 focus:border-copernicus-phosphor outline-none"
                  value={newPromptName}
                  onChange={e => setNewPromptName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') confirmSavePrompt()
                    if (e.key === 'Escape') setIsSavingPrompt(false)
                  }}
                />
                <div className="flex gap-2">
                  <button 
                    onClick={confirmSavePrompt}
                    className="flex-1 bg-copernicus-phosphor text-[#050505] text-[10px] font-bold py-1 uppercase"
                  >
                    Confirm Save
                  </button>
                  <button 
                    onClick={() => setIsSavingPrompt(false)}
                    className="flex-1 border border-zinc-700 text-zinc-400 text-[10px] font-bold py-1 uppercase"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setIsSavingPrompt(true)}
                disabled={!input.trim()}
                className="w-full bg-zinc-900 hover:bg-copernicus-phosphor/10 border border-copernicus-steel hover:border-copernicus-phosphor text-zinc-300 transition-colors text-[10px] font-bold py-2 rounded flex items-center justify-center gap-2 uppercase tracking-wider disabled:opacity-50"
              >
                + Save Current Input
              </button>
            )}

            <div className="flex-1 space-y-2 overflow-y-auto pr-1">
              {savedPrompts.length === 0 ? (
                <div className="text-xs text-zinc-600 text-center py-8 border border-dashed border-zinc-800 rounded">
                  No saved prompts yet.
                </div>
              ) : (
                savedPrompts.map(p => (
                  <div key={p.id} className="bg-zinc-900 border border-copernicus-steel/50 rounded p-2 hover:border-zinc-700 transition-colors">
                    <div className="text-xs font-bold text-copernicus-phosphor mb-1 uppercase tracking-tight">{p.name}</div>
                    <div className="text-[10px] text-zinc-500 truncate mb-2 italic">"{p.text}"</div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => usePrompt(p.text)}
                        className="flex-1 text-[9px] uppercase font-bold py-1 bg-zinc-800 hover:bg-copernicus-phosphor/20 hover:text-copernicus-phosphor transition-colors rounded"
                      >
                        Use
                      </button>
                      <button
                        onClick={() => deletePrompt(p.id)}
                        className="px-2 text-[9px] uppercase font-bold py-1 bg-zinc-800 hover:bg-red-500/20 hover:text-red-400 transition-colors rounded"
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

        {/* AC-5 History Tab */}
        {activeBackTab === 'history' && (
          <div className="space-y-4 flex flex-col h-full overflow-hidden">
            <div className="flex flex-col gap-2">
              <button
                onClick={exportChat}
                className="w-full bg-zinc-900 hover:bg-copernicus-phosphor/10 border border-copernicus-steel hover:border-copernicus-phosphor text-zinc-300 transition-colors text-[10px] font-bold py-2 rounded flex items-center justify-center gap-2 uppercase tracking-wider"
              >
                Export Chat (.txt)
              </button>
              
              <button
                onClick={handleSaveToMemory}
                disabled={!lastAssistantMsg}
                className={`w-full bg-zinc-900 border border-copernicus-steel text-zinc-300 transition-colors text-[10px] font-bold py-2 rounded flex items-center justify-center gap-2 uppercase tracking-wider ${!lastAssistantMsg ? 'opacity-40 cursor-not-allowed' : 'hover:bg-copernicus-phosphor/10 hover:border-copernicus-phosphor'}`}
              >
                <Brain size={12} className={lastAssistantMsg ? 'text-copernicus-phosphor' : ''} />
                {showSaved ? 'Saved ✓' : 'Save to Memory'}
              </button>
            </div>

            <div className="flex-1 space-y-2 overflow-y-auto pr-1">
              {messages.length === 0 ? (
                <div className="text-xs text-zinc-600 text-center py-8 border border-dashed border-zinc-800 rounded">
                  No conversation history.
                </div>
              ) : (
                messages.slice(-20).map((m, i) => (
                  <div key={i} className="bg-zinc-900 border border-copernicus-steel/30 rounded p-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-[9px] font-bold uppercase ${m.role === 'user' ? 'text-zinc-500' : 'text-copernicus-phosphor'}`}>
                        {m.role === 'user' ? 'You' : (availableModels.find(x => x.id === model)?.name || model)}
                      </span>
                      {m.tokens && <span className="text-[8px] text-zinc-700">{m.tokens} tokens</span>}
                    </div>
                    <div className="text-xs text-zinc-400 line-clamp-2 italic">
                      {m.content.substring(0, 120)}{m.content.length > 120 ? '...' : ''}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Story 188: Guide Tab Implementation */}
        {activeBackTab === 'guide' && (
          <GuideCopernicus
            guideMessages={guideMessages}
            guideInput={guideInput}
            setGuideInput={setGuideInput}
            handleGuideSubmit={handleGuideSubmit}
            showClaudeFallback={showClaudeFallback}
            handleAskClaude={handleAskClaude}
            setShowClaudeFallback={setShowClaudeFallback}
            guideScrollRef={guideScrollRef}
          />
        )}
      </div>
    </div>
  )
}
