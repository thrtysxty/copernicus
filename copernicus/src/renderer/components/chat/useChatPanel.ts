import log from '../../utils/logger'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { commandRegistry } from '../../commands/registry'
import { useIpcError } from '../../hooks/useIpcError'
import { useIpcCache } from '../../hooks/useIpcCache'
import { useLayoutStore } from '../../store/layout'
import { useUIBuilderStore } from '../../store/uiBuilderStore'
import { matchKnowledge } from './CopernicusKnowledgeBase'
import { unwrapIpc, IpcResult } from '../../types/ipc'
import { useMemoryRecall } from '../../hooks/useMemoryRecall'

const ipcRenderer = window.ipcRenderer

export interface Message {
  id: string
  role: 'user' | 'assistant' | 'copernicus'
  content: string
  tokens?: number
  showTourButton?: boolean
  imageBase64?: string
  imageMimeType?: string
}

export interface PendingImage {
  base64: string
  mimeType: string
  previewUrl: string
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
  provider: string
  hasKey: boolean
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

export function useChatPanel(openFilePath: string | null | undefined, rootPath: string | undefined, panelId: string = 'chat') {
  const invoke = useIpcError()
  const { data: modelsIpcResult } = useIpcCache('models:list', [], 30000)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [modelInner, setModelInner] = useState('claude-3-5-sonnet-20240620')
  const model = modelInner
  const setModel = useCallback((newModelId: string) => {
    if (newModelId !== modelInner) {
      lastSeenTs.current.set(modelInner, Date.now())
      isFirstCallAfterSwitch.current = true
      setModelInner(newModelId)
    }
  }, [modelInner])
  const [availableModels, setAvailableModels] = useState<ModelInfo[]>([])
  const [showModelPicker, setShowModelPicker] = useState(false)
  const [context, setContext] = useState<ContextItem[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [isRepoActive, setIsRepoActive] = useState(false)
  const [pendingImage, setPendingImage] = useState<PendingImage | null>(null)
  
  const activeStoryId = useLayoutStore(s => s.activeStoryId)

  const messagesRef = useRef(messages)
  messagesRef.current = messages

  const modelInnerRef = useRef(modelInner)
  modelInnerRef.current = modelInner

  const availableModelsRef = useRef(availableModels)
  availableModelsRef.current = availableModels

  useEffect(() => {
    invoke<any>('snapshot:restore', panelId).then(result => {
      const snap = unwrapIpc<any>(result)
      if (snap && snap.messages) {
        setMessages(snap.messages)
        if (snap.model_id) {
          setModelInner(snap.model_id)
        }
      } else {
        setMessages([])
      }
    }).catch(() => setMessages([]))

    return () => {
      const currentMessages = messagesRef.current.filter(msg => msg.role !== 'copernicus')
      if (currentMessages.length > 0) {
        invoke('snapshot:save', {
          panel_id: panelId,
          model_id: modelInnerRef.current,
          provider: availableModelsRef.current.find(m => m.id === modelInnerRef.current)?.provider ?? 'anthropic',
          messages: currentMessages
        }).catch(() => {})
      }
    }
  }, [panelId, invoke])

  const toggleFlip = useLayoutStore(s => s.toggleFlip)
  const centerMode = useLayoutStore(s => s.centerMode)
  const uiComponents = useUIBuilderStore(useShallow(s => s.uiComponents))
  const flippedPanes = useLayoutStore(useShallow(s => s.flippedPanes))

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
  const [authStatus, setAuthStatus] = useState<AuthStatus[]>([])
  const [savedPrompts, setSavedPrompts] = useState<SavedPrompt[]>([])
  const [lspWarning, setLspWarning] = useState<string | null>(null)
  const [isLspWarningDismissed, setIsLspWarningDismissed] = useState(false)
  const [contextUpdate, setContextUpdate] = useState<{ usedTokens: number; maxTokens: number; percentage: number } | null>(null)
  const [showCompactionBanner, setShowCompactionBanner] = useState(false)

  const streamingIdRef = useRef<string | null>(null)
  const isFirstCallAfterSwitch = useRef(false)
  const isFirstSendRef = useRef(true)
  const guideScrollRef = useRef<HTMLDivElement>(null)
  const lastSeenTs = useRef(new Map<string, number>())

  const isFlipped = flippedPanes.includes('chat')
  const activeProjectId = rootPath ?? 'global'
  const { memories } = useMemoryRecall(activeProjectId, 'chat', 5)

  useEffect(() => {
    setGuideMessages([]); setShowClaudeFallback(false)
    if (isFlipped) {
      setActiveBackTab('context')
      invoke<IpcResult<string>>('models:active').then(res => {
        const activeId = unwrapIpc<string>(res)
        if (activeId) setModel(activeId)
      }).catch(() => {})
    }
  }, [isFlipped, invoke])

  useEffect(() => {
    invoke<IpcResult<AuthStatus[]>>('auth:status').then(res => {
      const data = unwrapIpc<AuthStatus[]>(res);
      if (Array.isArray(data)) setAuthStatus(data);
    }).catch(() => {})
  }, [invoke, isFlipped])

  useEffect(() => {
    try {
      const stored = localStorage.getItem('copernicus:saved-prompts')
      if (stored) setSavedPrompts(JSON.parse(stored))
    } catch (err) { log.warn("[ChatPanel] Non-critical error:", err) }
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

  const dismissLspWarning = () => {
    setIsLspWarningDismissed(true)
    setLspWarning(null)
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

  // Sync cached models:list result (TTL 30s) to availableModels, then augment with ollama
  useEffect(() => {
    const staticModels = unwrapIpc<ModelInfo[]>(modelsIpcResult as any) ?? []
    if (staticModels.length === 0) return
    invoke<IpcResult<{ ok: boolean, models: ModelInfo[] }>>('models:list-ollama')
      .then((ollamaRes) => {
        const allModels = [...staticModels]
        const ollamaData = unwrapIpc<{ ok: boolean, models: ModelInfo[] }>(ollamaRes)
        if (ollamaData?.ok && Array.isArray(ollamaData.models)) {
          allModels.push(...ollamaData.models)
        }
        setAvailableModels(allModels)
      })
      .catch(() => { setAvailableModels(staticModels) })
  }, [modelsIpcResult, invoke])

  useEffect(() => {
    invoke<any>('devtime:status').then(res => { setIsRepoActive(!!(res && res.session)) })
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
    const removeSystemMessage = ipcRenderer.on('chat:receive-system', (_e, sysMsg: any) => {
      setMessages(prev => [...prev, { id: sysMsg.id, role: 'copernicus', content: sysMsg.content }])
    })
    const removeContextUpdate = ipcRenderer.on('chat:context-update', (_e, { usedTokens, maxTokens, percentage }) => {
      setContextUpdate({ usedTokens, maxTokens, percentage })
      if (percentage > 0.90) setShowCompactionBanner(true)
    })
    return () => { 
      removeToken(); removeDone(); removeError(); removeModelSwitch(); removeSystemMessage(); removeContextUpdate() 
    }
  }, [])

  const dismissCompactionBanner = () => setShowCompactionBanner(false)

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

    // Pre-flight LSP check
    if (!isLspWarningDismissed) {
      const res = await invoke<any>('lsp:workspace-check')
      if (res && res.errorCount > 0) {
        setLspWarning(`${res.errorCount} TypeScript error(s) in workspace — agent may produce incorrect fixes.`)
        return
      }
    }

    const currentInput = input.trim()
    const cmdContext = {
      appendMessage: (role: any, content: any) => setMessages(prev => [...prev, { id: `msg-${Date.now()}`, role, content }]),
      clearMessages: () => setMessages([]),
      setModel: (m: any) => setModel(m),
      getCurrentModel: () => model,
      setBackTab: (tab: any) => setActiveBackTab(tab),
      flip: () => toggleFlip('chat'),
      invoke
    }
    if (currentInput.startsWith('/')) { if (commandRegistry.execute(currentInput, cmdContext)) { setInput(''); setShowSuggestions(false); return } }
    setMessages(prev => [...prev, { 
      id: Date.now().toString(), 
      role: 'user', 
      content: input,
      imageBase64: pendingImage?.base64,
      imageMimeType: pendingImage?.mimeType
    }])
    let enrichedContent = currentInput
    if (context.length > 0) enrichedContent = context.map(c => `[CONTEXT: ${c.type.toUpperCase()} - ${c.label}]\n${c.content}`).join('\n\n') + `\n\n---\n\nUSER_INPUT: ${currentInput}`
    if (isFirstCallAfterSwitch.current) {
      isFirstCallAfterSwitch.current = false;
      try {
        const sinceTs = lastSeenTs.current.get(modelInner) ?? 0;
        const res = await invoke<any>('memory:get-working-set', activeProjectId, 'chat', 10);
        const rows = unwrapIpc<any[]>(res) ?? [];
        const deltaRows = rows.filter((r: any) => (r.ts * 1000) > sinceTs);
        
        if (deltaRows.length > 0) {
          const compRes = await invoke<any>('chat:compress-delta', { rows: deltaRows, maxTokens: 150 });
          const compData = unwrapIpc<{ summary: string }>(compRes);
          if (compData && compData.summary) {
            enrichedContent = `[DELTA]\n${compData.summary}\n\n${enrichedContent}`;
          }
        }
      } catch (e) {
        log.error('Failed to get context delta', e);
      }
    }
    if (centerMode === 'builder' && uiComponents.length > 0) enrichedContent += `\n\n<ui-canvas-context>\n${JSON.stringify(uiComponents, null, 2)}\n</ui-canvas-context>`
    
    const currentImage = pendingImage
    setInput(''); setContext([]); setPendingImage(null)
    
    if (currentInput.includes('@help')) { try { const result = await invoke<any>('fs:read-file', 'docs/help/USER_GUIDE.md'); const data = unwrapIpc<string>(result); if (data) enrichedContent = enrichedContent.replace('@help', `\n\n[CONTEXT: OPERATOR MANUAL]\n${data}\n`) } catch (err) { log.warn("[ChatPanel] Non-critical error:", err) } }
    const sessionId = `chat-${Date.now()}`; streamingIdRef.current = sessionId; setIsStreaming(true)
    if (openFilePath) { try { const diagRes = await invoke<any>('lsp:get-diagnostics', openFilePath); const diags = unwrapIpc<any[]>(diagRes) ?? []; if (diags.length > 0) enrichedContent = `[LSP diagnostics for ${openFilePath.split(/[/\\]/).pop()}]\n${diags.slice(0, 10).map((d: any) => `[${d.severity === 1 ? 'ERROR' : 'WARN'}] L${(d.range?.start?.line ?? 0) + 1}: ${d.message}`).join('\n')}\n\n---\n\n${enrichedContent}` } catch (err) { log.warn("[ChatPanel] Non-critical error:", err) } }
    setMessages(prev => [...prev, { id: `msg-${Date.now()}`, role: 'assistant', content: '' }])
    
    let systemPrompt: string | undefined = undefined
    if (isFirstSendRef.current) {
      if (memories && memories.length > 0) {
        systemPrompt = `[SESSION MEMORY]\n${memories.map(m => m.content).join('\n')}`
      }
      isFirstSendRef.current = false
    }

    invoke('chat:send', { 
      sessionId, 
      systemPrompt,
      bankId: panelId,
      messages: [
        ...messages.filter(m => m.role !== 'copernicus').map(m => ({ 
          role: m.role, 
          content: m.content,
          imageBase64: m.imageBase64,
          imageMimeType: m.imageMimeType
        })), 
        { 
          role: 'user', 
          content: enrichedContent,
          imageBase64: currentImage?.base64,
          imageMimeType: currentImage?.mimeType
        }
      ], 
      model
    }).catch((err) => {
      setIsStreaming(false)
      if (err?.error === 'VISION_NOT_SUPPORTED') {
         setMessages(prev => {
           const updated = [...prev];
           const last = updated[updated.length - 1];
           if (last?.role === 'assistant') {
             updated[updated.length - 1] = { ...last, content: `⚠ ${err.message}` };
           }
           return updated;
         });
      }
    })
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
    } catch (err) { log.warn("[ChatPanel] Non-critical error:", err) }
  }

  const handleFileAttach = async () => {
    try {
      const filePathResult = await invoke<string | null>('dialog:open-file')
      const filePath = unwrapIpc<string | null>(filePathResult)
      if (!filePath) return
      const result = await invoke<any>('fs:read-file', filePath); const content = unwrapIpc<string>(result)
      if (typeof content === 'string') setContext(prev => [...prev, { type: 'file', label: filePath.split(/[/\\]/).pop() ?? filePath, content: `\n// File: ${filePath}\n${content}\n` }])
    } catch (err) { log.warn("[ChatPanel] Non-critical error:", err) }
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
    isFlipped,
    pendingImage,
    setPendingImage,
    lspWarning,
    dismissLspWarning,
    contextUpdate,
    showCompactionBanner,
    dismissCompactionBanner
  }
}
