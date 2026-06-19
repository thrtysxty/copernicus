import log from '../../utils/logger'
import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Plus, Trash2, SplitSquareHorizontal, CheckCircle2, AlertCircle, Clock, Save, FileText, Bot, Wrench, Terminal, ShieldAlert, X, ChevronDown, ChevronRight } from 'lucide-react'
import { useIpcError } from '../../hooks/useIpcError'
import { unwrapIpc } from '../../types/ipc'
import { IntelligenceDocument, IntelligenceDocType, SyncStatusValue, ProviderKey, IntelligenceDocSuggestion } from '../../../../electron/intelligence/types'
import { IntelligenceSuggestBanner } from './IntelligenceSuggestBanner'
import { NotebookLMSection } from './NotebookLMSection'
import { CANONICAL_PROVIDERS, PROVIDER_METADATA } from '../wizard/providerRegistry'


function parseSoulMd(content: string) {
  const result = {
    agentName: '',
    description: '',
    communicationStyle: '',
    coreValues: [] as string[],
    expertiseAreas: [] as string[]
  };

  if (!content) return result;

  const lines = content.split('\n');
  let currentSection = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]?.trim();
    if (line === undefined) continue;
    if (!line) continue;

    if (line.startsWith('# ')) {
      result.agentName = line.substring(2).trim();
      currentSection = 'description';
    } else if (line.startsWith('**Communication Style:**')) {
      result.communicationStyle = line.substring(24).trim();
      currentSection = 'communicationStyle';
    } else if (line.startsWith('**Core Values:**')) {
      currentSection = 'coreValues';
    } else if (line.startsWith('**Areas of Expertise:**')) {
      const parts = line.substring(23).split(',').map(s => s.trim()).filter(Boolean);
      result.expertiseAreas = parts;
      currentSection = 'expertiseAreas';
    } else {
      if (currentSection === 'description') {
        result.description += (result.description ? '\n' : '') + line;
      } else if (currentSection === 'communicationStyle') {
        result.communicationStyle += ' ' + line;
      } else if (currentSection === 'coreValues') {
        if (line.startsWith('- ')) {
          result.coreValues.push(line.substring(2).trim());
        }
      }
    }
  }

  return result;
}

function serializeSoulMd(data: {
  agentName?: string | null,
  description?: string | null,
  communicationStyle?: string | null,
  coreValues?: string[] | null,
  expertiseAreas?: string[] | null
}): string {
  let output = '';
  if (data.agentName) {
    output += `# ${data.agentName}\n\n`;
  }
  if (data.description) {
    output += `${data.description}\n\n`;
  }
  if (data.communicationStyle) {
    output += `**Communication Style:** ${data.communicationStyle}\n\n`;
  }
  if (data.coreValues && data.coreValues.length > 0) {
    output += '**Core Values:**\n';
    data.coreValues.forEach(val => {
      output += `- ${val}\n`;
    });
    output += '\n';
  }
  if (data.expertiseAreas && data.expertiseAreas.length > 0) {
    output += `**Areas of Expertise:** ${data.expertiseAreas.join(', ')}\n\n`;
  }
  return output.trim();
}

const TYPE_ORDER: IntelligenceDocType[] = ['instruction', 'rule', 'agent', 'skill', 'command']
const TYPE_COLORS: Record<IntelligenceDocType, { bg: string, text: string, icon: React.ReactNode }> = {
  instruction: { bg: 'bg-indigo-500/20', text: 'text-indigo-400', icon: <FileText size={12} /> },
  rule: { bg: 'bg-violet-500/20', text: 'text-violet-400', icon: <ShieldAlert size={12} /> },
  agent: { bg: 'bg-cyan-500/20', text: 'text-cyan-400', icon: <Bot size={12} /> },
  skill: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', icon: <Wrench size={12} /> },
  command: { bg: 'bg-amber-500/20', text: 'text-amber-400', icon: <Terminal size={12} /> }
}

interface IntelligenceManagerProps {
  onClose?: () => void
}

