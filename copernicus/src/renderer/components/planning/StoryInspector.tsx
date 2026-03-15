import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Save, Trash2, Archive } from 'lucide-react'
import { useIpcError } from '../../hooks/useIpcError'
import { useLayoutStore } from '../../store/layout'
import { useToastStore } from '../../store/toastStore'
import log from '../../utils/logger'
import { unwrapIpc } from '../../types/ipc'
import { ChatPanel } from '../chat/ChatPanel'
import { stripStoryPrefix } from '../../utils/storyTitle'

interface Story {
  id: string
  title: string
  status: string
  path: string
  priority: 'P0' | 'P1' | 'P2' | 'P3' | 'UNKNOWN'
  type: string
  epic: string | null
  model: string | null
  workflowId: string | null
  date: string
  blocked: boolean
}

interface StoryInspectorProps {
  storyId: string
  stories: Story[]
}

const PRIORITY_COLORS: Record<string, string> = {
  P0: 'bg-red-500/20 text-red-400 border-red-500/30',
  P1: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  P2: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  P3: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30',
  UNKNOWN: 'bg-zinc-800 text-zinc-600 border-zinc-700',
}

export function StoryInspector({ storyId, stories }: StoryInspectorProps) {
  const invoke = useIpcError()
  const { setDrawerStory, spotlightPane, setSpotlight } = useLayoutStore()
  const addToast = useToastStore(s => s.addToast)
  const isSpotlit = spotlightPane === 'inspector'

  const story = stories.find(s => s.id === storyId)
  const epics = stories.filter(s => s.type === 'Epic')

  // Core field states
  const [content, setContent] = useState('')
  const [localPriority, setLocalPriority] = useState<string>(story?.priority ?? 'UNKNOWN')
  const [localType, setLocalType] = useState<string>(story?.type ?? 'Feature')
  const [localModel, setLocalModel] = useState<string>(story?.model ?? '(unassigned)')
  const [localWorkflowId, setLocalWorkflowId] = useState<string>(story?.workflowId ?? '— none —')

  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [showSavedIndicator, setShowSavedIndicator] = useState(false)
  
  const [modelOptions, setModelOptions] = useState<string[]>(['(unassigned)', 'gemini', 'jules', 'human'])
  const [workflowTemplates, setWorkflowTemplates] = useState<{ id: string, name: string }[]>([])
  const [workflowStatus, setWorkflowStatus] = useState<string | null>(null)
  const [workflowStartTime, setWorkflowStartTime] = useState<number | null>(null)
  const [elapsedTime, setElapsedTime] = useState<string | null>(null)
  
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const drawerRef = useRef<HTMLDivElement>(null)
  const closeBtnRef = useRef<HTMLButtonElement>(null)

  // Sync local state when story or storyId changes
  useEffect(() => {
    if (story) {
      setLocalPriority(story.priority)
      setLocalType(story.type)
      setLocalModel(story.model ?? '(unassigned)')
      setLocalWorkflowId(story.workflowId ?? '— none —')
    }
  }, [storyId, story])

  useEffect(() => {
    invoke<any>('models:list').then(result => {
      const models = unwrapIpc<Array<{ id: string }>>(result)
      if (Array.isArray(models)) {
        setModelOptions(['(unassigned)', ...models.map(m => m.id), 'gemini', 'jules', 'human'])
      }
    }).catch(() => {})

    invoke<any>('workflow:list-templates').then(result => {
      const data = unwrapIpc<any[]>(result)
      if (Array.isArray(data)) {
        setWorkflowTemplates(data)
      }
    }).catch(() => {})
  }, [invoke])

  useEffect(() => {
    invoke<any>('stories:get-content', storyId)
      .then((r: any) => setContent(unwrapIpc<string>(r) ?? ''))
      .catch(log.error)
  }, [storyId, invoke])

  useEffect(() => {
    invoke<any>('workflow:status').then(result => {
      if (result?.ok && result.data?.context?.storyId === storyId) {
        setWorkflowStatus(result.data.state)
        if (result.data.state === 'RUNNING' && !workflowStartTime) {
          setWorkflowStartTime(Date.now())
        }
      }
    }).catch(() => {})

    const removeListener = window.ipcRenderer.on('workflow:status-update', (_event, payload: any) => {
      invoke<any>('workflow:status').then(result => {
        if (result?.ok) {
          if (result.data?.context?.storyId === storyId) {
            setWorkflowStatus(result.data.state)
            if (result.data.state === 'RUNNING' && !workflowStartTime) {
              setWorkflowStartTime(payload.timestamp || Date.now())
            }
          } else if (workflowStatus === 'RUNNING') {
            setWorkflowStatus(null)
          }
        }
      }).catch(() => {})
    })

    return () => removeListener()
  }, [invoke, storyId, workflowStatus, workflowStartTime])

  useEffect(() => {
    let timer: NodeJS.Timeout | null = null
    if (workflowStatus === 'RUNNING' && workflowStartTime) {
      timer = setInterval(() => {
        const diff = Date.now() - workflowStartTime
        const mins = Math.floor(diff / 60000)
        const secs = Math.floor((diff % 60000) / 1000)
        setElapsedTime(`${mins}:${secs.toString().padStart(2, '0')}`)
      }, 1000)
    } else if (workflowStatus === 'COMPLETE' && workflowStartTime) {
      const diff = Date.now() - workflowStartTime
      const mins = Math.floor(diff / 60000)
      const secs = Math.floor((diff % 60000) / 1000)
      setElapsedTime(`${mins}:${secs.toString().padStart(2, '0')}`)
    } else if (!workflowStatus) {
      setElapsedTime(null)
      setWorkflowStartTime(null)
    }
    return () => { if (timer) clearInterval(timer) }
  }, [workflowStatus, workflowStartTime])

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const updates: Promise<any>[] = [
        invoke('stories:set-field', { id: storyId, field: 'priority', value: localPriority }),
        invoke('stories:set-field', { id: storyId, field: 'type', value: localType }),
        invoke('stories:set-field', { id: storyId, field: 'model', value: localModel }),
        invoke('stories:set-field', { id: storyId, field: 'workflowId', value: localWorkflowId }),
      ]

      if (textareaRef.current) {
        updates.push(invoke('stories:update-content', { id: storyId, content: textareaRef.current.value }))
        setContent(textareaRef.current.value)
      }

      await Promise.all(updates)
      
      setShowSavedIndicator(true)
      setTimeout(() => setShowSavedIndicator(false), 2000)
      setIsEditing(false)
    } catch (e) {
      log.error('Failed to save', e)
      addToast('Failed to save changes', 'error')
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    if (story) {
      setLocalPriority(story.priority)
      setLocalType(story.type)
      setLocalModel(story.model ?? '(unassigned)')
      setLocalWorkflowId(story.workflowId ?? '— none —')
      if (textareaRef.current) {
        textareaRef.current.value = content
      }
      setIsEditing(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm(`Permanently delete ${storyId}? This will remove the markdown file and database record.`)) return
    try {
      await invoke('stories:delete', storyId)
      setDrawerStory(null)
      setSpotlight(null)
    } catch (e) {
      log.error('Failed to delete story', e)
    }
  }

  const handleArchive = async () => {
    try {
      await invoke('stories:archive', storyId)
      setDrawerStory(null)
      setSpotlight(null)
      addToast('Story archived', 'success')
    } catch (e) {
      log.error('Failed to archive story', e)
    }
  }

  // Focus first interactive element on drawer open
  useEffect(() => {
    if (closeBtnRef.current) {
      closeBtnRef.current.focus()
    }
  }, [storyId])

  // Focus trap + Escape key handler
  const handleDrawerKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      handleCancel()
      setDrawerStory(null)
      setSpotlight(null)
      // Return focus to the triggering card if available
      const activeCard = document.querySelector<HTMLElement>(`[data-story-id="${storyId}"]`)
      activeCard?.focus()
      return
    }

    if (e.key !== 'Tab' || !drawerRef.current) return

    const focusable = drawerRef.current.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
    const focusableArr = Array.from(focusable).filter(el => !el.hasAttribute('disabled'))
    if (focusableArr.length === 0) return

    const first = focusableArr[0]
    const last = focusableArr[focusableArr.length - 1]

    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault()
        last?.focus()
      }
    } else {
      if (document.activeElement === last) {
        e.preventDefault()
        first?.focus()
      }
    }
  }, [setDrawerStory, setSpotlight, storyId, handleCancel])

  // Auto-activate edit mode when spotlit
  useEffect(() => {
    if (isSpotlit && storyId) setIsEditing(true)
  }, [isSpotlit, storyId])

  if (!story) {
    return (
      <div className="flex items-center justify-center h-full text-zinc-600 text-xs">
        Story not found: {storyId}
      </div>
    )
  }

  return (
    <motion.div
      ref={drawerRef}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      onKeyDown={handleDrawerKeyDown}
      className="flex-1 h-full bg-copernicus-bg overflow-hidden"
      style={{ display: 'grid', gridTemplateColumns: '220px 1fr 280px' }}
    >
      {/* ── Column 1: Inspector sidebar ─────────────────────────── */}
      <div className="flex flex-col border-r border-white/5 bg-black/10 min-h-0">
        <div className="p-4 space-y-3 overflow-y-auto flex-1">
          {/* Nav row */}
          <div className="flex items-center justify-between mb-1">
            <button
              ref={closeBtnRef}
              onClick={() => {
                setDrawerStory(null)
                setSpotlight(null)
                setTimeout(() => {
                  const activeCard = document.querySelector<HTMLElement>(`[data-story-id="${storyId}"]`)
                  activeCard?.focus()
                }, 0)
              }}
              aria-label="Close story drawer"
              className="flex items-center gap-1.5 text-[10px] text-zinc-500 hover:text-copernicus-phosphor transition-colors uppercase tracking-wider"
            >
              <ArrowLeft size={11} /> Board
            </button>
            <div className="flex items-center gap-1">
              <button
                onClick={handleArchive}
                className="p-1 text-zinc-700 hover:text-blue-400 transition-colors"
                title="Archive"
              >
                <Archive size={11} />
              </button>
              <button
                onClick={handleDelete}
                className="p-1 text-zinc-700 hover:text-red-400 transition-colors"
                title="Delete"
              >
                <Trash2 size={11} />
              </button>
            </div>
          </div>

          <div>
            <p className="text-[8px] text-zinc-600 uppercase tracking-widest text-left break-words w-full mb-0.5">Story Identifier</p>
            <p className="text-[10px] font-mono text-copernicus-phosphor font-bold">#{story.id.match(/\d+/)?.[0] ?? story.id}</p>
          </div>

          <div>
            <p className="text-[8px] text-zinc-600 uppercase tracking-widest text-left break-words w-full mb-1">Priority</p>
            <select
              value={localPriority}
              onChange={e => setLocalPriority(e.target.value)}
              className={`text-[10px] font-bold border rounded px-1.5 py-0.5 focus:outline-none bg-transparent w-full ${PRIORITY_COLORS[localPriority] ?? PRIORITY_COLORS.UNKNOWN}`}
            >
              <option value="P0">P0 — Critical</option>
              <option value="P1">P1 — High</option>
              <option value="P2">P2 — Normal</option>
              <option value="P3">P3 — Low</option>
            </select>
          </div>

          <div>
            <p className="text-[8px] text-zinc-600 uppercase tracking-widest text-left break-words w-full mb-1">Type</p>
            <select
              value={localType}
              onChange={e => setLocalType(e.target.value)}
              className="text-[10px] bg-black/40 border border-zinc-800 rounded px-1.5 py-0.5 text-zinc-300 focus:outline-none focus:border-copernicus-phosphor/50 w-full"
            >
              {['Feature', 'Bug Fix', 'Epic', 'Chore', 'Security', 'Infrastructure'].map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          <div>
            <p className="text-[8px] text-zinc-600 uppercase tracking-widest text-left break-words w-full mb-1">Assignee</p>
            <select
              value={localModel}
              onChange={e => setLocalModel(e.target.value)}
              className="text-[10px] bg-black/40 border border-zinc-800 rounded px-1.5 py-0.5 text-zinc-300 focus:outline-none focus:border-copernicus-phosphor/50 w-full"
            >
              {modelOptions.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          <div>
            <p className="text-[8px] text-zinc-600 uppercase tracking-widest text-left break-words w-full mb-1">Epic Context</p>
            {story.epic ? (
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] font-mono text-blue-400 font-bold text-left">#{story.epic.match(/\d+/)?.[0] ?? story.epic}</span>
                <span className="text-[10px] text-zinc-300 truncate text-left" title={epics.find(e => e.id === story.epic)?.title ?? story.epic}>
                  {epics.find(e => e.id === story.epic) ? stripStoryPrefix(epics.find(e => e.id === story.epic)!.title) : story.epic}
                </span>
              </div>
            ) : (
              <span className="text-[10px] text-zinc-500 italic text-left block">(No Epic)</span>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-0.5">
              <p className="text-[8px] text-zinc-600 uppercase tracking-widest text-left break-words w-full">Workflow</p>
              <button
                onClick={() => {
                  if (workflowStatus === 'RUNNING') {
                    invoke('workflow:reset').then(() => {
                      setWorkflowStatus(null)
                      setWorkflowStartTime(null)
                    }).catch(() => {})
                  } else {
                    invoke('workflow:run', { templateId: localWorkflowId, context: { storyId, storyTitle: story.title } }).catch(() => {})
                    setWorkflowStatus('RUNNING')
                    setWorkflowStartTime(Date.now())
                  }
                }}
                disabled={!localWorkflowId || localWorkflowId === '— none —'}
                className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-bold border transition-all ${
                  !localWorkflowId || localWorkflowId === '— none —'
                    ? 'opacity-40 cursor-not-allowed border-zinc-800 text-zinc-600'
                    : workflowStatus === 'RUNNING'
                      ? 'border-red-500/50 text-red-400 hover:bg-red-500/10'
                      : 'border-copernicus-phosphor/50 text-copernicus-phosphor hover:bg-copernicus-phosphor/10'
                }`}
              >
                {workflowStatus === 'RUNNING' ? <><span>⏹</span> Stop</> : <><span>▶</span> Run</>}
              </button>
            </div>
            <select
              value={localWorkflowId}
              onChange={e => setLocalWorkflowId(e.target.value)}
              className="w-full text-[10px] bg-black/40 border border-zinc-800 rounded px-1.5 py-0.5 text-zinc-300 focus:outline-none focus:border-copernicus-phosphor/50"
            >
              <option value="— none —">— none —</option>
              {workflowTemplates.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>

            {workflowStatus && workflowStatus !== 'IDLE' && (
              <div className={`mt-2 flex items-center justify-center gap-1.5 text-[9px] font-mono px-2 py-1 rounded border ${
                workflowStatus === 'RUNNING' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20 animate-pulse' : 
                workflowStatus === 'COMPLETE' ? 'bg-green-500/10 text-green-400 border-green-500/20' : 
                'bg-red-500/10 text-red-400 border-red-500/20'
              }`}>
                {workflowStatus === 'RUNNING' ? '● RUNNING' : workflowStatus === 'COMPLETE' ? '● DONE' : '● FAILED'}
                {elapsedTime && <span className="opacity-60 ml-1">[{elapsedTime}]</span>}
              </div>
            )}
          </div>

          <div className="pt-2 border-t border-white/5">
            <p className="text-[8px] text-zinc-600 uppercase tracking-widest text-left break-words w-full mb-0.5">Deployment Date</p>
            <p className="text-[10px] text-zinc-500 font-mono">{story.date || '—'}</p>
          </div>

          <div>
            <p className="text-[8px] text-zinc-600 uppercase tracking-widest text-left break-words w-full mb-0.5">System Status</p>
            <span className="text-[9px] font-bold text-zinc-400 border border-zinc-700 rounded px-2 py-0.5 inline-block uppercase tracking-tighter">
              {story.status}
            </span>
          </div>
        </div>

        {/* Footer actions */}
        <div className="p-4 border-t border-white/5 bg-black/20 flex flex-col gap-2 shrink-0">
          <div className="flex items-center justify-between">
            {/* AC2: Saved indicator */}
            <div className="h-4 flex items-center overflow-hidden w-16">
               <AnimatePresence>
                 {showSavedIndicator && (
                   <motion.span 
                     initial={{ opacity: 0, y: 5 }} 
                     animate={{ opacity: 1, y: 0 }} 
                     exit={{ opacity: 0 }} 
                     className="text-[9px] text-green-400 font-mono tracking-widest uppercase"
                   >
                     ● SAVED
                   </motion.span>
                 )}
               </AnimatePresence>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={handleCancel}
                className="text-[10px] font-bold px-3 py-1.5 rounded hover:bg-white/5 text-zinc-400 transition-colors uppercase tracking-widest"
              >
                Cancel
              </button>
              <button 
                onClick={handleSave}
                disabled={isSaving}
                className="text-[10px] font-bold px-3 py-1.5 rounded bg-copernicus-phosphor text-[#050505] hover:bg-copernicus-phosphor/90 transition-colors uppercase tracking-widest flex items-center gap-1.5 disabled:opacity-50"
              >
                <Save size={12} />
                {isSaving ? 'Saving' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Column 2: Body content ──────────────────────────────── */}
      <div className="overflow-y-auto pt-2 px-6 pb-6 bg-copernicus-bg/50 min-w-0">
        <h1
          data-testid="story-detail-title"
          className="text-base font-bold text-white mb-3 border-b border-copernicus-phosphor/20 pb-3"
        >
          {stripStoryPrefix(story.title)}
        </h1>
        {isEditing ? (
          <textarea
            ref={textareaRef}
            data-testid="story-detail-content"
            defaultValue={content}
            className="w-full h-full min-h-[500px] bg-black/40 border border-zinc-800 rounded p-4 text-xs font-mono text-zinc-300 focus:outline-none focus:border-copernicus-phosphor/50 resize-none leading-relaxed shadow-inner"
            spellCheck={false}
          />
        ) : (
          <pre className="text-xs font-mono text-zinc-400 whitespace-pre-wrap leading-relaxed">
            {content}
          </pre>
        )}
      </div>

      {/* ── Column 3: Chat ──────────────────────────────────────── */}
      <div className="border-l border-white/5 flex flex-col overflow-hidden min-w-0">
        <ChatPanel />
      </div>
    </motion.div>
  )
}
