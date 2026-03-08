import { useState, useEffect, useRef, useCallback } from 'react'
import { commandRegistry } from '../../commands/registry'
import { useIpcError } from '../../hooks/useIpcError'
import { useLayoutStore } from '../../store/layout'
import log from '../../utils/logger'
import { matchKnowledge } from './CopernicusKnowledgeBase'
import { unwrapIpc, IpcResult } from '../../types/ipc'

const ipcRenderer = window.ipcRenderer

export interface Message {
  id: string
  role: 'user' | 'assistant' | 'copernicus'
  content: string
  tokens?: number
  showTourButton?: boolean
}

export interface ContextItem {
  type: 'file' | 'story' | 'help'
  label: string
  content: string
}

export interface ModelInfo {
  id: string
  name: string
  provider: string
  contextWindow: number
}

export interface AuthStatus {
  isActive: boolean
  user?: any
}

export interface SavedPrompt {
  id: string
  name: string
  text: string
}

export type PickerMode = 'none' | 'file' | 'story' | 'codebase'

export interface PickerResult {
  label: string
  value: string
  payload: string
}

export function useChatPanel(openFilePath: string | null | undefined, rootPath: string | undefined) {
  const invoke = useIpcError()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [model, setModel] = useState('claude-3-5-sonnet-20240620')
  const [availableModels, setAvailableModels] = useState<ModelInfo[]>([])
  const [showModelPicker, setShowModelPicker] = useState(false)
  const [context, setContext] = useState<ContextItem[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [isRepoActive, setIsRepoActive] = useState(false)
  const {
    activeStoryId,
    toggleFlip,
    centerMode,
    uiComponents,
    flippedPanes
  } = useLayoutStore()

  const [slashSuggestions, setSlashSuggestions] = useState<any[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [pickerMode, setPickerMode] = useState<PickerMode>('none')
  const [pickerResults, setPickerResults] = useState<PickerResult[]>([])
  const [pendingModelSwitch, setPendingModelSwitch] = useState<{ model: string; reason: string; sessionId: string } | null>(null)
  const [activeBackTab, setActiveBackTab] = useState('context')
  const [guideMessages, setGuideMessages] = useState<Message[]>([])
  const [guideInput, setGuideInput] = useState('')
  const [showClaudeFallback, setShowClaudeFallback] = useState(false)
  const [lastGuideQuestion, setLastGuideQuestion] = useState('')
  const [isSavingPrompt, setIsSavingPrompt] = useState(false)
  const [newPromptName, setNewPromptName] = useState('')
  const [authStatus, setAuthStatus] = useState<AuthStatus | null>(null)
  const [savedPrompts, setSavedPrompts] = useState<SavedPrompt[]>([])

  const streamingIdRef = useRef<string | null>(null)
  const isFirstCallAfterSwitch = useRef(false)
  const memoryInjectedRef = useRef(false)
  const guideScrollRef = useRef<HTMLDivElement>(null)

  const isFlipped = flippedPanes.includes('chat')

  useEffect(() => {
    setGuideMessages([]); setShowClaudeFallback(false)
    if (isFlipped) {
      setActiveBackTab('context')
      invoke<string>('models:active').then(activeId => {
        if (activeId) setModel(activeId)
      }).catch(() => {})
    }
  }, [isFlipped, invoke])

  useEffect(() => {
    invoke<AuthStatus>('auth:status').then(status => setAuthStatus(status)).catch(() => {})
  }, [invoke, isFlipped])

  useEffect(() => {
    try {
      const stored = localStorage.getItem('copernicus:saved-prompts')
      if (stored) setSavedPrompts(JSON.parse(stored))
    } catch {}
  }, [isFlipped])

  const confirmSavePrompt = () => {
    const text = input.trim(); const name = newPromptName.trim()
    if (!text || !name) return
    const updated = [...savedPrompts, { id: Date.now().toString(), name, text }]
    setSavedPrompts(updated); localStorage.setItem('copernicus:saved-prompts', JSON.stringify(updated))
    setIsSavingPrompt(false); setNewPromptName('')
  }

  const handleClearContext = () => setContext([])
  const deletePrompt = (id: string) => {
    const updated = savedPrompts.filter(p => p.id !== id)
    setSavedPrompts(updated); localStorage.setItem('copernicus:saved-prompts', JSON.stringify(updated))
  }
  const usePrompt = (text: string) => { setInput(text); toggleFlip('chat') }

  const handleAskClaude = () => {
    toggleFlip('chat'); setInput(lastGuideQuestion); setShowClaudeFallback(false); setGuideMessages([])
    setTimeout(() => { (document.querySelector('textarea[data-chat-input]') as any)?.focus() }, 100)
  }

  const handleGuideSubmit = () => {
    const q = guideInput.trim()
    if (!q) return
    setLastGuideQuestion(q); setGuideMessages(p => [...p, { id: `gu-${Date.now()}`, role: 'user', content: q }]); setGuideInput('')
    const match = matchKnowledge(q)
    if (match) setGuideMessages(p => [...p, { id: `gc-${Date.now()}`, role: 'copernicus', content: match.response, showTourButton: match.showTourButton }])
    else setShowClaudeFallback(true)
  }

  const exportChat = () => {
    const text = messages.map(m => `${m.role.toUpperCase()}:\n${m.content}\n`).join('\n---\n\n')
    const blob = new Blob([text], { type: 'text/plain' }); const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `chat-export-${Date.now()}.txt`; a.click(); URL.revokeObjectURL(url)
  }

  useEffect(() => {
    invoke<ModelInfo[]>('models:list').then(models => setAvailableModels(models ?? [])).catch(log.error)
    invoke<any>('devtime:status').then(res => { setIsRepoActive(!!(res && res.session)) })
  }, [invoke])

  useEffect(() => {
    if (memoryInjectedRef.current) return
    memoryInjectedRef.current = true
    invoke<IpcResult<any[]>>('db:search-memory', 5).then((res) => {
      if (res?.ok && res.data && res.data.length > 0) {
        const memories = res.data.map((m: { content: string }) => m.content).join('\n')
        setMessages([{ id: `msg-${Date.now()}`, role: 'assistant', content: `[Project Memory]\n${memories}\n\n---\n\nMemory injected silently.` }])
      }
    }).catch(() => {})
  }, [invoke])

  useEffect(() => {
    if (!ipcRenderer) return
    const removeToken = ipcRenderer.on('chat:token', (_e, { sessionId, token }) => {
      if (sessionId !== streamingIdRef.current) return
      setMessages(prev => {
        const updated = [...prev]; const last = updated[updated.length - 1]
        if (last?.role === 'assistant' || last?.role === 'copernicus') updated[updated.length - 1] = { ...last, content: last.content + token }
        return updated
      })
    })
    const removeDone = ipcRenderer.on('chat:done', (_e, { sessionId, outputTokens }) => {
      if (sessionId !== streamingIdRef.current) return
      setIsStreaming(false); streamingIdRef.current = null
      setMessages(prev => {
        const updated = [...prev]; const last = updated[updated.length - 1]
        if (last?.role === 'assistant' || last?.role === 'copernicus') updated[updated.length - 1] = { ...last, tokens: outputTokens }
        return updated
      })
    })
    const removeError = ipcRenderer.on('chat:error', (_e, { sessionId, error }) => {
      if (sessionId !== streamingIdRef.current) return
      setIsStreaming(false); streamingIdRef.current = null
      setMessages(prev => {
        const updated = [...prev]; const last = updated[updated.length - 1]
        if (last?.role === 'assistant' || last?.role === 'copernicus') updated[updated.length - 1] = { ...last, content: `⚠ Error: ${error}` }
        return updated
      })
    })
    const removeModelSwitch = ipcRenderer.on('chat:confirm-model-switch', (_e, payload) => setPendingModelSwitch(payload))
    return () => { removeToken(); removeDone(); removeError(); removeModelSwitch() }
  }, [])

  const handlePickerSelect = useCallback(async (item: PickerResult) => {
    const currentMode = pickerMode; setPickerMode('none'); setPickerResults([])
    let injectedContent = item.payload
    if (currentMode === 'file') {
      try { const result = await invoke<string>('fs:read-file', item.value); injectedContent = result ?? `[Failed to read ${item.label}]` } catch { injectedContent = `[Failed to read ${item.label}]` }
      setContext(prev => [...prev, { type: 'file', label: item.label, content: `\n// File: ${item.value}\n${injectedContent}\n` }])
    } else if (currentMode === 'story') { setContext(prev => [...prev, { type: 'story', label: item.label, content: injectedContent }]) }
    else if (currentMode === 'codebase') { setContext(prev => [...prev, { type: 'file', label: `@codebase: ${item.label}`, content: `\n// Semantic match: ${item.value}\n${injectedContent}\n` }]) }
    const atMarker = (currentMode === 'file' || currentMode === 'codebase') ? '@' : '#'
    setInput(prev => { const idx = prev.lastIndexOf(atMarker); return idx !== -1 ? prev.slice(0, idx) : prev })
  }, [pickerMode, invoke])

  const handleSendMessage = async () => {
    if ((!input.trim() && context.length === 0) || isStreaming) return
    const currentInput = input.trim()
    const cmdContext = {
      appendMessage: (role: any, content: any) => setMessages(prev => [...prev, { id: `msg-${Date.now()}`, role, content }]),
      clearMessages: () => setMessages([]),
      setModel: (m: any) => setModel(m),
      getCurrentModel: () => model,
      setBackTab: (tab: any) => setActiveBackTab(tab),
      flip: () => toggleFlip('chat')
    }
    if (currentInput.startsWith('/')) { if (commandRegistry.execute(currentInput, cmdContext)) { setInput(''); setShowSuggestions(false); return } }
    setMessages(prev => [...prev, { id: Date.now().toString(), role: 'user', content: input }])
    let enrichedContent = currentInput
    if (context.length > 0) enrichedContent = context.map(c => `[CONTEXT: ${c.type.toUpperCase()} - ${c.label}]\n${c.content}`).join('\n\n') + `\n\n---\n\nUSER_INPUT: ${currentInput}`
    if (isFirstCallAfterSwitch.current) {
      isFirstCallAfterSwitch.current = false; const snapRes = await invoke<any>('snapshot:restore', 'chat'); const snapData = unwrapIpc<any>(snapRes)
      if (snapData?.messages) { try { const m = typeof snapData.messages === 'string' ? JSON.parse(snapData.messages) : snapData.messages; enrichedContent = `[CONTEXT HANDOFF]\nPrevious session context:\n${m.map((msg: any) => `${msg.role}: ${msg.content}`).join('\n')}\n\n${enrichedContent}` } catch {} }
    }
    if (centerMode === 'builder' && uiComponents.length > 0) enrichedContent += `\n\n<ui-canvas-context>\n${JSON.stringify(uiComponents, null, 2)}\n</ui-canvas-context>`
    setInput(''); setContext([])
    if (currentInput.includes('@help')) { try { const result = await invoke<any>('fs:read-file', 'docs/help/USER_GUIDE.md'); const data = unwrapIpc<string>(result); if (data) enrichedContent = enrichedContent.replace('@help', `\n\n[CONTEXT: OPERATOR MANUAL]\n${data}\n`) } catch {} }
    const sessionId = `chat-${Date.now()}`; streamingIdRef.current = sessionId; setIsStreaming(true)
    if (openFilePath) { try { const diagRes = await invoke<any>('lsp:get-diagnostics', openFilePath); const diags = unwrapIpc<any[]>(diagRes) ?? []; if (diags.length > 0) enrichedContent = `[LSP diagnostics for ${openFilePath.split(/[/\\]/).pop()}]\n${diags.slice(0, 10).map((d: any) => `[${d.severity === 1 ? 'ERROR' : 'WARN'}] L${(d.range?.start?.line ?? 0) + 1}: ${d.message}`).join('\n')}\n\n---\n\n${enrichedContent}` } catch {} }
    setMessages(prev => [...prev, { id: `msg-${Date.now()}`, role: 'assistant', content: '' }])
    invoke('chat:send', { sessionId, messages: [...messages.filter(m => m.role !== 'copernicus').map(m => ({ role: m.role, content: m.content })), { role: 'user', content: enrichedContent }], model }).catch(() => setIsStreaming(false))
  }

  const handleSaveToStory = async (content: string) => {
    if (!activeStoryId) return
    try {
      const currentContent = await invoke<string>('stories:get-content', activeStoryId); 
      let updatedContent = currentContent ?? ''; const implMarker = '## Implementation'
      if (updatedContent.includes(implMarker)) updatedContent = updatedContent.split(implMarker)[0] + `${implMarker}\n${content}\n`
      else updatedContent = `${updatedContent}\n\n${implMarker}\n${content}\n`
      await invoke('stories:update-content', { id: activeStoryId, content: updatedContent })
      window.ipcRenderer.send('db:log-intent', `Architected ${activeStoryId} via Chat`, 'COMPLETED', 'chat')
    } catch {}
  }

  const handleFileAttach = async () => {
    try {
      const filePath = await invoke<string | null>('fs:open-file')
      if (!filePath) return
      const result = await invoke<any>('fs:read-file', filePath); const content = unwrapIpc<string>(result)
      if (typeof content === 'string') setContext(prev => [...prev, { type: 'file', label: filePath.split(/[/\\]/).pop() ?? filePath, content: `\n// File: ${filePath}\n${content}\n` }])
    } catch {}
  }

  const triggerPicker = async (mode: any) => {
    setPickerMode(mode)
    if (mode === 'file') { const result = await invoke<any>('fs:list-dir', rootPath ?? ''); const data = unwrapIpc<any[]>(result); if (Array.isArray(data)) setPickerResults(data.filter(n => !n.isDir).map(n => ({ label: n.name, value: n.path, payload: n.path }))) }
    else if (mode === 'story') { const result = await invoke<any[]>('stories:list'); const data = unwrapIpc<any[]>(result); if (Array.isArray(data)) setPickerResults(data.map((s: any) => ({ label: s.title ?? s.id, value: s.id, payload: s.content ?? '' }))) }
  }

  const acceptModelSwitch = (sw: any) => { setModel(sw.model); setPendingModelSwitch(null); invoke('chat:confirm-model-switch', { sessionId: sw.sessionId, accepted: true, model: sw.model }) }
  const rejectModelSwitch = () => { if (pendingModelSwitch) invoke('chat:confirm-model-switch', { sessionId: pendingModelSwitch.sessionId, accepted: false }); setPendingModelSwitch(null) }

  return {
    messages, setMessages,
    input, setInput,
    model, setModel,
    availableModels, setAvailableModels,
    showModelPicker, setShowModelPicker,
    context, setContext,
    isStreaming, setIsStreaming,
    isRepoActive, setIsRepoActive,
    activeStoryId, toggleFlip,
    slashSuggestions, setSlashSuggestions,
    showSuggestions, setShowSuggestions,
    pickerMode, setPickerMode,
    pickerResults, setPickerResults,
    pendingModelSwitch, setPendingModelSwitch,
    activeBackTab, setActiveBackTab,
    guideMessages, setGuideMessages,
    guideInput, setGuideInput,
    showClaudeFallback, setShowClaudeFallback,
    lastGuideQuestion, setLastGuideQuestion,
    isSavingPrompt, setIsSavingPrompt,
    newPromptName, setNewPromptName,
    authStatus, setAuthStatus,
    savedPrompts, setSavedPrompts,
    guideScrollRef,
    confirmSavePrompt,
    handleClearContext,
    deletePrompt,
    usePrompt,
    handleAskClaude,
    handleGuideSubmit,
    exportChat,
    handlePickerSelect,
    handleSendMessage,
    handleSaveToStory,
    handleFileAttach,
    triggerPicker,
    acceptModelSwitch,
    rejectModelSwitch,
    invoke,
    isFlipped
  }
}
