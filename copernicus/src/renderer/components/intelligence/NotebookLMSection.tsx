import log from '../../utils/logger'
import React, { useState, useEffect } from 'react'
import { Book, Link as LinkIcon, Trash2, CheckCircle2, AlertCircle } from 'lucide-react'
import { useIpcError } from '../../hooks/useIpcError'
import { unwrapIpc , IpcResult} from '../../types/ipc'

interface Notebook {
  id: string
  name: string
  domain: string
  description: string
  created_at: number
}

interface NotebookLMSectionProps {
  selectedNotebookId?: string | null
  onSelectNotebook?: (id: string) => void
}

export const NotebookLMSection: React.FC<NotebookLMSectionProps> = ({ selectedNotebookId, onSelectNotebook }) => {
  const invoke = useIpcError()
  const [notebooks, setNotebooks] = useState<Notebook[]>([])
  const [isAdding, setIsAdding] = useState(false)
  const [newUrl, setNewUrl] = useState('')
  const [newName, setNewName] = useState('')
  const [newDomain, setNewDomain] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [status, setStatus] = useState<'checking' | 'healthy' | 'error'>('checking')

  useEffect(() => {
    fetchNotebooks()
    checkStatus()
  }, [])

  const fetchNotebooks = async () => {
    try {
      const res = await invoke<IpcResult<Notebook[]>>('nlm:list-notebooks')
      const data = unwrapIpc<Notebook[]>(res)
      if (data) setNotebooks(data)
    } catch (e) {
      log.error(e)
    }
  }

  const checkStatus = async () => {
    setStatus('checking')
    try {
      // Just do a dummy query to check bridge health
      const res = await invoke<IpcResult<{ answer?: string, error?: string }>>('nlm:query', { notebookId: 'dummy', question: 'ping' })
      const data = unwrapIpc<{ answer?: string, error?: string }>(res)
      if (data?.error && data.error === 'NbLM bridge unavailable - notebooklm-py not installed') {
        setStatus('error')
      } else if (data?.error && data.error.includes('NbLM bridge unavailable')) {
        setStatus('error')
      } else {
        setStatus('healthy')
      }
    } catch (e) {
      setStatus('error')
    }
  }

  const handleAdd = async () => {
    // extract ID from URL (e.g., https://notebooklm.google.com/notebook/12345)
    const match = newUrl.match(/notebook\/([a-zA-Z0-9_-]+)/)
    const id = match ? match[1] : newUrl.trim()

    if (!id || !newName || !newDomain) return

    try {
      await invoke('nlm:register-notebook', { id, name: newName, domain: newDomain, description: newDesc })
      setIsAdding(false)
      setNewUrl('')
      setNewName('')
      setNewDomain('')
      setNewDesc('')
      fetchNotebooks()
    } catch (e) {
      log.error(e)
    }
  }

  const handleRemove = async (id: string) => {
    try {
      await invoke('nlm:remove-notebook', id)
      fetchNotebooks()
    } catch (e) {
      log.error(e)
    }
  }

  return (
    <div className="mt-8 pt-4 border-t border-white/5 max-h-80 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-800">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Book size={14} className="text-blue-400" />
          <h3 className="text-[11px] font-bold uppercase tracking-widest text-zinc-300">NotebookLM Bridge</h3>
        </div>
        <div className="flex items-center gap-2">
          {status === 'checking' && <span className="text-[11px] text-zinc-500 uppercase font-bold tracking-widest">Checking...</span>}
          {status === 'healthy' && <div className="flex items-center gap-1"><CheckCircle2 size={12} className="text-green-500" /><span className="text-[11px] text-green-500 font-bold uppercase tracking-widest">Connected</span></div>}
          {status === 'error' && <div className="flex items-center gap-1"><AlertCircle size={12} className="text-red-500" /><span className="text-[11px] text-red-500 font-bold uppercase tracking-widest">Disconnected</span></div>}
        </div>
      </div>

      <div className="space-y-2">
        {notebooks.map(nb => {
          const active = selectedNotebookId === nb.id
          return (
            <div
              key={nb.id}
              className={`flex items-center justify-between p-2 cursor-pointer transition-colors ${active ? 'bg-copernicus-phosphor text-[#050505] rounded-none' : 'bg-zinc-900/50 border border-white/5 rounded hover:bg-zinc-800/50'}`}
              onClick={() => onSelectNotebook && onSelectNotebook(nb.id)}
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-bold ${active ? 'text-[#050505]' : 'text-zinc-200'}`}>{nb.name}</span>
                  <span className={`text-[11px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded ${active ? 'bg-[#050505]/20 text-[#050505]' : 'bg-blue-500/20 text-blue-400'}`}>{nb.domain}</span>
                </div>
                <div className={`text-[11px] mt-0.5 ${active ? 'text-[#050505]/70' : 'text-zinc-500'}`}>{nb.description}</div>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); handleRemove(nb.id); }}
                className={`p-1 transition-colors ${active ? 'text-[#050505]/60 hover:text-red-700' : 'text-zinc-600 hover:text-red-400'}`}
              >
                <Trash2 size={12} />
              </button>
            </div>
          )
        })}
      </div>

      {isAdding ? (
        <div className="mt-2 p-3 bg-zinc-900 border border-zinc-800 rounded space-y-2">
          <input
            placeholder="Notebook URL or ID"
            className="w-full bg-black/50 border border-zinc-800 rounded p-1.5 text-xs text-zinc-300 outline-none focus:border-blue-500/50"
            value={newUrl}
            onChange={e => setNewUrl(e.target.value)}
          />
          <div className="flex gap-2">
            <input
              placeholder="Name"
              className="flex-1 bg-black/50 border border-zinc-800 rounded p-1.5 text-xs text-zinc-300 outline-none focus:border-blue-500/50"
              value={newName}
              onChange={e => setNewName(e.target.value)}
            />
            <input
              placeholder="Domain (e.g. biz-plan)"
              className="flex-1 bg-black/50 border border-zinc-800 rounded p-1.5 text-xs text-zinc-300 outline-none focus:border-blue-500/50"
              value={newDomain}
              onChange={e => setNewDomain(e.target.value)}
            />
          </div>
          <input
            placeholder="Description"
            className="w-full bg-black/50 border border-zinc-800 rounded p-1.5 text-xs text-zinc-300 outline-none focus:border-blue-500/50"
            value={newDesc}
            onChange={e => setNewDesc(e.target.value)}
          />
          <div className="flex gap-2 justify-end mt-2">
            <button onClick={() => setIsAdding(false)} className="text-[11px] text-zinc-500 hover:text-zinc-300 font-bold uppercase tracking-wider px-2 py-1">Cancel</button>
            <button onClick={handleAdd} className="text-[11px] bg-blue-500 text-white px-3 py-1 rounded font-bold uppercase tracking-wider">Save</button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setIsAdding(true)}
          className="mt-2 w-full flex items-center justify-center gap-1.5 py-2 border border-dashed border-zinc-800 hover:border-blue-500/50 text-zinc-500 hover:text-blue-400 rounded text-[11px] font-bold uppercase tracking-wider transition-colors"
        >
          <LinkIcon size={12} /> Register Notebook
        </button>
      )}
    </div>
  )
}
