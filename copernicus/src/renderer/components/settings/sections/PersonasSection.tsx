import React, { useState, useEffect } from 'react'
import { useIpcError } from '../../../hooks/useIpcError'
import { useToastStore } from '../../../store/toastStore'
import { User, Plus, Trash2, Edit3 } from 'lucide-react'

interface Persona {
  id: string
  name: string
  systemPrompt: string
  panelId?: string
  modelId?: string
}

export const PersonasSection: React.FC = () => {
  const invoke = useIpcError()
  const addToast = useToastStore(s => s.addToast)
  const [personas, setPersonas] = useState<Persona[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // Form State
  const [name, setName] = useState('')
  const [prompt, setPrompt] = useState('')

  useEffect(() => {
    invoke<any>('settings:load').then(result => {
      const s = (result as any).data || result
      if (s?.personas) setPersonas(s.personas)
      setLoading(false)
    })
  }, [invoke])

  const handleSave = async (newPersonas: Persona[]) => {
    try {
      await invoke('settings:save', { personas: newPersonas })
      setPersonas(newPersonas)
      addToast('Personas updated', 'success')
    } catch (e: any) {
      addToast(`Save failed: ${e.message}`, 'error')
    }
  }

  const handleAdd = () => {
    if (!name || !prompt) return
    const newPersona: Persona = {
      id: `persona-${Date.now()}`,
      name,
      systemPrompt: prompt
    }
    handleSave([...personas, newPersona])
    setName(''); setPrompt(''); setEditingId(null)
  }

  const handleDelete = (id: string) => {
    handleSave(personas.filter(p => p.id !== id))
  }

  const handleUpdate = () => {
    if (!editingId || !name || !prompt) return
    const updated = personas.map(p => 
      p.id === editingId ? { ...p, name, systemPrompt: prompt } : p
    )
    handleSave(updated)
    setEditingId(null); setName(''); setPrompt('')
  }

  const startEdit = (p: Persona) => {
    setEditingId(p.id)
    setName(p.name)
    setPrompt(p.systemPrompt)
  }

  if (loading) return null

  return (
    <div className="space-y-6 font-mono text-xs text-zinc-300">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-zinc-200 uppercase tracking-widest">Agent Personas</h2>
          <p className="text-[10px] text-zinc-500 font-mono mt-1">Define specialised system prompts for model contexts.</p>
        </div>
        {!editingId && !name && (
          <button 
            onClick={() => { setEditingId('new'); setName(''); setPrompt('') }}
            className="flex items-center gap-2 px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded text-[10px] font-bold uppercase hover:border-copernicus-phosphor transition-colors"
          >
            <Plus size={12} /> New Persona
          </button>
        )}
      </div>

      {(editingId || (name && !personas.find(p => p.id === editingId))) && (
        <div className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-lg space-y-4 animate-in fade-in slide-in-from-top-2">
          <div className="space-y-1.5">
            <label className="text-[9px] text-zinc-500 uppercase font-bold">Persona Name</label>
            <input 
              type="text" 
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Senior Backend Architect"
              className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-xs font-mono focus:border-copernicus-phosphor focus:outline-none"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[9px] text-zinc-500 uppercase font-bold">System Prompt</label>
            <textarea 
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              placeholder="You are an expert in..."
              rows={6}
              className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-xs font-mono focus:border-copernicus-phosphor focus:outline-none resize-none"
            />
          </div>
          <div className="flex gap-2 pt-2">
            <button 
              onClick={editingId === 'new' ? handleAdd : handleUpdate}
              className="flex-1 py-2 bg-copernicus-phosphor text-black rounded text-[10px] font-bold uppercase hover:bg-green-400 transition-colors"
            >
              {editingId === 'new' ? 'Create Persona' : 'Update Persona'}
            </button>
            <button 
              onClick={() => { setEditingId(null); setName(''); setPrompt('') }}
              className="px-4 py-2 bg-zinc-800 border border-zinc-700 rounded text-[10px] font-bold uppercase hover:bg-zinc-700 transition-colors text-zinc-400"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {personas.map(p => (
          <div key={p.id} className="group bg-[#0F0F0F] border border-zinc-800 rounded-lg overflow-hidden transition-all hover:border-zinc-700">
            <div className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-4 flex-1 min-w-0">
                <div className="p-2 rounded bg-zinc-900 text-zinc-500">
                  <User size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-xs font-bold text-zinc-200 uppercase truncate tracking-tight">{p.name}</h3>
                  <p className="text-[10px] text-zinc-500 mt-0.5 truncate font-mono italic opacity-60">
                    "{p.systemPrompt.substring(0, 80)}..."
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-4">
                <button 
                  onClick={() => startEdit(p)}
                  className="p-2 text-zinc-500 hover:text-copernicus-phosphor transition-colors"
                  title="Edit Persona"
                >
                  <Edit3 size={14} />
                </button>
                <button 
                  onClick={() => handleDelete(p.id)}
                  className="p-2 text-zinc-500 hover:text-red-400 transition-colors"
                  title="Delete Persona"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          </div>
        ))}

        {personas.length === 0 && !editingId && (
          <div className="p-12 text-center border-2 border-dashed border-zinc-900 rounded-xl">
            <User className="mx-auto text-zinc-800 mb-3" size={32} />
            <p className="text-[10px] text-zinc-600 uppercase font-bold tracking-widest font-mono">No custom personas defined</p>
          </div>
        )}
      </div>
    </div>
  )
}
