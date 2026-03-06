import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useIpcError } from '../hooks/useIpcError'
import { useLayoutStore } from '../store/layout'
import { Plus, Crown, Lock, ChevronDown, Archive } from 'lucide-react'
import log from '../utils/logger'
import { unwrapIpc } from '../types/ipc'

interface Story {
  id: string
  title: string
  status: string
  path: string
  priority: 'P0' | 'P1' | 'P2' | 'P3' | 'UNKNOWN'
  type: string
  epic_id: string | null
  model: string | null
  workflowId?: string | null
  date: string
  blocked: boolean
}

type CreationPhase =
  | { phase: 'idle' }
  | { phase: 'form'; type: 'Epic' | 'Story' }

const PRIORITY_COLORS: Record<string, string> = {
  P0: 'bg-red-500/20 text-red-400 border-red-500/30',
  P1: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  P2: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  P3: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30',
  UNKNOWN: 'bg-zinc-800 text-zinc-600 border-zinc-700',
}

const PRIORITY_ORDER: Record<string, number> = { P0: 0, P1: 1, P2: 2, P3: 3, UNKNOWN: 4 }


export function KanbanBoard() {
  const invoke = useIpcError()
  const [stories, setStories] = useState<Story[]>([])
      const [isRepoTargeted, setIsRepoTargeted] = useState(false)

  const { 
    activeStoryId, setActiveStoryId,  
    setSpotlight, setSpotlightLane, spotlightLane,
    columns,
    setTerminalOpen
  } = useLayoutStore()
  
  const [creation, setCreation] = useState<CreationPhase>({ phase: 'idle' })
  const [newTitle, setNewTitle] = useState('')
  const [newEpic, setNewEpic] = useState('')
  const [newPriority, setNewPriority] = useState('P2')
  const [showCreateDropdown, setShowCreateDropdown] = useState(false)

  

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
    const removeStoriesUpdate = window.ipcRenderer.on('stories:updated', (_event: any, newStories: Story[]) => {
      setStories(newStories)
      invoke<any>('stories:is-repo-targeted').then((r: any) => setIsRepoTargeted(unwrapIpc<any>(r) ?? false))
    })
    return () => removeStoriesUpdate()
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
    const type = creation.type === 'Epic' ? 'Epic' : 'Feature'
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

  return (
    <div className="flex flex-col h-full bg-[#050505] text-zinc-300 font-sans overflow-hidden relative">
      
      {/* Target Repo Warning Overlay */}
      {!isRepoTargeted && (
        <div className="absolute inset-0 z-[100] bg-black/60 backdrop-blur-[2px] flex items-center justify-center p-8">
          <div className="bg-zinc-900 border border-red-500/30 p-6 rounded shadow-2xl max-w-sm text-center space-y-4">
            <Lock className="mx-auto text-red-500" size={32} />
            <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-200">Session Required</h3>
            <p className="text-xs text-zinc-500 leading-relaxed">
              Please start a <span className="text-copernicus-phosphor font-bold">Dev Session</span> to target a repo.
            </p>
          </div>
        </div>
      )}

      {/* Main Board Area (9 Rows Architecture) */}
      <div className="flex-1 flex overflow-x-auto gap-3 p-3 select-none scrollbar-thin scrollbar-thumb-copernicus-steel">
        {(columns || []).map(col => {
          const colStories = (stories || []).filter(s => s.status === col.status)
            .sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 4) - (PRIORITY_ORDER[b.priority] ?? 4))

          const isSpotlit = spotlightLane === col.id
          const isCollapsed = spotlightLane !== null && !isSpotlit

          if (isCollapsed) {
            return (
              <div
                key={col.id}
                className="w-8 h-full flex flex-col rounded border border-white/5 bg-black/40 transition-all duration-300 cursor-pointer hover:bg-zinc-900 overflow-hidden shrink-0"
                onClick={() => setSpotlightLane(null)}
              >
                 <div className={`h-0.5 w-full ${col.accent} opacity-40`} />
                 <div className="flex-1 flex items-center justify-center">
                   <span className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest origin-center whitespace-nowrap" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>
                     {col.label}
                   </span>
                 </div>
              </div>
            )
          }

          return (
            <div
              key={col.id}
              className={`h-full flex flex-col rounded border shadow-sm ${col.color} transition-all duration-300 relative group/column overflow-hidden shrink-0 ${isSpotlit ? 'w-[400px]' : 'w-64'}`}
              onDrop={e => handleDrop(e, col.status)}
              onDragOver={e => e.preventDefault()}
            >
              <div className={`h-0.5 w-full ${col.accent} opacity-40 group-hover/column:opacity-100 transition-opacity`} />

              {/* Column Header (Single Row) */}
              <div className="h-8 flex items-center justify-between px-3 border-b border-white/5 bg-black/20 shrink-0">
                <span className="font-bold text-[9px] text-zinc-500 uppercase tracking-widest truncate">{col.label}</span>
                <div className="flex items-center gap-2">
                  {col.id === 'planning' && (
                    <button 
                      onClick={() => setCreation({ phase: 'form', type: 'Story' })}
                      className="p-1 text-zinc-600 hover:text-copernicus-phosphor transition-colors"
                    >
                      <Plus size={14} />
                    </button>
                  )}
                  <span className="text-[9px] text-zinc-700 font-mono">{colStories.length}</span>
                </div>
              </div>

              <div className="flex-1 p-2 space-y-2 overflow-y-auto scrollbar-none">
                
                {/* Planning Form */}
                {col.id === 'planning' && creation.phase === 'form' && (
                  <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="p-3 bg-zinc-900 border border-copernicus-phosphor/30 rounded shadow-xl space-y-2 mb-4">
                    <div className="flex justify-between items-center">
                      <span className="text-[8px] font-bold uppercase tracking-widest text-zinc-500">New {creation.type}</span>
                      <button onClick={() => setShowCreateDropdown(!showCreateDropdown)} className="text-zinc-600 hover:text-white"><ChevronDown size={12} /></button>
                    </div>
                    <input autoFocus className="w-full bg-black/40 border border-zinc-800 rounded p-1.5 text-[10px] focus:border-copernicus-phosphor outline-none" placeholder="Title..." value={newTitle} onChange={e => setNewTitle(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleCreate()} />
                    <div className="flex justify-between gap-2">
                      <button onClick={() => setCreation({ phase: 'idle' })} className="text-[8px] uppercase font-bold text-zinc-600 hover:text-zinc-400">Cancel</button>
                      <button onClick={handleCreate} className="px-3 py-1 bg-copernicus-phosphor/10 text-copernicus-phosphor rounded text-[8px] font-bold uppercase">Create</button>
                    </div>
                  </motion.div>
                )}

                {/* Cards */}
                {colStories.map(story => (
                  <motion.div
                    key={story.id}
                    draggable
                    onDragStart={e => (e as any).dataTransfer.setData('text/plain', story.id)}
                    className={`p-3 bg-zinc-900/50 border rounded cursor-pointer transition-all hover:border-copernicus-phosphor/30 ${activeStoryId === story.id ? 'border-copernicus-phosphor/50 bg-zinc-900 shadow-lg' : 'border-white/5'}`}
                    onClick={() => { setActiveStoryId(story.id); setSpotlightLane(col.id); }}
                    onDoubleClick={() => setSpotlight('inspector')}
                  >
                    <div className="flex items-start gap-2">
                      {story.type === 'Epic' && <Crown size={10} className="text-amber-400 mt-0.5" />}
                      <span className={`text-[11px] font-medium leading-tight transition-colors ${activeStoryId === story.id ? 'text-copernicus-phosphor' : 'text-zinc-300'}`}>{story.title}</span>
                    </div>
                    
                    <div className="mt-2 flex items-center justify-between border-t border-white/5 pt-2">
                      <span className="text-[8px] font-mono text-zinc-600">{story.id}</span>
                      <div className="flex gap-1">
                        <span className={`px-1 py-0.5 rounded-[2px] text-[7px] font-bold border ${PRIORITY_COLORS[story.priority]}`}>{story.priority}</span>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Archive Button Footer */}
              <div className="h-8 border-t border-white/5 bg-black/10 flex items-center px-3 justify-between">
                <button 
                  onClick={() => setTerminalOpen(true)}
                  className="flex items-center gap-1.5 text-[8px] font-bold uppercase tracking-widest text-zinc-600 hover:text-copernicus-phosphor transition-colors"
                >
                  <Archive size={10} />
                  View Archive
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
