import React, { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useShallow } from 'zustand/react/shallow'
import { useIpcError } from '../hooks/useIpcError'
import { useLayoutStore } from '../store/layout'
import { Crown, Lock, ChevronDown, ChevronUp, Archive, Brain, Bug, Plus, Zap } from 'lucide-react'
import log from '../utils/logger'
import { unwrapIpc } from '../types/ipc'
import { StoryDetail } from './planning/StoryDetail'

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
  flagged?: boolean
  date: string
  blocked: boolean
}

type CreationPhase =
  | { phase: 'idle' }
  | { phase: 'form'; type: 'Epic' | 'Story' | 'Bug' }


const PRIORITY_COLORS: Record<string, string> = {
  P0: 'bg-red-500/20 text-red-400 border-red-500/30',
  P1: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  P2: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  P3: 'bg-zinc-500/20 text-zinc-300 border-zinc-500/30',
  UNKNOWN: 'bg-zinc-800 text-zinc-300 border-zinc-700',
}

const PRIORITY_ORDER: Record<string, number> = { P0: 0, P1: 1, P2: 2, P3: 3, UNKNOWN: 4 }

const StoryCard = React.memo(({
  story,
  idx,
  colId,
  colStories,
  activeStoryId,
  spotlightLane,
  setActiveStoryId,
  setSpotlightLane,
  setDrawerStory,
  setSpotlight,
  workflowStatus
}: {
  story: Story;
  idx: number;
  colId: string;
  colStories: Story[];
  activeStoryId: string | null;
  spotlightLane: string | null;
  setActiveStoryId: (id: string | null) => void;
  setSpotlightLane: (lane: string | null) => void;
  setDrawerStory: (id: string | null) => void;
  setSpotlight: (pane: any) => void;
  workflowStatus: { storyId: string | null; state: string } | null;
  }) => {
  const handleOpen = () => {
    setActiveStoryId(story.id)
    setDrawerStory(story.id)
    setSpotlight('inspector')
  }

  return (
    <motion.div
      data-story-id={story.id}
      data-testid={`story-card-${story.id}`}
      role="button"
      tabIndex={activeStoryId === story.id || (idx === 0 && !colStories.some(s => s.id === activeStoryId)) ? 0 : -1}
      aria-label={`${story.title} — ${story.status}`}
      draggable
      onDragStart={e => (e as any).dataTransfer.setData('text/plain', story.id)}
      className={`p-3 bg-zinc-900/50 border rounded cursor-pointer transition-all hover:border-copernicus-phosphor/30 focus:outline-none focus:ring-2 focus:ring-copernicus-phosphor overflow-hidden ${activeStoryId === story.id ? 'border-copernicus-phosphor/50 bg-zinc-900 shadow-lg' : 'border-white/5'} ${story.flagged ? 'border-l-4 border-l-amber-400' : ''}`}
      onClick={(e) => { e.stopPropagation(); setActiveStoryId(story.id); setSpotlightLane(spotlightLane === colId ? null : colId); }}
      onDoubleClick={() => handleOpen()}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleOpen();
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          const next = colStories[idx + 1];
          if (next) {
            (e.currentTarget.nextElementSibling as HTMLElement)?.focus();
            setActiveStoryId(next.id);
          }
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          const prev = colStories[idx - 1];
          if (prev) {
            (e.currentTarget.previousElementSibling as HTMLElement)?.focus();
            setActiveStoryId(prev.id);
          }
        }
      }}
    >
      <div className="flex items-start gap-2">
        {story.type === 'Epic' && <Crown size={10} className="text-amber-400 mt-0.5" />}
        {story.type === 'Bug' && <Bug size={10} className="text-red-400 mt-0.5" />}
        <span className={`text-[11px] font-medium leading-tight transition-colors line-clamp-2 ${activeStoryId === story.id ? 'text-copernicus-phosphor' : 'text-zinc-300'}`}>{story.title.replace(/^User Story\s+#?\d+[:\s]*/i, '').trim() || story.title}</span>
      </div>

      {story.flagged && (
        <div className="mt-1">
          <span className="px-1 py-0.5 rounded-[2px] text-[7px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">⚑ Review</span>
        </div>
      )}

      {workflowStatus?.storyId === story.id && workflowStatus.state !== 'IDLE' && story.status !== 'COMPLETE' && (
        <div className={`mt-1 flex items-center gap-1 text-[8px] font-mono ${
          workflowStatus.state === 'RUNNING' ? 'text-amber-400' :
          workflowStatus.state === 'COMPLETE' ? 'text-green-400' : 'text-red-400'
        }`}>
          <span className={workflowStatus.state === 'RUNNING' ? 'animate-pulse' : ''}>●</span>
          {workflowStatus.state === 'RUNNING' ? 'RUNNING' :
           workflowStatus.state === 'COMPLETE' ? 'DONE' : 'FAILED'}
        </div>
      )}

      <div className="mt-2 flex items-center gap-1.5 border-t border-white/5 pt-2 overflow-hidden">
        <span className="text-[8px] font-mono text-zinc-500 shrink-0">#{story.id.match(/\d+/)?.[0] ?? story.id}</span>
        {story.workflowId && story.workflowId !== '— none —' && (
          <span className="text-[7px] font-mono text-zinc-600 truncate">{story.workflowId}</span>
        )}
        {story.model && story.model !== '(unassigned)' && (
          <span className="text-[7px] font-mono text-zinc-600 truncate">{story.model}</span>
        )}
        <span className={`ml-auto shrink-0 px-1 py-0.5 rounded-[2px] text-[7px] font-bold border ${PRIORITY_COLORS[story.priority]}`}>{story.priority}</span>
      </div>
    </motion.div>
  )
  }
)


