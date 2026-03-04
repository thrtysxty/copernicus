import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useIpcError } from '../hooks/useIpcError'
import { useLayoutStore } from '../store/layout'
import { Plus, X, Crown, Lock, Loader2, Send, Kanban, RotateCcw } from 'lucide-react'
import { StoryDetail } from './planning/StoryDetail'
import { EpicBadge } from './planning/EpicBadge'
import log from '../utils/logger'
import { unwrapIpc } from '../types/ipc'

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

interface JulesSession {
  id: string
  story_id: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  pr_url?: string
}

type CreationPhase =
  | { phase: 'idle' }
  | { phase: 'picking' }
  | { phase: 'form'; type: 'Epic' | 'Story' }

const PRIORITY_COLORS: Record<string, string> = {
  P0: 'bg-red-500/20 text-red-400 border-red-500/30',
  P1: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  P2: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  P3: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30',
  UNKNOWN: 'bg-zinc-800 text-zinc-600 border-zinc-700',
}

const PRIORITY_ORDER: Record<string, number> = { P0: 0, P1: 1, P2: 2, P3: 3, UNKNOWN: 4 }

const MODEL_LABELS: Record<string, string> = {
  'claude-sonnet-4-6': 'claude',
  'claude-opus-4-6': 'opus',
  'gemini': 'gemini',
  'jules': 'jules',
  'human': 'human',
}

