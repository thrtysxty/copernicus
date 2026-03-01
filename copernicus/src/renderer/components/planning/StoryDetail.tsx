import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, Edit2, Save, ExternalLink } from 'lucide-react'
import { useIpcError } from '../../hooks/useIpcError'
import { useLayoutStore } from '../../store/layout'
import log from '../../utils/logger'

interface Story {
  id: string
  title: string
  status: string
  path: string
  priority: 'P0' | 'P1' | 'P2' | 'P3' | 'UNKNOWN'
  type: string
  epic: string | null
  model: string | null
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
  const { setDrawerStory, spotlightPane, setSpotlight } = useLayoutStore()
  const isSpotlit = spotlightPane === 'telemetry'

  const story = stories.find(s => s.id === storyId)
  const epics = stories.filter(s => s.type === 'Epic' && s.id !== storyId)

  const [content, setContent] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [modelOptions, setModelOptions] = useState<string[]>(['(unassigned)', 'gemini', 'jules', 'human'])
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    invoke<any>('stories:get-content', storyId)
      .then((r: any) => setContent(r?.data ?? r ?? ''))
      .catch(log.error)
  }, [storyId, invoke])

  useEffect(() => {
    invoke<any>('models:list').then(result => {
      const models: Array<{ id: string }> = (result as any).data || result
      if (Array.isArray(models)) {
        setModelOptions(['(unassigned)', ...models.map(m => m.id), 'gemini', 'jules', 'human'])
      }
    }).catch(() => {})
  }, [invoke])

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

  const handleOpenInEditor = () => {
    setSpotlight('telemetry')
  }

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
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={`flex h-full overflow-hidden bg-copernicus-bg ${isSpotlit ? 'flex-row' : 'flex-col'}`}
    >
      {/* Header bar */}
      <div className={`flex items-center justify-between px-3 py-2 border-b border-white/5 bg-black/20 flex-shrink-0 ${isSpotlit ? 'hidden' : ''}`}>
        <button
          onClick={() => setDrawerStory(null)}
          className="flex items-center gap-1.5 text-[10px] text-zinc-500 hover:text-copernicus-phosphor transition-colors uppercase tracking-wider"
        >
          <ArrowLeft size={11} /> Board
        </button>
        <div className="flex items-center gap-2">
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
          {isSpotlit ? (
            <button
              onClick={() => { setSpotlight(null); setIsEditing(false) }}
              className="flex items-center gap-1 px-2 py-0.5 rounded text-[9px] text-amber-400/70 hover:text-amber-400 border border-amber-500/20 hover:border-amber-500/40 transition-all uppercase"
            >
              <ExternalLink size={9} /> Exit Editor
            </button>
          ) : (
            <button
              onClick={handleOpenInEditor}
              className="flex items-center gap-1 px-2 py-0.5 rounded text-[9px] text-zinc-500 hover:text-zinc-300 border border-zinc-800 transition-all uppercase"
              title="Open Inspector"
            >
              <ExternalLink size={9} /> Inspect
            </button>
          )}
        </div>
      </div>

      {/* Metadata panel */}
      <div className={`flex-shrink-0 p-4 space-y-3 overflow-y-auto border-b border-white/5 ${isSpotlit ? 'w-80 border-b-0 border-r' : ''}`}>
        {isSpotlit && (
          <button
            onClick={() => setDrawerStory(null)}
            className="flex items-center gap-1.5 text-[10px] text-zinc-500 hover:text-copernicus-phosphor transition-colors uppercase tracking-wider mb-2"
          >
            <ArrowLeft size={11} /> Board
          </button>
        )}

        <div>
          <p className="text-[8px] text-zinc-600 uppercase tracking-widest mb-0.5">Story</p>
          <p className="text-[10px] font-mono text-zinc-500">{story.id}</p>
        </div>

        <div>
          <p className="text-[8px] text-zinc-600 uppercase tracking-widest mb-1">Priority</p>
          <select
            defaultValue={story.priority}
            onChange={e => handleSetField('priority', e.target.value)}
            className={`text-[10px] font-bold border rounded px-1.5 py-0.5 focus:outline-none bg-transparent ${PRIORITY_COLORS[story.priority] ?? PRIORITY_COLORS.UNKNOWN}`}
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
            className="text-[10px] bg-black/40 border border-zinc-800 rounded px-1.5 py-0.5 text-zinc-300 focus:outline-none focus:border-copernicus-phosphor/50"
          >
            {['Feature', 'Bug Fix', 'Epic', 'Chore', 'Security', 'Infrastructure'].map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        <div>
          <p className="text-[8px] text-zinc-600 uppercase tracking-widest mb-1">Model / Assignee</p>
          <select
            defaultValue={story.model ?? '(unassigned)'}
            onChange={e => handleSetField('model', e.target.value)}
            className="text-[10px] bg-black/40 border border-zinc-800 rounded px-1.5 py-0.5 text-zinc-300 focus:outline-none focus:border-copernicus-phosphor/50"
          >
            {modelOptions.map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>

        <div>
          <p className="text-[8px] text-zinc-600 uppercase tracking-widest mb-1">Epic</p>
          <select
            defaultValue={story.epic ?? ''}
            onChange={e => handleSetField('epic', e.target.value || '(none)')}
            className="text-[10px] bg-black/40 border border-zinc-800 rounded px-1.5 py-0.5 text-zinc-300 focus:outline-none focus:border-copernicus-phosphor/50"
          >
            <option value="">(No Epic)</option>
            {epics.map(ep => (
              <option key={ep.id} value={ep.id}>{ep.title}</option>
            ))}
          </select>
        </div>

        <div>
          <p className="text-[8px] text-zinc-600 uppercase tracking-widest mb-0.5">Date</p>
          <p className="text-[10px] text-zinc-500">{story.date || '—'}</p>
        </div>

        <div>
          <p className="text-[8px] text-zinc-600 uppercase tracking-widest mb-0.5">Status</p>
          <span className="text-[10px] text-zinc-400 border border-zinc-700 rounded px-1.5 py-0.5 inline-block">
            {story.status}
          </span>
        </div>
      </div>

      {/* Body — markdown or textarea */}
      <div className="flex-1 overflow-y-auto p-4">
        {isEditing ? (
          <textarea
            ref={textareaRef}
            defaultValue={content}
            className="w-full h-full min-h-[400px] bg-black/40 border border-zinc-800 rounded p-3 text-[11px] font-mono text-zinc-300 focus:outline-none focus:border-copernicus-phosphor/50 resize-none leading-relaxed"
            spellCheck={false}
          />
        ) : (
          <pre className="text-[11px] font-mono text-zinc-400 whitespace-pre-wrap leading-relaxed">
            {content}
          </pre>
        )}
      </div>
    </motion.div>
  )
}