interface KanbanBoardProps {
  onStartSession?: () => void
}

export const KanbanBoard = React.memo(({ onStartSession }: KanbanBoardProps) => {
  const invoke = useIpcError()
  const [stories, setStories] = useState<Story[]>([])
  const [isRepoTargeted, setIsRepoTargeted] = useState(false)

  // Selective subscriptions
  const activeStoryId = useLayoutStore(s => s.activeStoryId)
  const spotlightLane = useLayoutStore(s => s.spotlightLane)
  const columns = useLayoutStore(useShallow(s => s.columns))
  const showArchive = useLayoutStore(s => s.showArchive)
  const toggleArchive = useLayoutStore(s => s.toggleArchive)
  const setTerminalOpen = useLayoutStore(s => s.setTerminalOpen)
  
  const setActiveStoryId = useLayoutStore(s => s.setActiveStoryId)
  const setSpotlightLane = useLayoutStore(s => s.setSpotlightLane)
  const drawerStoryId = useLayoutStore(s => s.drawerStoryId)
  const setDrawerStory = useLayoutStore(s => s.setDrawerStory)
  const setSpotlight = useLayoutStore(s => s.setSpotlight)

  const [showEpics, setShowEpics] = useState(false)
  const [creation, setCreation] = useState<CreationPhase>({ phase: 'idle' })
  const [newTitle, setNewTitle] = useState('')
  const [newEpic, setNewEpic] = useState('')
  const [newPriority, setNewPriority] = useState('P2')
  const [showCreateDropdown, setShowCreateDropdown] = useState(false)
  const [workflowStatus, setWorkflowStatus] = useState<{ storyId: string | null; state: string } | null>(null)

  const dropdownRef = React.useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!showCreateDropdown) return
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowCreateDropdown(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showCreateDropdown])

  const fetchJulesSessions = useCallback(async () => {
    try {
      await invoke<any>('jules:list-sessions')
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

    const removeWorkflowStatus = window.ipcRenderer.on('workflow:status-update', async (_event: any, _payload: any) => {
      try {
        const result = await invoke<any>('workflow:status')
        const data = unwrapIpc<any>(result)
        if (data?.state) {
          setWorkflowStatus({
            storyId: data?.context?.storyId ?? null,
            state: data.state
          })
        }
      } catch (e) {
        log.warn('Failed to get workflow status', e)
      }
    })

    const removeStoriesUpdate = window.ipcRenderer.on('stories:updated', (_event: any, newStories: Story[]) => {
      setStories(newStories)
      invoke<any>('stories:is-repo-targeted').then((r: any) => setIsRepoTargeted(unwrapIpc<any>(r) ?? false))
    })

    const removeStatusChanged = window.ipcRenderer.on('stories:status-changed', (_e: any, { storyNumber, status }: any) => {
      const id = `story_${String(storyNumber).padStart(3, '0')}`
      setStories(prev => prev.map(s => s.id === id ? { ...s, status } : s))
    })

    return () => {
      removeWorkflowStatus()
      removeStoriesUpdate()
      removeStatusChanged()
    }
  }, [invoke, fetchJulesSessions, refreshData])

  const handleDrop = async (e: React.DragEvent, targetStatus: string) => {
    e.preventDefault()
    const id = e.dataTransfer.getData('text/plain')
    setStories(prev => prev.map(s => s.id === id ? { ...s, status: targetStatus } : s))
    try {
      await invoke('stories:update', id, targetStatus)
    } catch (e) {
      log.error('Failed to update story status', e)
      refreshData()
    }
  }

  const handleCreate = async () => {
    if (!newTitle.trim() || creation.phase !== 'form') return
    const type = creation.type === 'Epic' ? 'Epic' : creation.type === 'Bug' ? 'Bug' : 'Feature'
    try {
      const _rawCreate = await invoke<any>('stories:create', {
        title: newTitle.trim(),
        type,
        epic: creation.type === 'Story' && newEpic ? newEpic : '(none)',
        priority: newPriority,
      })
      const storyId: string = unwrapIpc<any>(_rawCreate)
      setNewTitle(''); setNewEpic(''); setNewPriority('P2'); setCreation({ phase: 'idle' })
      setActiveStoryId(storyId)
      setSpotlightLane('planning')
    } catch (e) { log.error('Failed to create story', e) }
  }

  const epics = stories.filter(s => s.type === 'Epic')

  if (drawerStoryId) {
    return <StoryDetail storyId={drawerStoryId} stories={stories as any} />
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-[#050505] text-zinc-300 font-sans overflow-hidden relative">
      {/* Action bar */}
      <div className="flex items-center px-3 py-1.5 border-b border-white/5 shrink-0">
        {/* Left: Epics toggle */}
        <button
          onClick={() => setShowEpics(v => !v)}
          className={`flex items-center gap-1.5 text-[8px] font-bold uppercase tracking-widest transition-colors ${showEpics ? 'text-amber-400' : 'text-zinc-600 hover:text-amber-400'}`}
        >
          <Crown size={10} />
          Epics
          {showEpics ? <ChevronUp size={8} /> : <ChevronDown size={8} />}
        </button>

        {/* Right: Archive + Retro */}
        <div className="flex items-center gap-3 ml-auto">
          <button
            onClick={() => { if (showArchive) { setTerminalOpen(false); toggleArchive() } else { setTerminalOpen(true); toggleArchive() } }}
            className="flex items-center gap-1.5 text-[8px] font-bold uppercase tracking-widest text-zinc-600 hover:text-copernicus-phosphor transition-colors"
          >
            <Archive size={10} />
            {showArchive ? 'Hide Archive' : 'View Archive'}
          </button>
          <button
            onClick={() => invoke('workflow:run', { templateId: 'release-retrospective' })}
            className="flex items-center gap-1.5 text-[8px] font-bold uppercase tracking-widest text-zinc-600 hover:text-copernicus-phosphor transition-colors"
          >
            <Brain size={10} />
            Run Retrospective
          </button>
        </div>
      </div>

      {/* Epics Drawer */}
      {showEpics && (
        <div className="border-b border-amber-500/20 bg-amber-950/10 shrink-0 overflow-x-auto scrollbar-thin scrollbar-thumb-amber-900/40">
          {epics.length === 0 ? (
            <p className="text-[9px] text-zinc-700 italic px-4 py-3">No epics yet — create one from the Planning lane.</p>
          ) : (
            <div className="flex gap-2 px-3 py-2">
              {epics.map(epic => {
                const isActive = activeStoryId === epic.id
                const epicStoryCount = stories.filter(s => s.epic === epic.id && s.type !== 'Epic').length
                return (
                  <button
                    key={epic.id}
                    onClick={() => setActiveStoryId(epic.id)}
                    onDoubleClick={() => { setDrawerStory(epic.id); setSpotlight('inspector') }}
                    className={`flex flex-col gap-0.5 px-3 rounded border shrink-0 transition-all duration-150 cursor-pointer text-left
                      ${isActive
                        ? 'py-2 border-amber-400/70 bg-amber-500/20 shadow-[0_0_8px_rgba(251,191,36,0.15)]'
                        : 'py-1.5 border-amber-500/20 bg-amber-950/20 hover:border-amber-400/40'}`}
                  >
                    <div className="flex items-center gap-2">
                      <Crown size={9} className={`shrink-0 ${isActive ? 'text-amber-300' : 'text-amber-600'}`} />
                      <span className={`text-[9px] font-mono font-bold uppercase tracking-wide max-w-[140px] truncate ${isActive ? 'text-amber-200' : 'text-amber-500'}`}>{epic.title.replace(/^User Story\s+#?\d+[:\s]*/i, '').trim() || epic.title}</span>
                    </div>
                    {isActive && (
                      <span className="text-[7px] font-mono text-amber-600 pl-[17px]">#{epic.id.match(/\d+/)?.[0] ?? epic.id} · {epicStoryCount} {epicStoryCount === 1 ? 'story' : 'stories'} · dbl-click to open</span>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Target Repo Warning Overlay */}
      {!isRepoTargeted && (
        <div className="absolute inset-0 z-[100] bg-black/60 backdrop-blur-[2px] flex items-center justify-center p-8">
          <div className="bg-zinc-900 border border-red-500/30 p-6 rounded shadow-2xl max-w-sm text-center space-y-4">
            <Lock className="mx-auto text-red-500" size={32} />
            <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-200">Session Required</h3>
            <p className="text-xs text-zinc-500 leading-relaxed">
              Please start a{' '}
              <button
                onClick={onStartSession}
                className="text-copernicus-phosphor font-bold underline underline-offset-2 hover:opacity-80 transition-opacity cursor-pointer"
              >
                Dev Session
              </button>{' '}
              to target a repo.
            </p>
          </div>
        </div>
      )}

      {/* Main Board Area */}
      <div className="flex-1 flex overflow-x-auto gap-3 p-3 select-none scrollbar-thin scrollbar-thumb-copernicus-steel">
        {(columns || []).map(col => {
          const colStories = (stories || []).filter(s => s.status === col.status && s.type !== 'Epic')
            .sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 4) - (PRIORITY_ORDER[b.priority] ?? 4))

          const isSpotlit = spotlightLane === col.id
          const isCollapsed = spotlightLane !== null && !isSpotlit

          return (
            <div
              key={col.id}
              data-testid={`column-${col.id}`}
              className={`h-full flex flex-col rounded border shadow-sm transition-all duration-300 relative group/column overflow-hidden shrink-0 
                ${isSpotlit ? 'flex-1 min-w-[320px] border-copernicus-phosphor/20' : isCollapsed ? 'w-10 bg-black/40 border-white/5 cursor-pointer hover:bg-zinc-900' : 'w-56 border-white/5'} ${col.color}`}
              onDrop={e => !isCollapsed ? handleDrop(e, col.status) : undefined}
              onDragOver={e => !isCollapsed ? e.preventDefault() : undefined}
              onClick={isCollapsed ? () => setSpotlightLane(null) : undefined}
            >
              <div className={`h-0.5 w-full ${col.accent} ${isCollapsed ? 'opacity-40' : 'opacity-40 group-hover/column:opacity-100'} transition-opacity`} />

              {isCollapsed ? (
                <div className="flex-1 flex items-center justify-center">
                  <span className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest origin-center whitespace-nowrap" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>
                    {col.label}
                  </span>
                </div>
              ) : (
                <>
                  {/* Column Header */}
                  <div className="h-8 flex items-center justify-between px-3 border-b border-white/5 bg-black/20 shrink-0">
                    <span className="font-bold text-[9px] text-zinc-100 uppercase tracking-widest truncate">{col.label}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] text-zinc-700 font-mono">{colStories.length}</span>
                    </div>
                  </div>

                  <div className="flex-1 p-2 space-y-2 overflow-y-auto scrollbar-none">
                    {col.id === 'planning' && (
                      <div ref={dropdownRef} className="relative mb-2">
                        <button
                          onClick={() => setShowCreateDropdown(v => !v)}
                          className="w-full flex items-center justify-center gap-1 py-1 text-[8px] font-bold uppercase tracking-widest text-zinc-600 hover:text-copernicus-phosphor border border-dashed border-zinc-800 hover:border-copernicus-phosphor/40 rounded transition-colors"
                        >
                          <Plus size={10} /> New
                        </button>
                        {showCreateDropdown && (
                          <div className="absolute top-full left-0 right-0 mt-1 bg-zinc-900 border border-zinc-700 rounded shadow-xl z-20 overflow-hidden">
                            {(['Story', 'Epic', 'Bug'] as const).map(type => (
                              <button
                                key={type}
                                onClick={() => { setNewTitle(''); setNewEpic(''); setCreation({ phase: 'form', type }); setShowCreateDropdown(false) }}
                                className="w-full text-left px-3 py-2 text-[10px] font-bold uppercase tracking-wider hover:bg-zinc-800 transition-colors text-zinc-400 hover:text-zinc-200 flex items-center gap-2"
                              >
                                {type === 'Epic' && <Crown size={10} className="text-amber-400" />}
                                {type === 'Bug' && <Bug size={10} className="text-red-400" />}
                                {type === 'Story' && <Zap size={10} className="text-copernicus-phosphor" />}
                                {type}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                    {/* Creation Form (available from planning) */}
                    {col.id === 'planning' && creation.phase === 'form' && (
                      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="p-3 bg-zinc-900 border border-copernicus-phosphor/30 rounded shadow-xl space-y-2 mb-4">
                        <div className="flex justify-between items-center">
                          <span className="text-[8px] font-bold uppercase tracking-widest text-zinc-500">New {creation.type}</span>
                          <button onClick={() => setShowCreateDropdown(!showCreateDropdown)} className="text-zinc-600 hover:text-white"><ChevronDown size={12} /></button>
                        </div>
                        <input 
                          autoFocus 
                          data-testid="new-story-title"
                          className="w-full bg-black/40 border border-zinc-800 rounded p-1.5 text-[10px] focus:border-copernicus-phosphor outline-none" 
                          placeholder="Title..." 
                          value={newTitle} 
                          onChange={e => setNewTitle(e.target.value)} 
                          onKeyDown={e => e.key === 'Enter' && handleCreate()} 
                        />
                        <div className="flex justify-between gap-2">
                          <button onClick={() => setCreation({ phase: 'idle' })} className="text-[8px] uppercase font-bold text-zinc-600 hover:text-zinc-400">Cancel</button>
                          <button 
                            onClick={handleCreate} 
                            data-testid="create-story-confirm"
                            className="px-3 py-1 bg-copernicus-phosphor/10 text-copernicus-phosphor rounded text-[8px] font-bold uppercase"
                          >
                            Create
                          </button>
                        </div>
                      </motion.div>
                    )}

                    {/* Cards */}
                    {colStories.map((story, idx) => (
                      <StoryCard 
                        key={story.id}
                        story={story}
                        idx={idx}
                        colId={col.id}
                        colStories={colStories}
                        activeStoryId={activeStoryId}
                        spotlightLane={spotlightLane}
                        setActiveStoryId={setActiveStoryId}
                        setSpotlightLane={setSpotlightLane}
                        setDrawerStory={setDrawerStory}
                        setSpotlight={setSpotlight}
                        workflowStatus={workflowStatus}
                      />
                    ))}
                  </div>

                </>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
})
KanbanBoard.displayName = 'KanbanBoard'