export function KanbanBoard() {
  const invoke = useIpcError()
  const [stories, setStories] = useState<Story[]>([])
  const [julesSessions, setJulesSessions] = useState<Record<string, JulesSession>>({})
  const [workflowStatuses, setWorkflowStatuses] = useState<Record<string, string>>({})
  const [isRepoTargeted, setIsRepoTargeted] = useState(false)
  const { activeStoryId, setActiveStoryId, drawerStoryId, setDrawerStory, columns, spotlightLane, setSpotlightLane, setView } = useLayoutStore()
  const [creation, setCreation] = useState<CreationPhase>({ phase: 'idle' })
  const [newTitle, setNewTitle] = useState('')
  const [newEpic, setNewEpic] = useState('')
  const [newPriority, setNewPriority] = useState('P2')

  // ── Filters ──────────────────────────────────────────────────────────────
  const [filterPriority, setFilterPriority] = useState<string[]>([])
  const [filterType, setFilterType] = useState<string[]>([])
  const [filterModel, setFilterModel] = useState<string[]>([])
  const [filterEpic, setFilterEpic] = useState<string>('')
  const [filterSearch, setFilterSearch] = useState('')

  const epics = Array.from(new Set(stories.map(s => s.epic).filter(Boolean) as string[])).sort()

  const fetchJulesSessions = useCallback(async () => {
    try {
      const _raw = await invoke<any>('jules:list-sessions')
      const sessions: JulesSession[] = unwrapIpc<any>(_raw) ?? []
      const mapped = sessions.reduce((acc, s) => {
        acc[s.story_id] = s
        return acc
      }, {} as Record<string, JulesSession>)
      setJulesSessions(mapped)
    } catch { /* session list unavailable */ }
  }, [invoke])

  const refreshData = useCallback(async () => {
    try {
      const _rawStories = await invoke<any>('stories:list')
      setStories(unwrapIpc<any>(_rawStories) ?? [])
      const _rawTargeted = await invoke<any>('stories:is-repo-targeted')
      setIsRepoTargeted(unwrapIpc<any>(_rawTargeted) ?? false)
      fetchJulesSessions()
    } catch (e) {
      log.warn('Failed to fetch stories', e)
    }
  }, [invoke, fetchJulesSessions])

  useEffect(() => {
    refreshData()

    const removeStoriesUpdate = window.ipcRenderer.on('stories:updated', (_event: any, newStories: Story[]) => {
      setStories(newStories)
      invoke<any>('stories:is-repo-targeted').then((r: any) => setIsRepoTargeted(unwrapIpc<any>(r) ?? false))
    })

    const removeJulesUpdate = window.ipcRenderer.on('jules:session-update', (_event: any, _update: any) => {
      fetchJulesSessions()
    })

    const removeWorkflowUpdate = window.ipcRenderer.on('workflow:status-update', () => {
      invoke<any>('workflow:status').then(result => {
        if (result?.data?.context?.storyId) {
          setWorkflowStatuses(prev => ({ ...prev, [result.data.context.storyId]: result.data.state }))
        }
      }).catch(() => {})
    })

    invoke<any>('workflow:status').then(result => {
      if (result?.data?.context?.storyId) {
        setWorkflowStatuses(prev => ({ ...prev, [result.data.context.storyId]: result.data.state }))
      }
    }).catch(() => {})

    return () => {
      removeStoriesUpdate()
      removeJulesUpdate()
      removeWorkflowUpdate()
    }
  }, [invoke, fetchJulesSessions, refreshData])

  const dispatchToJules = async (storyId: string) => {
    try {
      await invoke('jules:dispatch-session', storyId)
      fetchJulesSessions()
    } catch (e: any) {
      log.error('Failed to dispatch to Jules', e)
    }
  }

  // ── Drag & Drop ──────────────────────────────────────────────────────────
  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData('text/plain', id)
  }

  const handleDrop = async (e: React.DragEvent, targetStatus: string) => {
    e.preventDefault()
    const id = e.dataTransfer.getData('text/plain')
    setStories(prev => prev.map(s => s.id === id ? { ...s, status: targetStatus } : s))
    try {
      await invoke('stories:update', id, targetStatus)
    } catch (e) {
      log.error('Failed to update story status', e)
    }
  }

  const handleDragOver = (e: React.DragEvent) => e.preventDefault()

  // ── Creation ─────────────────────────────────────────────────────────────
  const handleCreate = async () => {
    if (!newTitle.trim() || creation.phase !== 'form') return
    const type = creation.type === 'Epic' ? 'Epic' : 'Feature'
    const epic = creation.type === 'Story' && newEpic ? newEpic : '(none)'
    try {
      const _rawCreate = await invoke<any>('stories:create', {
        title: newTitle.trim(),
        type,
        epic,
        priority: newPriority,
      })
      const storyId: string = unwrapIpc<any>(_rawCreate)
      setNewTitle('')
      setNewEpic('')
      setNewPriority('P2')
      setCreation({ phase: 'idle' })
      setActiveStoryId(storyId)
    } catch (e) {
      log.error('Failed to create story', e)
    }
  }

  const resetCreation = () => {
    setCreation({ phase: 'idle' })
    setNewTitle('')
    setNewEpic('')
    setNewPriority('P2')
  }

  // ── Filtering ─────────────────────────────────────────────────────────────
  const filterStories = (list: Story[]) => {
    return list
      .filter(s => filterPriority.length === 0 || filterPriority.includes(s.priority))
      .filter(s => filterType.length === 0 || filterType.includes(s.type))
      .filter(s => filterModel.length === 0 || (s.model && filterModel.includes(s.model)))
      .filter(s => !filterEpic || s.epic === filterEpic)
      .filter(s => !filterSearch || s.title.toLowerCase().includes(filterSearch.toLowerCase()))
  }

  const hasFilters = filterPriority.length > 0 || filterType.length > 0 ||
    filterModel.length > 0 || filterEpic || filterSearch

  // ── Panel-fill routing ────────────────────────────────────────────────────
  if (drawerStoryId) {
    return <StoryDetail storyId={drawerStoryId} stories={stories} />
  }

  return (
    <div className="flex flex-col h-full bg-[#050505] text-zinc-300 font-sans overflow-hidden relative">
      
      {/* Target Repo Warning Overlay */}
      {!isRepoTargeted && !drawerStoryId && (
        <div className="absolute inset-0 z-[100] bg-black/60 backdrop-blur-[2px] flex items-center justify-center p-8">
          <div className="bg-zinc-900 border border-red-500/30 p-6 rounded shadow-2xl max-w-sm text-center space-y-4">
            <Lock className="mx-auto text-red-500" size={32} />
            <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-200">Session Required</h3>
            <p className="text-xs text-zinc-500 leading-relaxed">
              Stories must be saved within a repository. Please start a <span className="text-copernicus-phosphor font-bold">Dev Session</span> to target a repo.
            </p>
          </div>
        </div>
      )}

      {/* Standard h-8 Header */}
      <div className="h-8 flex items-center justify-between px-3 border-b border-white/5 bg-black/20 shrink-0">
        <div className="flex items-center gap-2">
          <Kanban size={14} className="text-copernicus-phosphor" />
          <h2 className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">Project Planner</h2>
        </div>
        
        <div className="flex items-center gap-3">
          {isRepoTargeted && (
            <div className="flex items-center gap-1.5 px-2 py-0.5 bg-green-900/20 border border-green-900/30 rounded-full">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              <span className="text-[9px] font-mono text-green-400 font-bold uppercase tracking-tighter">Live Repo Context</span>
            </div>
          )}
          <div className="w-px h-3 bg-zinc-800" />
          <button
            onClick={refreshData}
            className="p-1 hover:text-copernicus-phosphor transition-colors"
            title="Refresh Board"
          >
            <RotateCcw size={12} />
          </button>
          <button
            onClick={() => setView('command-center')}
            className="text-[9px] font-bold uppercase tracking-widest text-zinc-500 hover:text-white transition-colors"
          >
            System Log
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/5 bg-black/10 flex-shrink-0 overflow-x-auto scrollbar-none">
        <input
          type="text"
          placeholder="Search…"
          value={filterSearch}
          onChange={e => setFilterSearch(e.target.value)}
          className="bg-black/40 border border-zinc-800 rounded px-2 py-0.5 text-[10px] text-zinc-300 w-32 focus:outline-none focus:border-copernicus-phosphor/50"
        />
        <select
          value={filterEpic}
          onChange={e => setFilterEpic(e.target.value)}
          className="bg-black/40 border border-zinc-800 rounded px-2 py-0.5 text-[10px] text-zinc-400 focus:outline-none focus:border-copernicus-phosphor/50"
        >
          <option value="">All Epics</option>
          {epics.map(ep => (
            <option key={ep} value={ep}>{ep}</option>
          ))}
        </select>
        {(['P0','P1','P2','P3'] as const).map(p => (
          <button
            key={p}
            onClick={() => setFilterPriority(prev =>
              prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]
            )}
            className={`px-1.5 py-0.5 rounded text-[9px] font-bold border transition-all ${
              filterPriority.includes(p)
                ? PRIORITY_COLORS[p]
                : 'border-zinc-800 text-zinc-600 hover:border-zinc-600'
            }`}
          >
            {p}
          </button>
        ))}
        {hasFilters && (
          <button
            onClick={() => {
              setFilterPriority([]); setFilterType([]); setFilterModel([])
              setFilterEpic(''); setFilterSearch('')
            }}
            className="ml-auto text-[9px] text-zinc-500 hover:text-copernicus-phosphor transition-colors uppercase tracking-wider"
          >
            Clear
          </button>
        )}
      </div>

      {/* Board */}
      <div className="flex flex-1 overflow-x-auto gap-3 p-3 bg-copernicus-bg select-none scrollbar-thin scrollbar-thumb-copernicus-steel">
        {columns.map(col => {
          const colStories = filterStories(stories.filter(s => s.status === col.status))
            .sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 4) - (PRIORITY_ORDER[b.priority] ?? 4))

          const isSpotlit = spotlightLane === col.id
          const isCollapsed = spotlightLane !== null && !isSpotlit

          if (isCollapsed) {
            return (
              <div
                key={col.id}
                className="w-10 h-full flex flex-col rounded border border-white/5 bg-black/40 transition-all duration-300 cursor-pointer hover:bg-black/60 group/column overflow-hidden"
                onClick={() => setSpotlightLane(null)}
              >
                 <div className={`h-0.5 w-full ${col.accent} opacity-40`} />
                 <div className="flex-1 flex items-center justify-center">
                   <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest whitespace-nowrap" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>
                     {col.label}
                   </span>
                 </div>
                 <div className="h-9 flex items-center justify-center border-t border-white/5">
                   <span className="text-[9px] text-zinc-700">{colStories.length}</span>
                 </div>
              </div>
            )
          }

          return (
            <div
              key={col.id}
              className={`h-full flex flex-col rounded border shadow-sm ${col.color} transition-all duration-300 relative group/column overflow-hidden ${isSpotlit ? 'flex-1' : 'min-w-[240px] w-64 flex-shrink-0'}`}
              onDrop={e => handleDrop(e, col.status)}
              onDragOver={handleDragOver}
            >
              {/* Accent bar */}
              <div className={`h-0.5 w-full ${col.accent} opacity-40 group-hover/column:opacity-100 transition-opacity`} />

              {/* Column header */}
              <div className="h-9 flex items-center justify-between px-3 border-b border-white/5 bg-black/20 flex-shrink-0 gap-2">
                <span className="font-bold text-[10px] text-zinc-400 uppercase tracking-widest truncate flex-1">{col.label}</span>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <span className="text-[9px] text-zinc-600 mr-1">{colStories.length}</span>
                </div>
              </div>

              <div className="flex-1 p-2.5 space-y-2.5 overflow-y-auto scrollbar-none">

                {/* Creation picker / form — only in Ready to Build column */}
                {col.id === 'ready-to-build' && creation.phase !== 'idle' && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-3 bg-zinc-900 border border-copernicus-phosphor/40 rounded shadow-lg space-y-2.5"
                  >
                    {creation.phase === 'picking' && (
                      <>
                        <p className="text-[9px] text-zinc-500 uppercase tracking-widest mb-2">Create new</p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setCreation({ phase: 'form', type: 'Epic' })}
                            className="flex-1 flex flex-col items-center gap-1 py-2 rounded border border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10 text-amber-400 transition-all"
                          >
                            <Crown size={14} />
                            <span className="text-[9px] font-bold uppercase tracking-wider">Epic</span>
                          </button>
                          <button
                            onClick={() => setCreation({ phase: 'form', type: 'Story' })}
                            className="flex-1 flex flex-col items-center gap-1 py-2 rounded border border-copernicus-phosphor/30 bg-copernicus-phosphor/5 hover:bg-copernicus-phosphor/10 text-copernicus-phosphor transition-all"
                          >
                            <Plus size={14} />
                            <span className="text-[9px] font-bold uppercase tracking-wider">Story</span>
                          </button>
                        </div>
                        <button
                          onClick={resetCreation}
                          className="w-full text-center text-[9px] text-zinc-600 hover:text-zinc-400 transition-colors pt-1"
                        >
                          Cancel
                        </button>
                      </>
                    )}

                    {creation.phase === 'form' && (
                      <>
                        <div className="flex items-center gap-1.5 mb-1">
                          {creation.type === 'Epic'
                            ? <Crown size={11} className="text-amber-400" />
                            : <Plus size={11} className="text-copernicus-phosphor" />
                          }
                          <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-400">
                            New {creation.type}
                          </span>
                        </div>

                        <input
                          autoFocus
                          className="w-full bg-black/60 border border-zinc-800 rounded p-1.5 text-[11px] text-white focus:outline-none focus:border-copernicus-phosphor transition-all font-mono"
                          placeholder={`${creation.type} title…`}
                          value={newTitle}
                          onChange={e => setNewTitle(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') handleCreate()
                            if (e.key === 'Escape') resetCreation()
                          }}
                        />

                        {creation.type === 'Story' && epics.length > 0 && (
                          <select
                            value={newEpic}
                            onChange={e => setNewEpic(e.target.value)}
                            className="w-full bg-black/60 border border-zinc-800 rounded p-1.5 text-[10px] text-zinc-400 focus:outline-none focus:border-copernicus-phosphor/50"
                          >
                            <option value="">(No Epic)</option>
                            {epics.map(ep => (
                              <option key={ep} value={ep}>{ep}</option>
                            ))}
                          </select>
                        )}

                        <select
                          value={newPriority}
                          onChange={e => setNewPriority(e.target.value)}
                          className="w-full bg-black/60 border border-zinc-800 rounded p-1.5 text-[10px] text-zinc-400 focus:outline-none focus:border-copernicus-phosphor/50"
                        >
                          <option value="P0">P0 — Critical</option>
                          <option value="P1">P1 — High</option>
                          <option value="P2">P2 — Normal</option>
                          <option value="P3">P3 — Low</option>
                        </select>

                        <div className="flex justify-between items-center pt-1">
                          <button
                            onClick={resetCreation}
                            className="flex items-center gap-1 text-[9px] text-zinc-500 hover:text-white transition-colors uppercase font-bold"
                          >
                            <X size={9} /> Cancel
                          </button>
                          <button
                            onClick={handleCreate}
                            className="px-3 py-1 bg-copernicus-phosphor/10 border border-copernicus-phosphor/30 rounded text-[9px] text-copernicus-phosphor hover:bg-copernicus-phosphor/20 uppercase font-bold tracking-wider transition-all"
                          >
                            Create
                          </button>
                        </div>
                      </>
                    )}
                  </motion.div>
                )}

                {/* Story cards */}
                {colStories.map((story, storyIndex) => {
                  const jSession = julesSessions[story.id]
                  const handleCardActivate = () => {
                    setSpotlightLane(col.id)
                    setActiveStoryId(story.id)
                    setDrawerStory(story.id)
                  }
                  return (
                  <motion.div
                    layoutId={story.id}
                    key={story.id}
                    draggable
                    role="button"
                    tabIndex={0}
                    aria-label={`${story.title} — ${story.status}`}
                    data-card-index={storyIndex}
                    onDragStart={(e: any) => handleDragStart(e, story.id)}
                    onKeyDown={(e: React.KeyboardEvent<HTMLDivElement>) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        handleCardActivate()
                      } else if (e.key === 'ArrowDown') {
                        e.preventDefault()
                        const next = e.currentTarget.parentElement?.querySelector<HTMLElement>(
                          `[data-card-index="${storyIndex + 1}"]`
                        )
                        next?.focus()
                      } else if (e.key === 'ArrowUp') {
                        e.preventDefault()
                        const prev = e.currentTarget.parentElement?.querySelector<HTMLElement>(
                          `[data-card-index="${storyIndex - 1}"]`
                        )
                        prev?.focus()
                      }
                    }}
                    className={`p-3 bg-zinc-900/90 border rounded shadow-md cursor-pointer hover:border-copernicus-phosphor/40 hover:translate-y-[-1px] hover:shadow-xl transition-all group/card focus-visible:ring-2 focus-visible:ring-copernicus-phosphor focus-visible:outline-none ${
                      activeStoryId === story.id
                        ? 'border-copernicus-phosphor ring-1 ring-copernicus-phosphor/30'
                        : 'border-white/5'
                    }`}
                    onClick={handleCardActivate}
                  >
                    {/* Title row */}
                    <div className="flex items-start gap-1.5">
                      {story.type === 'Epic' && (
                        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}><Crown size={11} className="text-amber-400 mt-0.5 flex-shrink-0" /></motion.div>
                      )}
                      <span className="text-[11px] font-semibold text-zinc-200 group-hover/card:text-copernicus-phosphor transition-colors leading-snug">
                        {story.title}
                      </span>
                    </div>

                    {/* Epic label */}
                    {workflowStatuses[story.id] === 'RUNNING' && (
                      <div className="mt-1">
                        <span className="text-[8px] text-amber-400 animate-pulse font-bold tracking-widest">
                          ● RUNNING
                        </span>
                      </div>
                    )}

                    <EpicBadge epicId={story.epic || ''} />

                    {/* Badges row */}
                    <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                      <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold border ${PRIORITY_COLORS[story.priority] ?? PRIORITY_COLORS.UNKNOWN}`}>
                        {story.priority}
                      </span>
                      {story.type !== 'Unknown' && (
                        <span className="px-1.5 py-0.5 rounded text-[8px] text-zinc-500 border border-zinc-800 max-w-[80px] truncate">
                          {story.type}
                        </span>
                      )}
                      {story.blocked && (
                        <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[8px] text-red-400 border border-red-500/30 bg-red-500/10">
                          <Lock size={8} /> BLOCKED
                        </span>
                      )}
                      
                      {/* Jules Badge */}
                      {jSession && (
                        <div
                          className={`text-[8px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded flex items-center gap-1
                            ${jSession.status === 'completed' ? 'bg-green-950 text-green-400 border border-green-900/40' :
                              jSession.status === 'failed'    ? 'bg-red-950 text-red-400 border border-red-900/40' :
                              jSession.status === 'running'   ? 'bg-amber-950 text-amber-400 border border-amber-900/40 animate-pulse' :
                              'bg-zinc-900 text-zinc-500 border border-zinc-800'}`}
                        >
                          {jSession.status === 'running' && <Loader2 size={8} className="animate-spin" />}
                          {jSession.status === 'completed' && jSession.pr_url
                            ? <a href={jSession.pr_url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}>PR ↗</a>
                            : jSession.status}
                        </div>
                      )}
                    </div>

                    {/* Footer */}
                    <div className="mt-2 pt-2 border-t border-white/5 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] text-zinc-600 font-mono">{story.id}</span>
                        {story.status === 'APPROVED FOR IMPLEMENTATION' && !jSession && (
                          <button
                            onClick={(e) => { e.stopPropagation(); dispatchToJules(story.id) }}
                            className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-copernicus-phosphor/10 text-copernicus-phosphor border border-copernicus-phosphor/20 hover:bg-copernicus-phosphor/20 transition-all text-[8px] font-bold uppercase tracking-tighter"
                          >
                            <Send size={8} /> Jules
                          </button>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {story.model && (
                          <span className="text-[9px] text-zinc-500 italic">
                            {MODEL_LABELS[story.model] ?? story.model}
                          </span>
                        )}
                        {activeStoryId === story.id && (
                          <span className="flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-copernicus-phosphor animate-pulse shadow-[0_0_6px_rgba(74,222,128,0.8)]" />
                            <span className="text-[8px] text-copernicus-phosphor font-black tracking-widest">ACTIVE</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )})}

                {col.id === 'ready-to-build' && (
                  <button
                    onClick={() => setCreation({ phase: 'picking' })}
                    className="w-full py-2 rounded border border-dashed border-white/10 text-zinc-500 hover:text-copernicus-phosphor hover:border-copernicus-phosphor/30 transition-all flex items-center justify-center gap-2"
                  >
                    <Plus size={14} />
                    <span className="text-[10px] font-bold uppercase tracking-wider">New Story</span>
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