export const IntelligenceManager: React.FC<IntelligenceManagerProps> = ({ onClose }) => {
  const invoke = useIpcError()
  const [documents, setDocuments] = useState<IntelligenceDocument[]>([])
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null)
  const [selectedNotebookId, setSelectedNotebookId] = useState<string | null>(null)
  const [showNlmBanner, setShowNlmBanner] = useState(true)
  const [isCreating, setIsCreating] = useState(false)
  const [newDocType, setNewDocType] = useState<IntelligenceDocType>('instruction')
  const [newDocTitle, setNewDocTitle] = useState('')
  const [newDocDesc, setNewDocDesc] = useState('')
  
  const [editorContent, setEditorContent] = useState('')
  const [editorTitle, setEditorTitle] = useState('')
  const [editorDesc, setEditorDesc] = useState('')
  const [instructionFields, setInstructionFields] = useState({
    agentName: '',
    description: '',
    communicationStyle: '',
    coreValues: [] as string[],
    expertiseAreas: [] as string[],
    isParsed: false
  })
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'syncing' | 'error'>('saved')
  
  const [suggestions, setSuggestions] = useState<IntelligenceDocSuggestion[]>([])
  const [hasDismissedSuggestions, setHasDismissedSuggestions] = useState(false)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)

  const selectedDoc = documents.find(d => d.id === selectedDocId)

  const fetchDocs = useCallback(async () => {
    try {
      const res = await invoke<IpcResult<IntelligenceDocument[]>>('intel:list', { projectId: 'current' })
      const docs = unwrapIpc<IntelligenceDocument[]>(res)
      if (docs) {
        setDocuments(docs)
        if (docs.length === 0) {
          try {
            const suggRes = await invoke<IpcResult<IntelligenceDocSuggestion[]>>('intel:suggest', { projectId: 'current' })
            const suggs = unwrapIpc<IntelligenceDocSuggestion[]>(suggRes)
            if (suggs && suggs.length > 0) {
              setSuggestions(suggs)
            }
          } catch (e) {
            log.error('Failed to fetch intelligence suggestions', e)
          }
        }
      }
    } catch (e) {
      log.error('Failed to fetch intelligence docs', e)
    }
  }, [invoke])

  useEffect(() => {
    fetchDocs()
  }, [fetchDocs])



  useEffect(() => {
    if (selectedDoc) {
      setEditorContent(selectedDoc.content || '')
      setEditorTitle(selectedDoc.title || '')
      setEditorDesc(selectedDoc.description || '')

      if (selectedDoc.type === 'instruction') {
        const parsed = parseSoulMd(selectedDoc.content || '');
        setInstructionFields({
          agentName: parsed.agentName || selectedDoc.title || '',
          description: parsed.description || selectedDoc.description || '',
          communicationStyle: parsed.communicationStyle || '',
          coreValues: parsed.coreValues || [],
          expertiseAreas: parsed.expertiseAreas || [],
          isParsed: !!(parsed.agentName || parsed.communicationStyle || parsed.coreValues.length > 0 || parsed.expertiseAreas.length > 0)
        });


      }

    } else {
      setEditorContent('')
      setEditorTitle('')
      setEditorDesc('')
      setInstructionFields({ agentName: '', description: '', communicationStyle: '', coreValues: [], expertiseAreas: [], isParsed: false });

    }
  }, [selectedDocId, selectedDoc?.content])



  useEffect(() => {
    const removeSyncComplete = window.ipcRenderer.on('intel:sync-complete', (_e: any, payload: { docId: string, provider: ProviderKey, status: SyncStatusValue }) => {
      setDocuments(prev => prev.map(doc => {
        if (doc.id === payload.docId) {
          return {
            ...doc,
            syncStatus: {
              ...(doc.syncStatus || {}),
              [payload.provider]: payload.status
            }
          }
        }
        return doc
      }))
      
      if (payload.docId === selectedDocId) {
        setSaveStatus('saved')
      }
    })

    return () => {
      removeSyncComplete()
    }
  }, [selectedDocId])

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleUpdate = async (docId: string, updates: Partial<IntelligenceDocument>) => {
    setSaveStatus('saving')
    try {
      const res = await invoke<IpcResult<IntelligenceDocument>>('intel:update', docId, updates)
      const updatedDoc = unwrapIpc<IntelligenceDocument>(res)
      if (updatedDoc) {
        setDocuments(prev => prev.map(d => d.id === updatedDoc.id ? updatedDoc : d))
        setSaveStatus('syncing')
      }
    } catch (e) {
      log.error('Failed to update doc', e)
      setSaveStatus('error')
    }
  }



  const handleInstructionFieldChange = (field: keyof typeof instructionFields, value: any) => {
    const newFields = { ...instructionFields, [field]: value };
    setInstructionFields(newFields);

    // Auto-serialize to content
    const newContent = serializeSoulMd(newFields);
    setEditorContent(newContent);

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    setSaveStatus('saving');
    saveTimerRef.current = setTimeout(() => {
      if (selectedDocId) handleUpdate(selectedDocId, { content: newContent });
    }, 800);
  };

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value
    setEditorContent(val)
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    setSaveStatus('saving')
    saveTimerRef.current = setTimeout(() => {
      if (selectedDocId) handleUpdate(selectedDocId, { content: val })
    }, 800)
  }

  const handleTitleBlur = () => {
    if (selectedDocId && editorTitle !== selectedDoc?.title) {
      handleUpdate(selectedDocId, { title: editorTitle })
    }
  }

  const handleDescBlur = () => {
    if (selectedDocId && editorDesc !== selectedDoc?.description) {
      handleUpdate(selectedDocId, { description: editorDesc })
    }
  }

  const handleCreateSubmit = async () => {
    if (!newDocTitle.trim()) return
    try {
      const payload = {
        title: newDocTitle,
        description: newDocDesc,
        type: newDocType,
        content: '',
        providers: []
      }
      const res = await invoke<IpcResult<IntelligenceDocument>>('intel:create', payload)
      const newDoc = unwrapIpc<IntelligenceDocument>(res)
      if (newDoc) {
        setDocuments(prev => [...prev, newDoc])
        setSelectedDocId(newDoc.id)
        setIsCreating(false)
        setNewDocTitle('')
        setNewDocDesc('')
      }
    } catch (e) {
      log.error('Failed to create doc', e)
    }
  }

  const handleDelete = async (docId: string) => {
    if (!window.confirm("Delete this document? This will NOT remove already-synced files.")) return
    try {
      await invoke('intel:delete', docId)
      setDocuments(prev => prev.filter(d => d.id !== docId))
      if (selectedDocId === docId) setSelectedDocId(null)
    } catch (e) {
      log.error('Failed to delete doc', e)
    }
  }

  const toggleProvider = (doc: IntelligenceDocument, provider: ProviderKey) => {
    const isEnabled = doc.providers.some((p: ProviderTarget) => p.provider === provider)
    let newProviders = [...doc.providers]
    if (isEnabled) {
      newProviders = newProviders.filter((p: ProviderTarget) => p.provider !== provider)
    } else {
      newProviders.push({ provider })
    }
    handleUpdate(doc.id, { providers: newProviders })
  }

  const renderStatusDots = (doc: IntelligenceDocument) => {
    if (!doc.providers || doc.providers.length === 0) return null
    return (
      <div className="flex items-center gap-0.5 ml-auto">
        {doc.providers.map((p: ProviderTarget) => {
          const status = doc.syncStatus?.[p.provider]
          let colorClass = 'bg-zinc-600'
          if (status === 'synced') colorClass = 'bg-green-500'
          else if (status === 'pending') colorClass = 'bg-amber-500'
          else if (status === 'error') colorClass = 'bg-red-500'
          
          return (
            <div key={p.provider} title={`${p.provider}: ${status || 'unsupported'}`} className={`w-1.5 h-1.5 rounded-full ${colorClass}`} />
          )
        })}
      </div>
    )
  }


  const [isSplitModalOpen, setIsSplitModalOpen] = useState(false)
  const [splitProposals, setSplitProposals] = useState<Array<{ title: string, content: string }>>([])
  const [splitSuccess, setSplitSuccess] = useState(false)

  // Use intel:audit-length to check length
  const [isInstructionLong, setIsInstructionLong] = useState(false)
  useEffect(() => {
    if (selectedDoc?.type === 'instruction' && selectedDocId) {
      invoke<IpcResult<{ overThreshold: boolean }>>('intel:audit-length', { id: selectedDocId })
        .then(res => {
          const unwrapped = unwrapIpc<{ overThreshold: boolean }>(res)
          if (unwrapped) {
            setIsInstructionLong(unwrapped.overThreshold)
          }
        })
        .catch(err => log.error('Failed to audit length', err))
    } else {
      setIsInstructionLong(false)
    }
  }, [selectedDocId, editorContent, invoke, selectedDoc])

  const handleOpenSplitModal = () => {
    if (!selectedDoc) return
    
    const lines = editorContent.split('\n')
    const proposals: Array<{ title: string, content: string }> = []
    
    let currentTitle = 'Preamble'
    let currentContent: string[] = []
    let isPreamble = true
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] || ''
      if (line.startsWith('## ')) {
        if (currentContent.length > 0) {
          proposals.push({
            title: currentTitle,
            content: isPreamble ? currentContent.slice(0, 50).join('\n') : currentContent.join('\n')
          })
          isPreamble = false
        } else if (isPreamble) {
          proposals.push({
            title: currentTitle,
            content: ''
          })
          isPreamble = false
        }
        currentTitle = line.substring(3).trim()
        currentContent = [line]
      } else {
        currentContent.push(line)
      }
    }
    
    if (currentContent.length > 0) {
      proposals.push({
        title: currentTitle,
        content: isPreamble ? currentContent.slice(0, 50).join('\n') : currentContent.join('\n')
      })
    }
    
    setSplitProposals(proposals)
    setIsSplitModalOpen(true)
    setSplitSuccess(false)
  }

  const handleCreateAllSplit = async () => {
    if (!selectedDoc) return
    
    try {
      const newDocs: IntelligenceDocument[] = []
      
      for (let i = 0; i < splitProposals.length; i++) {
        const proposal = splitProposals[i]
        if (!proposal) continue;
        const isPreamble = i === 0
        
        const payload = {
          projectId: 'current',
          type: isPreamble ? 'instruction' : 'rule',
          title: proposal.title,
          content: proposal.content,
          providers: selectedDoc.providers,
          pathScope: []
        }
        
        const res = await invoke<IpcResult<IntelligenceDocument>>('intel:create', payload)
        const unwrapped = unwrapIpc<IntelligenceDocument>(res)
        if (unwrapped) {
          newDocs.push(unwrapped)
        }
      }
      
      setDocuments(prev => [...prev, ...newDocs])
      setSplitSuccess(true)
      setIsSplitModalOpen(false)
      
    } catch (err) {
      log.error('Failed to create split docs', err)
    }
  }

  // Group docs
  const groupedDocs = TYPE_ORDER.reduce((acc, type) => {
    acc[type] = documents.filter((d: any) => d.type === type)
    return acc
  }, {} as Record<IntelligenceDocType, IntelligenceDocument[]>)



  return (
    <div data-testid="panel-intelligence" className="flex h-full w-full bg-[#050505] text-zinc-300 font-sans relative z-10">
      {/* Left Rail */}
      <div data-testid="panel-intelligence-sidebar" className="w-64 flex flex-col border-r border-white/5 bg-zinc-950 shrink-0">
        <div className="p-3 border-b border-white/5 flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-400">Intelligence</h2>
          {onClose && (
            <button
              onClick={onClose}
              className="flex items-center gap-1 text-[10px] text-zinc-300 hover:text-white uppercase tracking-wider font-bold transition-colors"
              title="Close"
            >
              <X size={14} /> Close
            </button>
          )}
        </div>
        
        <div className="p-2 border-b border-white/5">
          {isCreating ? (
            <div className="bg-zinc-900 border border-copernicus-phosphor/30 rounded p-2 space-y-2">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[9px] font-bold uppercase text-zinc-500 tracking-widest">New Document</span>
              </div>
              <select
                className="w-full bg-black/50 border border-zinc-800 rounded p-1 text-[10px] text-zinc-300 outline-none focus:border-copernicus-phosphor"
                value={newDocType}
                onChange={e => setNewDocType(e.target.value as IntelligenceDocType)}
              >
                {TYPE_ORDER.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <input
                autoFocus
                placeholder="Title..."
                className="w-full bg-black/50 border border-zinc-800 rounded p-1 text-[10px] text-zinc-300 outline-none focus:border-copernicus-phosphor"
                value={newDocTitle}
                onChange={e => setNewDocTitle(e.target.value)}
              />
              <input
                placeholder="Description..."
                className="w-full bg-black/50 border border-zinc-800 rounded p-1 text-[10px] text-zinc-300 outline-none focus:border-copernicus-phosphor"
                value={newDocDesc}
                onChange={e => setNewDocDesc(e.target.value)}
              />
              <div className="flex gap-2 justify-end mt-2">
                <button onClick={() => setIsCreating(false)} className="text-[9px] text-zinc-500 hover:text-zinc-300 font-bold uppercase tracking-wider">Cancel</button>
                <button onClick={handleCreateSubmit} className="text-[9px] bg-copernicus-phosphor text-[#050505] px-2 py-0.5 rounded-sm font-bold uppercase tracking-wider">Create</button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setIsCreating(true)}
              className="w-full flex items-center justify-center gap-1.5 py-1.5 border border-dashed border-zinc-800 hover:border-copernicus-phosphor/50 text-zinc-500 hover:text-copernicus-phosphor rounded text-[10px] font-bold uppercase tracking-wider transition-colors"
            >
              <Plus size={12} /> New Document
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-800 p-2 space-y-4 pb-12">
          <div>
            {TYPE_ORDER.map(type => {
              const docs = groupedDocs[type]
              if (!docs.length) return null
              return (
                <div key={type} className="mb-4 mt-2">
                  <div className="px-3 py-1.5 flex items-center gap-1.5 sticky top-0 bg-zinc-950/90 backdrop-blur z-10 border-b border-white/5">
                    <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-500">{type}s</span>
                  </div>
                  <div>
                    {docs.map(doc => (
                      <div
                        key={doc.id}
                        onClick={() => {
                          setSelectedDocId(doc.id)
                          setSelectedNotebookId(null)
                        }}
                        className={`group flex items-center gap-2 px-3 py-2 cursor-pointer border-l-2 transition-colors ${selectedDocId === doc.id ? 'border-copernicus-phosphor bg-zinc-900' : 'border-transparent hover:bg-zinc-900/50'}`}
                      >
                        <div className={`p-1 rounded ${TYPE_COLORS[doc.type].bg} ${TYPE_COLORS[doc.type].text}`}>
                          {TYPE_COLORS[doc.type].icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[11px] font-medium text-zinc-200 truncate">{doc.title}</div>
                          <div className="text-[9px] text-zinc-500 truncate">{doc.description}</div>
                        </div>
                        {renderStatusDots(doc)}
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDelete(doc.id); }}
                          className="opacity-0 group-hover:opacity-100 p-1 text-zinc-600 hover:text-red-400 transition-opacity ml-1"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>

          <NotebookLMSection
            selectedNotebookId={selectedNotebookId}
            onSelectNotebook={(id) => {
              setSelectedDocId(null)
              setSelectedNotebookId(id)
            }}
          />
        </div>
      </div>

      {/* Right Pane - Editor */}
      <div data-testid="panel-intelligence-editor" className="flex-1 flex flex-col bg-[#050505] overflow-hidden">
        {documents.length === 0 && suggestions.length > 0 && !hasDismissedSuggestions && (
          <IntelligenceSuggestBanner
            suggestions={suggestions}
            onDismiss={() => setHasDismissedSuggestions(true)}
            onComplete={(newDocs) => {
              setDocuments(prev => [...prev, ...newDocs])
              setHasDismissedSuggestions(true)
            }}
          />
        )}
        {selectedNotebookId ? (
          <div className="flex-1 relative flex flex-col">
            {showNlmBanner && (
              <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2 text-amber-400 text-xs">
                  <AlertCircle size={14} />
                  <span>Sign in to your Google account to connect NotebookLM. This session is stored locally and will not be shared.</span>
                </div>
              </div>
            )}
            <webview
              src={`https://notebooklm.google.com/notebook/${selectedNotebookId}`}
              partition="persist:notebooklm"
              className="flex-1"
              allowpopups="true"
              style={{ display: 'flex', width: '100%', height: '100%' }}
              ref={(wv: any) => {
                if (wv && !wv.dataset.eventsAttached) {
                  wv.dataset.eventsAttached = 'true'
                  const handleNav = (e: any) => {
                    if (e.url && e.url.startsWith('https://notebooklm.google.com/notebook/')) {
                      setShowNlmBanner(false)
                    }
                  }
                  wv.addEventListener('did-navigate', handleNav)
                  wv.addEventListener('did-navigate-in-page', handleNav)
                }
              }}
            />
          </div>
        ) : selectedDoc ? (
          <>
            <div className="p-4 border-b border-white/5 space-y-3 shrink-0">
              <div className="flex items-center gap-3">
                <div className={`px-2 py-0.5 rounded-[2px] text-[9px] font-bold uppercase tracking-widest border border-white/10 ${TYPE_COLORS[selectedDoc.type].bg} ${TYPE_COLORS[selectedDoc.type].text}`}>
                  {selectedDoc.type}
                </div>
                <input
                  className="flex-1 bg-transparent text-lg font-bold text-zinc-100 outline-none placeholder:text-zinc-700"
                  value={editorTitle}
                  onChange={e => setEditorTitle(e.target.value)}
                  onBlur={handleTitleBlur}
                  placeholder="Document Title"
                />
              </div>
              <input
                className="w-full bg-transparent text-xs text-zinc-400 outline-none placeholder:text-zinc-700"
                value={editorDesc}
                onChange={e => setEditorDesc(e.target.value)}
                onBlur={handleDescBlur}
                placeholder="Description"
              />
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-white/5">
                <span className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest mr-2">Providers:</span>
                {CANONICAL_PROVIDERS.map(p => {
                  const isEnabled = selectedDoc.providers.some((prov: ProviderTarget) => prov.provider === p)
                  const meta = PROVIDER_METADATA[p] || { displayName: p }
                  return (
                    <button
                      key={p}
                      onClick={() => toggleProvider(selectedDoc, p)}
                      title={meta.displayName}
                      className={`px-2 py-1 rounded text-[9px] font-bold uppercase tracking-wider transition-colors border ${isEnabled ? 'bg-copernicus-phosphor text-[#050505] border-copernicus-phosphor rounded-none' : 'bg-zinc-900 text-zinc-600 border-zinc-800 hover:border-zinc-600'}`}
                    >
                      {p}
                    </button>
                  )
                })}
              </div>
            </div>


            {isInstructionLong && !splitSuccess && (
              <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2 text-amber-400 text-xs">
                  <AlertCircle size={14} />
                  <span>This instruction document exceeds 200 lines. Consider splitting into rule documents for better scoping.</span>
                </div>
                <div>
                  <button onClick={handleOpenSplitModal} className="flex items-center gap-1 px-2 py-1 bg-amber-500/20 text-amber-500 hover:bg-amber-500/30 transition-colors rounded text-[10px] font-bold uppercase tracking-wider">
                    <SplitSquareHorizontal size={12} />
                    Split into rules
                  </button>
                </div>
              </div>
            )}

            {splitSuccess && (
              <div className="bg-green-500/10 border-b border-green-500/20 px-4 py-2 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2 text-green-400 text-xs">
                  <CheckCircle2 size={14} />
                  <span>Created {splitProposals.length - 1} rule documents. Review and delete the original when ready.</span>
                </div>
              </div>
            )}

            {isSplitModalOpen && (
              <div className="shrink-0 border-b border-white/5 bg-zinc-900/50 flex flex-col max-h-[50vh]">
                <div className="px-4 py-2 border-b border-white/5 flex items-center justify-between bg-zinc-900 sticky top-0 z-10">
                  <span className="text-xs font-bold uppercase tracking-widest text-zinc-300">Proposed Split</span>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setIsSplitModalOpen(false)} className="text-[10px] text-zinc-500 hover:text-zinc-300 font-bold uppercase tracking-wider">Cancel</button>
                    <button onClick={handleCreateAllSplit} className="text-[10px] bg-copernicus-phosphor text-[#050505] px-2 py-0.5 rounded-sm font-bold uppercase tracking-wider">Create all</button>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-zinc-800">
                  {splitProposals.map((proposal, idx) => (
                    <div key={idx} className="bg-black/50 border border-white/5 rounded flex flex-col">
                      <div className="px-3 py-2 border-b border-white/5 flex items-center gap-2 bg-zinc-900/50">
                        <div className={`px-2 py-0.5 rounded-[2px] text-[9px] font-bold uppercase tracking-widest border border-white/10 ${idx === 0 ? TYPE_COLORS['instruction'].bg + ' ' + TYPE_COLORS['instruction'].text : TYPE_COLORS['rule'].bg + ' ' + TYPE_COLORS['rule'].text}`}>
                          {idx === 0 ? 'instruction' : 'rule'}
                        </div>
                        <input
                          className="flex-1 bg-transparent text-xs font-bold text-zinc-300 outline-none"
                          value={proposal.title}
                          onChange={e => {
                            const newProposals = [...splitProposals]
                            if (newProposals[idx]) newProposals[idx]!.title = e.target.value
                            setSplitProposals(newProposals)
                          }}
                        />
                      </div>
                      <textarea
                        className="w-full h-32 bg-transparent text-zinc-400 font-mono text-[10px] p-3 outline-none resize-y scrollbar-thin scrollbar-thumb-zinc-800"
                        value={proposal.content}
                        onChange={e => {
                          const newProposals = [...splitProposals]
                          if (newProposals[idx]) newProposals[idx]!.content = e.target.value
                          setSplitProposals(newProposals)
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selectedDoc.type === 'agent' && (
              <div className="shrink-0 p-4 border-b border-white/5 bg-zinc-900/50 flex flex-col gap-4">
                <div className="flex gap-4">
                  <div className="flex-1 flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Model</label>
                    <select
                      className="bg-black/40 border border-white/10 text-xs text-zinc-300 rounded px-2 py-1 outline-none focus:border-cyan-500/50 transition-colors"
                      value={selectedDoc.agentModel || ''}
                      onChange={(e) => {
                        const val = e.target.value || null
                        setSaveStatus('saving')
                        setDocuments(prev => prev.map(d => d.id === selectedDoc.id ? { ...d, agentModel: val } : d))
                        if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
                        saveTimerRef.current = setTimeout(() => {
                          handleUpdate(selectedDoc.id, { agentModel: val })
                        }, 800)
                      }}
                    >
                      <option value="">(None)</option>
                      {CANONICAL_PROVIDERS.map(p => (
                        <option key={p} value={p}>{PROVIDER_METADATA[p]?.displayName || p}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex-1 flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Max Tokens</label>
                    <input
                      type="number"
                      placeholder="e.g. 4096"
                      className="bg-black/40 border border-white/10 text-xs text-zinc-300 rounded px-2 py-1 outline-none focus:border-cyan-500/50 transition-colors"
                      value={selectedDoc.agentMaxTokens ?? ''}
                      onChange={(e) => {
                        const val = e.target.value ? parseInt(e.target.value, 10) : null
                        setSaveStatus('saving')
                        setDocuments(prev => prev.map(d => d.id === selectedDoc.id ? { ...d, agentMaxTokens: val } : d))
                        if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
                        saveTimerRef.current = setTimeout(() => {
                          handleUpdate(selectedDoc.id, { agentMaxTokens: val })
                        }, 800)
                      }}
                    />
                  </div>
                  <div className="flex-1 flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Temperature</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="1"
                      placeholder="0.0 - 1.0"
                      className="bg-black/40 border border-white/10 text-xs text-zinc-300 rounded px-2 py-1 outline-none focus:border-cyan-500/50 transition-colors"
                      value={selectedDoc.agentTemperature ?? ''}
                      onChange={(e) => {
                        const val = e.target.value ? parseFloat(e.target.value) : null
                        setSaveStatus('saving')
                        setDocuments(prev => prev.map(d => d.id === selectedDoc.id ? { ...d, agentTemperature: val } : d))
                        if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
                        saveTimerRef.current = setTimeout(() => {
                          handleUpdate(selectedDoc.id, { agentTemperature: val })
                        }, 800)
                      }}
                    />
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="flex-1 flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Skills (comma-separated)</label>
                    <input
                      type="text"
                      placeholder="e.g. typescript, python, react"
                      className="bg-black/40 border border-white/10 text-xs text-zinc-300 rounded px-2 py-1 outline-none focus:border-cyan-500/50 transition-colors"
                      value={selectedDoc.agentSkills?.join(', ') || ''}
                      onChange={(e) => {
                        const val = e.target.value ? e.target.value.split(',').map(s => s.trim()).filter(Boolean) : null
                        setSaveStatus('saving')
                        setDocuments(prev => prev.map(d => d.id === selectedDoc.id ? { ...d, agentSkills: val } : d))
                        if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
                        saveTimerRef.current = setTimeout(() => {
                          handleUpdate(selectedDoc.id, { agentSkills: val })
                        }, 800)
                      }}
                    />
                  </div>
                  <div className="flex-1 flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Tools (comma-separated)</label>
                    <input
                      type="text"
                      placeholder="e.g. browser, terminal, fs"
                      className="bg-black/40 border border-white/10 text-xs text-zinc-300 rounded px-2 py-1 outline-none focus:border-cyan-500/50 transition-colors"
                      value={selectedDoc.agentTools?.join(', ') || ''}
                      onChange={(e) => {
                        const val = e.target.value ? e.target.value.split(',').map(s => s.trim()).filter(Boolean) : null
                        setSaveStatus('saving')
                        setDocuments(prev => prev.map(d => d.id === selectedDoc.id ? { ...d, agentTools: val } : d))
                        if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
                        saveTimerRef.current = setTimeout(() => {
                          handleUpdate(selectedDoc.id, { agentTools: val })
                        }, 800)
                      }}
                    />
                  </div>
                </div>
              </div>
            )}


            {selectedDoc.type === 'instruction' && (
              <div className="shrink-0 p-4 border-b border-white/5 bg-zinc-900/50 flex flex-col gap-4">
                {(!instructionFields.isParsed && selectedDoc.content) ? (
                  <div className="text-amber-500 text-xs">
                    This instruction document does not follow the SOUL.md format. You can edit it directly in the textarea below.
                  </div>
                ) : (
                  <>
                    <div className="flex gap-4">
                      <div className="flex-1 flex flex-col gap-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Agent Name</label>
                        <input
                          type="text"
                          className="bg-black/40 border border-white/10 text-xs text-zinc-300 rounded px-2 py-1 outline-none focus:border-cyan-500/50 transition-colors"
                          value={instructionFields.agentName}
                          onChange={(e) => handleInstructionFieldChange('agentName', e.target.value)}
                        />
                      </div>
                      <div className="flex-1 flex flex-col gap-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Description</label>
                        <input
                          type="text"
                          className="bg-black/40 border border-white/10 text-xs text-zinc-300 rounded px-2 py-1 outline-none focus:border-cyan-500/50 transition-colors"
                          value={instructionFields.description}
                          onChange={(e) => handleInstructionFieldChange('description', e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Communication Style</label>
                      <textarea
                        className="bg-black/40 border border-white/10 text-xs text-zinc-300 rounded px-2 py-1 outline-none focus:border-cyan-500/50 transition-colors resize-y h-20"
                        value={instructionFields.communicationStyle}
                        onChange={(e) => handleInstructionFieldChange('communicationStyle', e.target.value)}
                      />
                    </div>
                    <div className="flex gap-4">
                      <div className="flex-1 flex flex-col gap-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Core Values (one per line)</label>
                        <textarea
                          className="bg-black/40 border border-white/10 text-xs text-zinc-300 rounded px-2 py-1 outline-none focus:border-cyan-500/50 transition-colors resize-y h-24"
                          value={instructionFields.coreValues.join('\n')}
                          onChange={(e) => handleInstructionFieldChange('coreValues', e.target.value.split('\n'))}
                        />
                      </div>
                      <div className="flex-1 flex flex-col gap-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Expertise Areas (comma-separated)</label>
                        <textarea
                          className="bg-black/40 border border-white/10 text-xs text-zinc-300 rounded px-2 py-1 outline-none focus:border-cyan-500/50 transition-colors resize-y h-24"
                          value={instructionFields.expertiseAreas.join(', ')}
                          onChange={(e) => {
                            const val = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                            handleInstructionFieldChange('expertiseAreas', val);
                          }}
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}


            {(!selectedDoc || (selectedDoc.type === 'instruction' && instructionFields.isParsed)) ? null : (
              <div className="flex-1 p-4 relative flex flex-col gap-2">
                {selectedDoc.type === 'agent' && (
                  <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Description / System Prompt</label>
                )}
                <textarea
                  className="w-full h-full bg-transparent text-zinc-300 font-mono text-xs outline-none resize-none scrollbar-thin scrollbar-thumb-zinc-800"
                  value={editorContent}
                  onChange={handleContentChange}
                  placeholder="Write your markdown content here..."
                  spellCheck={false}
                />
              </div>
            )}


            {selectedDoc.type === 'rule' && (
              <div className="shrink-0 border-t border-white/5 bg-zinc-900/50">
                <PathScopeEditor
                  pathScope={selectedDoc.pathScope || []}
                  onChange={(newScope) => {
                    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
                    setSaveStatus('saving')
                    // update local list immediately so it reflects UI
                    setDocuments(prev => prev.map(d => d.id === selectedDoc.id ? { ...d, pathScope: newScope } : d))
                    saveTimerRef.current = setTimeout(() => {
                      handleUpdate(selectedDoc.id, { pathScope: newScope })
                    }, 800)
                  }}
                />
                <div className="border-t border-white/5">
                  <button
                    onClick={() => setIsPreviewOpen(!isPreviewOpen)}
                    className="flex items-center gap-1.5 px-4 py-2 w-full text-left hover:bg-zinc-800/50 transition-colors"
                  >
                    {isPreviewOpen ? <ChevronDown size={14} className="text-zinc-500" /> : <ChevronRight size={14} className="text-zinc-500" />}
                    <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Frontmatter preview</span>
                  </button>
                  {isPreviewOpen && (
                    <div className="px-4 pb-4 space-y-3">
                      {selectedDoc.providers.filter(p => p.provider === 'claude' || p.provider === 'cursor').length > 0 ? (
                        <>
                          {selectedDoc.providers.some(p => p.provider === 'claude') && (
                            <div className="space-y-1">
                              <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-500">Claude</span>
                              <pre className="p-2 bg-black/50 border border-white/5 rounded text-[10px] text-zinc-300 font-mono overflow-x-auto">
{`--- (paths:)
paths:
${(selectedDoc.pathScope || []).length > 0 ? (selectedDoc.pathScope || []).map(p => `  - ${p}`).join('\n') : ''}
---
${editorContent}`}
                              </pre>
                            </div>
                          )}
                          {selectedDoc.providers.some(p => p.provider === 'cursor') && (
                            <div className="space-y-1">
                              <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-500">Cursor</span>
                              <pre className="p-2 bg-black/50 border border-white/5 rounded text-[10px] text-zinc-300 font-mono overflow-x-auto">
{`---
globs:
${(selectedDoc.pathScope || []).length > 0 ? (selectedDoc.pathScope || []).map(p => `  - ${p}`).join('\n') : ''}
---
${editorContent}`}
                              </pre>
                            </div>
                          )}
                        </>
                      ) : null}
                      {selectedDoc.providers.some(p => p.provider !== 'claude' && p.provider !== 'cursor') && (
                        <div className="text-[10px] text-zinc-500">
                          Path scoping not supported — content will be appended to the provider's instruction file.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Sync Status Bar */}
            <div className="h-8 border-t border-white/5 bg-zinc-950 flex items-center justify-between px-4 shrink-0">
              <div className="flex items-center gap-4">
                {selectedDoc.providers.length === 0 ? (
                  <span className="text-[10px] text-zinc-600">No providers enabled</span>
                ) : (
                  selectedDoc.providers.map((p: ProviderTarget) => {
                    const status = selectedDoc.syncStatus?.[p.provider]
                    let dotColor = 'bg-zinc-600'
                    if (status === 'synced') dotColor = 'bg-green-500'
                    else if (status === 'pending') dotColor = 'bg-amber-500'
                    else if (status === 'error') dotColor = 'bg-red-500'

                    return (
                      <div key={p.provider} className="flex items-center gap-1.5">
                        <div className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
                        <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-400">{p.provider}</span>
                      </div>
                    )
                  })
                )}
              </div>
              <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest">
                {saveStatus === 'saving' && <><Clock size={10} className="text-amber-400" /><span className="text-amber-400">Saving...</span></>}
                {saveStatus === 'syncing' && <><Save size={10} className="text-copernicus-phosphor animate-pulse" /><span className="text-copernicus-phosphor">Syncing...</span></>}
                {saveStatus === 'saved' && <><CheckCircle2 size={10} className="text-zinc-500" /><span className="text-zinc-500">Saved</span></>}
                {saveStatus === 'error' && <><AlertCircle size={10} className="text-red-500" /><span className="text-red-500">Error</span></>}
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center flex-col gap-4 text-zinc-600">
            <Brain size={48} className="opacity-20" />
            <p className="text-xs uppercase tracking-widest font-bold">Select a document to edit</p>
          </div>
        )}
      </div>
    </div>
  )
}

function Brain(props: React.ComponentProps<typeof Bot>) {
  return <Bot {...props} />
}

interface PathScopeEditorProps {
  pathScope: string[]
  onChange: (newScope: string[]) => void
}

function PathScopeEditor({ pathScope, onChange }: PathScopeEditorProps) {
  const [inputValue, setInputValue] = useState('')

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      const val = inputValue.trim().replace(/^,|,$/g, '')
      if (val && !pathScope.includes(val)) {
        onChange([...pathScope, val])
      }
      setInputValue('')
    } else if (e.key === 'Backspace' && !inputValue && pathScope.length > 0) {
      const newScope = [...pathScope]
      newScope.pop()
      onChange(newScope)
    }
  }

  const removeTag = (tag: string) => {
    onChange(pathScope.filter(t => t !== tag))
  }

  return (
    <div className="px-4 py-3">
      <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-2">Path scope (glob patterns)</div>
      <div className="flex flex-wrap items-center gap-1.5 p-1.5 bg-black/50 border border-zinc-800 rounded min-h-[34px] focus-within:border-copernicus-phosphor transition-colors">
        {pathScope.map(tag => (
          <div key={tag} className="flex items-center gap-1 bg-zinc-800 text-zinc-300 text-[10px] font-mono px-2 py-0.5 rounded-sm">
            <span>{tag}</span>
            <button onClick={() => removeTag(tag)} className="text-zinc-500 hover:text-white transition-colors">
              <X size={10} />
            </button>
          </div>
        ))}
        <input
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={pathScope.length === 0 ? "e.g. src/**/*.ts (press Enter to add)" : ""}
          className="flex-1 min-w-[120px] bg-transparent text-xs font-mono text-zinc-300 outline-none p-0.5 placeholder:font-sans placeholder:text-zinc-600"
        />
      </div>
    </div>
  )
}
