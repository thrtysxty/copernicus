import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useIpcError } from '../../hooks/useIpcError'
import { unwrapIpc } from '../../types/ipc'
import { X, Check, Edit2, Save, XCircle } from 'lucide-react'
import { useToastStore } from '../../store/toastStore'

interface ItemData {
  id: string
  item_type: string
  content: string
  edited_content: string | null
  status: 'pending' | 'approved' | 'rejected' | 'edited'
  importance?: number
  bank_id?: string
  supersedes_memory_id?: string
  target_file?: string
  section?: string
  proposed_content?: string
  rationale?: string
  title?: string
  priority?: string
  scope?: string
}

interface RetroReviewPanelProps {
  retroId: string
  onClose: () => void
}

export const RetroReviewPanel: React.FC<RetroReviewPanelProps> = ({ retroId, onClose }) => {
  const invoke = useIpcError()
  const [items, setItems] = useState<ItemData[]>([])
  const [loading, setLoading] = useState(true)
  const addToast = useToastStore(s => s.addToast)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')

  useEffect(() => {
    let active = true
    const fetchRetro = async () => {
      try {
        const _raw = await invoke<any>('retro:get', retroId)
        const retroData = unwrapIpc<any>(_raw)
        if (active && retroData?.items) {
          setItems(retroData.items)
        }
      } catch (err) {
        if (active) addToast('Failed to load retro items', 'error')
      } finally {
        if (active) setLoading(false)
      }
    }
    fetchRetro()
    return () => { active = false }
  }, [invoke, retroId, addToast])

  const handleUpdateStatus = async (id: string, newStatus: 'approved' | 'rejected' | 'edited', newContent?: string) => {
    try {
      const payload: any = { id, status: newStatus }
      if (newStatus === 'edited' && newContent !== undefined) {
        payload.edited_content = newContent
      }
      await invoke('retro:update-item', payload)
      
      setItems(prev => prev.map(item => {
        if (item.id === id) {
          return { ...item, status: newStatus, edited_content: newContent ?? item.edited_content }
        }
        return item
      }))
    } catch (err) {
      addToast('Failed to update item', 'error')
    }
  }

  const handleApprove = (id: string) => handleUpdateStatus(id, 'approved')
  const handleReject = (id: string) => handleUpdateStatus(id, 'rejected')
  const handleEditSave = (id: string) => {
    handleUpdateStatus(id, 'edited', editValue)
    setEditingId(null)
  }

  const startEdit = (id: string, currentContent: string) => {
    setEditingId(id)
    setEditValue(currentContent)
  }

  const renderControls = (item: ItemData, approveLabel = 'Approve') => {
    const isEditing = editingId === item.id
    if (isEditing) return null

    return (
      <div className="flex items-center gap-2 mt-2">
        <button
          onClick={() => handleApprove(item.id)}
          className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold uppercase ${item.status === 'approved' || item.status === 'edited' ? 'bg-copernicus-phosphor text-[#050505]' : 'bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700'}`}
        >
          <Check size={12} /> {item.status === 'approved' || item.status === 'edited' ? 'Approved' : approveLabel}
        </button>
        <button
          onClick={() => handleReject(item.id)}
          className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold uppercase ${item.status === 'rejected' ? 'bg-red-500 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700'}`}
        >
          <XCircle size={12} /> {item.status === 'rejected' ? 'Rejected' : 'Reject'}
        </button>
        <button
          onClick={() => startEdit(item.id, item.edited_content ?? item.content)}
          className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold uppercase bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700"
        >
          <Edit2 size={12} /> Edit
        </button>
      </div>
    )
  }

  const renderEditArea = (item: ItemData) => {
    if (editingId !== item.id) return null
    return (
      <div className="mt-2 flex flex-col gap-2">
        <textarea
          className="w-full bg-black/50 border border-copernicus-phosphor/50 text-zinc-200 text-xs p-2 rounded focus:outline-none focus:ring-1 focus:ring-copernicus-phosphor resize-y"
          rows={4}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
        />
        <div className="flex gap-2">
          <button
            onClick={() => handleEditSave(item.id)}
            className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold uppercase bg-copernicus-phosphor text-[#050505] hover:opacity-90"
          >
            <Save size={12} /> Save
          </button>
          <button
            onClick={() => setEditingId(null)}
            className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold uppercase bg-zinc-800 text-zinc-400 hover:text-white"
          >
            Cancel
          </button>
        </div>
      </div>
    )
  }

  const renderItem = (item: ItemData, type: string) => {
    const isEditing = editingId === item.id
    const displayContent = isEditing ? editValue : (item.edited_content ?? item.content)

    return (
      <div key={item.id} className="p-3 bg-zinc-900/50 border border-white/5 rounded relative">
        {type === 'memory_fact' && (
          <>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-mono text-zinc-400">Importance: {item.importance}</span>
              <span className="text-[10px] font-mono text-zinc-400">Bank: {item.bank_id}</span>
            </div>
            {item.supersedes_memory_id && (
              <div className="text-[10px] text-amber-500 mb-2 italic">Supersedes: {item.supersedes_memory_id}</div>
            )}
            {!isEditing && <p className="text-xs text-zinc-300 whitespace-pre-wrap">{displayContent}</p>}
          </>
        )}
        {type === 'file_patch' && (
          <>
            <div className="text-[10px] font-mono text-zinc-400 mb-1">File: {item.target_file}</div>
            <div className="text-[10px] font-mono text-zinc-400 mb-2">Section: {item.section}</div>
            {!isEditing && (
              <pre className="text-[10px] text-zinc-300 bg-black/50 p-2 rounded overflow-x-auto whitespace-pre-wrap">
                {item.proposed_content || displayContent}
              </pre>
            )}
            <div className="text-[10px] text-zinc-500 mt-2 italic">Rationale: {item.rationale}</div>
          </>
        )}
        {type === 'story_queue' && (
          <>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-bold text-zinc-200">{item.title}</span>
              {item.priority && (
                <span className="text-[8px] font-bold px-1 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  {item.priority}
                </span>
              )}
            </div>
            {!isEditing && <p className="text-xs text-zinc-300">{displayContent}</p>}
            <div className="text-[10px] text-zinc-500 mt-2 italic">Rationale: {item.rationale}</div>
          </>
        )}
        {type === 'convention' && (
          <>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-mono text-zinc-400">Scope: {item.scope}</span>
            </div>
            {!isEditing && <p className="text-xs text-zinc-300 whitespace-pre-wrap">{displayContent}</p>}
          </>
        )}
        
        {renderEditArea(item)}
        {renderControls(item, type === 'story_queue' ? 'Queue as story' : 'Approve')}
      </div>
    )
  }

  const renderSection = (title: string, type: string) => {
    const sectionItems = items.filter(i => i.item_type === type)
    if (sectionItems.length === 0) return null

    return (
      <div className="mb-6">
        <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-3 border-b border-white/10 pb-1">{title}</h4>
        <div className="space-y-3">
          {sectionItems.map(item => renderItem(item, type))}
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="absolute inset-0 z-50 bg-black/90 flex items-center justify-center">
        <div className="text-zinc-500 animate-pulse text-sm">Loading Review Panel...</div>
      </div>
    )
  }

  const pendingCount = items.filter(i => i.status === 'pending').length
  const approvedCount = items.filter(i => i.status === 'approved' || i.status === 'edited').length
  const rejectedCount = items.filter(i => i.status === 'rejected').length
  const canCommit = pendingCount === 0 && items.length > 0

  const handleCommit = async () => {
    if (!canCommit) return
    try {
      await invoke('retro:commit', retroId)
      onClose()
    } catch (err) {
      addToast('Failed to commit retro', 'error')
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="absolute inset-y-0 left-0 w-[400px] bg-[#050505] border-r border-white/10 z-50 flex flex-col shadow-2xl"
    >
      <div className="h-8 flex items-center justify-between px-3 border-b border-white/10 shrink-0 bg-black/40">
        <span className="text-[10px] font-bold text-zinc-200 uppercase tracking-widest">Retro Review</span>
        <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
          <X size={14} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 scrollbar-thin scrollbar-thumb-white/10">
        {renderSection('Memory Facts', 'memory_fact')}
        {renderSection('File Patches', 'file_patch')}
        {renderSection('Story Queue', 'story_queue')}
        {renderSection('Conventions', 'convention')}
        
        {items.length === 0 && (
          <div className="text-center text-zinc-500 text-xs italic mt-8">No items found for this retro.</div>
        )}
      </div>

      <div className="p-3 border-t border-white/10 bg-black/40 shrink-0">
        <div className="flex items-center justify-between mb-3 text-[10px] font-mono">
          <span className="text-copernicus-phosphor">{approvedCount} approved</span>
          <span className="text-red-400">{rejectedCount} rejected</span>
          <span className="text-amber-400">{pendingCount} pending</span>
        </div>
        <button
          onClick={handleCommit}
          disabled={!canCommit}
          className={`w-full py-2 rounded text-[10px] font-bold uppercase tracking-widest transition-all ${canCommit ? 'bg-copernicus-phosphor text-[#050505] hover:opacity-90' : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'}`}
        >
          {canCommit ? 'Commit Approved' : 'Resolve Pending Items'}
        </button>
      </div>
    </motion.div>
  )
}
