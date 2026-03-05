import { useState, useEffect, useRef, useCallback } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, Edit2, Save, ExternalLink, Play, Trash2, Archive, X } from 'lucide-react'
import { useIpcError } from '../../hooks/useIpcError'
import { useLayoutStore } from '../../store/layout'
import log from '../../utils/logger'
import { unwrapIpc } from '../../types/ipc'

interface Story {
  id: string
  title: string
  status: string
  path: string
  priority: 'P0' | 'P1' | 'P2' | 'P3' | 'UNKNOWN'
  type: string
  epic: string | null
  model: string | null
  workflowId?: string | null
  date: string
  blocked: boolean
}

interface StoryDetailProps {
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

export function StoryDetail({ storyId, stories }: StoryDetailProps) {
  const invoke = useIpcError()
  const { setDrawerStory, spotlightPane, setSpotlight, addTerminal, setActiveTerminal, setTerminalOpen, workingDir } = useLayoutStore()
  const isSpotlit = spotlightPane === 'telemetry'

  const story = stories.find(s => s.id === storyId)
  const epics = Array.from(new Set(stories.map(s => s.epic).filter(Boolean) as string[])).sort()

  const [content, setContent] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isDispatchingGemini, setIsDispatchingGemini] = useState(false)
  const [geminiError, setGeminiError] = useState<string | null>(null)
  const [modelOptions, setModelOptions] = useState<string[]>(['(unassigned)', 'gemini', 'jules', 'human'])
  const [workflowTemplates, setWorkflowTemplates] = useState<{ id: string, name: string }[]>([])
  const [workflowStatus, setWorkflowStatus] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const drawerRef = useRef<HTMLDivElement>(null)
  const closeBtnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    invoke<any>('stories:get-content', storyId)
      .then((r: any) => setContent(unwrapIpc<string>(r) ?? ''))
      .catch(log.error)
  }, [storyId, invoke])

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
    invoke<any>('workflow:status').then(result => {
      if (result?.ok && result.data?.context?.storyId === storyId) {
        setWorkflowStatus(result.data.state)
      }
    }).catch(() => {})

    const removeListener = window.ipcRenderer.on('workflow:status-update', () => {
      invoke<any>('workflow:status').then(result => {
        if (result?.ok) {
          if (result.data?.context?.storyId === storyId) {
            setWorkflowStatus(result.data.state)
          } else if (workflowStatus === 'RUNNING') {
            setWorkflowStatus(null)
          }
        }
      }).catch(() => {})
    })

    return () => removeListener()
  }, [invoke, storyId, workflowStatus])

  const handleSetField = async (field: string, value: string) => {
    try {
      await invoke('stories:set-field', { id: storyId, field, value })
    } catch (e) {
      log.error('Failed to set field', e)
    }
  }

  const handleSave = async () => {
    if (!textareaRef.current) return
    setIsSaving(true)
    try {
      await invoke('stories:update-content', { id: storyId, content: textareaRef.current.value })
      setContent(textareaRef.current.value)
      setIsEditing(false)
    } catch (e) {
      log.error('Failed to save', e)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm(`Permanently delete ${storyId}? This will remove the markdown file and database record.`)) return
    try {
      await invoke('stories:delete', storyId)
      setDrawerStory(null)
    } catch (e) {
      log.error('Failed to delete story', e)
    }
  }

  const handleArchive = async () => {
    try {
      await invoke('stories:archive', storyId)
      setDrawerStory(null)
    } catch (e) {
      log.error('Failed to archive story', e)
    }
  }

  const handleOpenInEditor = () => {
    setSpotlight('telemetry')
  }

  const handleDispatchGemini = async () => {
    if (!story) return
    setIsDispatchingGemini(true)
    setGeminiError(null)
    try {
      const statusResult = await invoke<any>('gemini:status')
      const status = unwrapIpc<any>(statusResult)
      if (!status?.available?.ok) {
        setGeminiError(status?.available?.reason ?? 'Gemini not available')
        return
      }

      const spawnResult = await invoke<any>('gemini:spawn', { cwd: workingDir || undefined })
      const { sessionId } = unwrapIpc<any>(spawnResult)

      const prompt = [
        `You are implementing Story ${story.id} for the COPERNICUS IDE.`,
        `Read AGENTS.md in the repo root first, then implement the following story:`,
        ``,
        content,
        ``,
        `When done, run: cd copernicus && npx tsc --noEmit`,
        `Fix all TypeScript errors before finishing.`,
      ].join('\n')

      // Open terminal tab before sending (so output streams visibly)
      addTerminal(`gemini-${sessionId}`, 'Gemini')
      setActiveTerminal(`gemini-${sessionId}`)
      setTerminalOpen(true)

      // Fire-and-forget — output streams via gemini:output IPC push
      invoke('gemini:send-prompt', { sessionId, text: prompt }).catch(log.error)
    } catch (e) {
      log.error('[StoryDetail] Gemini dispatch failed', e)
      setGeminiError('Spawn failed — check Gemini credentials')
    } finally {
      setIsDispatchingGemini(false)
    }
  }

  // AC-3: Focus first interactive element on drawer open
  useEffect(() => {
    if (closeBtnRef.current) {
      closeBtnRef.current.focus()
    }
  }, [storyId])

  // AC-3: Focus trap + Escape key handler
  const handleDrawerKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      setDrawerStory(null)
      // Return focus to the triggering card if available
      const activeCard = document.querySelector<HTMLElement>('[aria-current="true"]') ??
        document.querySelector<HTMLElement>('[data-card-index="0"]')
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
        last.focus()
      }
    } else {
      if (document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
  }, [setDrawerStory])

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
      className={`flex h-full overflow-hidden bg-copernicus-bg ${isSpotlit ? 'flex-row' : 'flex-col'}`}
    >
      {/* Header bar */}
      <div className={`flex items-center justify-between px-3 h-8 border-b border-white/5 bg-black/20 flex-shrink-0 z-10 ${isSpotlit ? 'hidden' : ''}`}>
        <button
          ref={closeBtnRef}
          onClick={() => setDrawerStory(null)}
          aria-label="Close story drawer"
          className="flex items-center gap-1.5 text-[10px] text-zinc-500 hover:text-copernicus-phosphor transition-colors uppercase tracking-wider"
        >
          <ArrowLeft size={11} /> Board
        </button>
        <div className="flex items-center gap-2">
          {/* ▶ Gemini dispatch button */}
          <button
            onClick={handleDispatchGemini}
            disabled={isDispatchingGemini}
            className="flex items-center gap-1 px-2 py-0.5 rounded text-[9px] text-zinc-500 hover:text-copernicus-phosphor border border-zinc-800 hover:border-copernicus-phosphor/30 disabled:opacity-40 transition-all uppercase"
            title={geminiError ?? 'Dispatch story to Gemini CLI'}
          >
            <Play size={9} /> {isDispatchingGemini ? 'Spawning…' : geminiError ? 'Error' : 'Gemini'}
          </button>

          {!isEditing ? (
            <button
              onClick={() => setIsEditing(true)}
              className="flex items-center gap-1 px-2 py-0.5 rounded text-[9px] text-zinc-500 hover:text-copernicus-phosphor border border-zinc-800 hover:border-copernicus-phosphor/30 transition-all uppercase"
            >
              <Edit2 size={9} /> Edit
            </button>
          ) : (
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-1 px-2 py-0.5 rounded text-[9px] text-copernicus-phosphor border border-copernicus-phosphor/40 bg-copernicus-phosphor/10 hover:bg-copernicus-phosphor/20 transition-all uppercase"
            >
              <Save size={9} /> {isSaving ? 'Saving…' : 'Save'}
            </button>
          )}
          
          <button
            onClick={handleArchive}
            className="flex items-center gap-1 px-2 py-0.5 rounded text-[9px] text-zinc-500 hover:text-blue-400 border border-zinc-800 hover:border-blue-500/30 transition-all uppercase"
            title="Archive Story"
          >
            <Archive size={9} /> Archive
          </button>

          <button
            onClick={handleDelete}
            className="flex items-center gap-1 px-2 py-0.5 rounded text-[9px] text-zinc-500 hover:text-red-400 border border-zinc-800 hover:border-red-500/30 transition-all uppercase"
            title="Delete Story"
          >
            <Trash2 size={9} /> Delete
          </button>

          <button
            onClick={handleOpenInEditor}
            className="flex items-center gap-1 px-2 py-0.5 rounded text-[9px] text-zinc-500 hover:text-zinc-300 border border-zinc-800 transition-all uppercase"
            title="Open Inspector"
          >
            <ExternalLink size={9} /> Inspect
          </button>
        </div>
      </div>

      {/* Main Container Split (Sidebar + Content) */}
      <div className="flex-1 flex overflow-hidden">
        {/* Metadata sidebar */}
        <div className={`flex-shrink-0 p-4 space-y-3 overflow-y-auto border-r border-white/5 bg-black/10 ${isSpotlit ? 'w-80' : 'w-64'}`}>
          {isSpotlit && (
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={() => setDrawerStory(null)}
                className="flex items-center gap-1.5 text-[10px] text-zinc-500 hover:text-copernicus-phosphor transition-colors uppercase tracking-wider"
              >
                <ArrowLeft size={11} /> Board
              </button>
              <button 
                onClick={() => { setSpotlight(null); setIsEditing(false) }}
                className="p-1 text-zinc-600 hover:text-zinc-300"
                title="Close Inspector"
              >
                <X size={14} />
              </button>
            </div>
          )}

          <div>
            <p className="text-[8px] text-zinc-600 uppercase tracking-widest mb-0.5">Story Identifier</p>
            <p className="text-[10px] font-mono text-copernicus-phosphor font-bold">{story.id}</p>
          </div>

          <div>
            <p className="text-[8px] text-zinc-600 uppercase tracking-widest mb-1">Priority</p>
            <select
              defaultValue={story.priority}
              onChange={e => handleSetField('priority', e.target.value)}
              className={`text-[10px] font-bold border rounded px-1.5 py-0.5 focus:outline-none bg-transparent w-full ${PRIORITY_COLORS[story.priority] ?? PRIORITY_COLORS.UNKNOWN}`}
            >
              <option value="P0">P0 — Critical</option>
              <option value="P1">P1 — High</option>
              <option value="P2">P2 — Normal</option>
              <option value="P3">P3 — Low</option>
            </select>
          </div>

          <div>
            <p className="text-[8px] text-zinc-600 uppercase tracking-widest mb-1">Type</p>
            <select
              defaultValue={story.type}
              onChange={e => handleSetField('type', e.target.value)}
              className="text-[10px] bg-black/40 border border-zinc-800 rounded px-1.5 py-0.5 text-zinc-300 focus:outline-none focus:border-copernicus-phosphor/50 w-full"
            >
              {['Feature', 'Bug Fix', 'Epic', 'Chore', 'Security', 'Infrastructure'].map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          <div>
            <p className="text-[8px] text-zinc-600 uppercase tracking-widest mb-1">Assignee</p>
            <select
              defaultValue={story.model ?? '(unassigned)'}
              onChange={e => handleSetField('model', e.target.value)}
              className="text-[10px] bg-black/40 border border-zinc-800 rounded px-1.5 py-0.5 text-zinc-300 focus:outline-none focus:border-copernicus-phosphor/50 w-full"
            >
              {modelOptions.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          <div>
            <p className="text-[8px] text-zinc-600 uppercase tracking-widest mb-1">Epic Context</p>
            <select
              defaultValue={story.epic ?? ''}
              onChange={e => handleSetField('epic', e.target.value || '(none)')}
              className="text-[10px] bg-black/40 border border-zinc-800 rounded px-1.5 py-0.5 text-zinc-300 focus:outline-none focus:border-copernicus-phosphor/50 w-full"
            >
              <option value="">(No Epic)</option>
              {epics.map(ep => (
                <option key={ep} value={ep}>{ep}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <p className="text-[8px] text-zinc-600 uppercase tracking-widest mb-1">Workflow Engine</p>
            <div className="flex gap-2">
              <select
                value={story.workflowId ?? '— none —'}
                onChange={e => handleSetField('workflowId', e.target.value)}
                className="flex-1 text-[10px] bg-black/40 border border-zinc-800 rounded px-1.5 py-0.5 text-zinc-300 focus:outline-none focus:border-copernicus-phosphor/50"
              >
                <option value="— none —">— none —</option>
                {workflowTemplates.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
              <button
                onClick={() => {
                  if (workflowStatus === 'RUNNING') {
                    invoke('workflow:reset').then(() => setWorkflowStatus(null)).catch(() => {})
                  } else {
                    invoke('workflow:run', { templateId: story.workflowId, context: { storyId, storyTitle: story.title } }).catch(() => {})
                    setWorkflowStatus('RUNNING')
                  }
                }}
                disabled={!story.workflowId || story.workflowId === '— none —' || !['IN_PROGRESS', 'SPRINT_PLANNING'].includes(story.status)}
                className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium border ${!story.workflowId || story.workflowId === '— none —' || !['IN_PROGRESS', 'SPRINT_PLANNING'].includes(story.status) ? 'opacity-50 cursor-not-allowed border-zinc-700 text-zinc-500' : 'border-copernicus-phosphor text-copernicus-phosphor hover:bg-copernicus-phosphor hover:text-[#050505]'}`}
              >
                {workflowStatus === 'RUNNING' ? '⏹' : '▶'}
              </button>
            </div>

            {workflowStatus && workflowStatus !== 'IDLE' && (
              <div className={`text-[9px] font-mono px-2 py-1 rounded border text-center ${workflowStatus === 'RUNNING' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20 animate-pulse' : workflowStatus === 'COMPLETE' ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
                SYSTEM_{workflowStatus}
              </div>
            )}
          </div>

          <div className="pt-2 border-t border-white/5">
            <p className="text-[8px] text-zinc-600 uppercase tracking-widest mb-0.5">Deployment Date</p>
            <p className="text-[10px] text-zinc-500 font-mono">{story.date || '—'}</p>
          </div>

          <div>
            <p className="text-[8px] text-zinc-600 uppercase tracking-widest mb-0.5">System Status</p>
            <span className="text-[9px] font-bold text-zinc-400 border border-zinc-700 rounded px-2 py-0.5 inline-block uppercase tracking-tighter">
              {story.status}
            </span>
          </div>
        </div>

        {/* Body content */}
        <div className="flex-1 overflow-y-auto p-6 bg-copernicus-bg/50">
          <div className="max-w-3xl mx-auto">
            <h1 className="text-xl font-bold text-white mb-6 border-b border-copernicus-phosphor/20 pb-4">
              {story.title}
            </h1>
            {isEditing ? (
              <textarea
                ref={textareaRef}
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
        </div>
      </div>
    </motion.div>
  )
}
