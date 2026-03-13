import React, { useState, useEffect } from 'react'
import { useIpcError } from '../../../hooks/useIpcError'
import { useToastStore } from '../../../store/toastStore'
import { User, Plus, Trash2, Edit3, Lock, Copy } from 'lucide-react'
import { SettingsLoadResponse } from '../../../types/ipc'
import { DEFAULT_PERSONAS } from '../../../../../electron/data/default-personas'

interface Persona {
  id: string
  name: string
  description?: string
  systemPrompt: string
  role?: 'Architect' | 'Developer' | 'Reviewer' | 'Custom'
  modelAffinity?: string
  panelId?: string
  modelId?: string
  system?: boolean
}

const SYSTEM_PERSONAS: Persona[] = DEFAULT_PERSONAS as Persona[]

export const PersonasSection: React.FC = () => {
  const invoke = useIpcError()
  const addToast = useToastStore(s => s.addToast)
  const [customPersonas, setCustomPersonas] = useState<Persona[]>([])
  const [disabledPersonas, setDisabledPersonas] = useState<string[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // Form State
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [prompt, setPrompt] = useState('')
  const [role, setRole] = useState<Persona['role']>('Custom')
  const [modelAffinity, setModelAffinity] = useState('')

  useEffect(() => {
    invoke<SettingsLoadResponse>('settings:load').then(s => {
      if (s?.customPersonas) setCustomPersonas(s.customPersonas as Persona[])
      if (s?.disabledPersonas) setDisabledPersonas(s.disabledPersonas as string[])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [invoke])

  const handleSave = async (patch: { customPersonas?: Persona[], disabledPersonas?: string[] }) => {
    try {
      const nextCustom = patch.customPersonas ?? customPersonas
      const nextDisabled = patch.disabledPersonas ?? disabledPersonas
      
      await invoke('settings:save', { 
        customPersonas: nextCustom,
        disabledPersonas: nextDisabled
      })
      
      if (patch.customPersonas) setCustomPersonas(nextCustom)
      if (patch.disabledPersonas) setDisabledPersonas(nextDisabled)
      
      addToast('Personas updated', 'success')
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      addToast(`Save failed: ${message}`, 'error')
    }
  }

  const togglePersona = (id: string) => {
    const nextDisabled = disabledPersonas.includes(id)
      ? disabledPersonas.filter(pid => pid !== id)
      : [...disabledPersonas, id]
    handleSave({ disabledPersonas: nextDisabled })
  }

  const handleAdd = () => {
    if (!name || !prompt) return
    const newPersona: Persona = {
      id: `persona-${Date.now()}`,
      name,
      description,
      systemPrompt: prompt,
      role,
      modelAffinity
    }
    handleSave({ customPersonas: [...customPersonas, newPersona] })
    resetForm()
  }

  const handleDelete = (id: string) => {
    handleSave({ customPersonas: customPersonas.filter(p => p.id !== id) })
  }

  const handleUpdate = () => {
    if (!editingId || !name || !prompt) return
    const updated = customPersonas.map(p => 
      p.id === editingId ? { ...p, name, description, systemPrompt: prompt, role, modelAffinity } : p
    )
    handleSave({ customPersonas: updated })
    resetForm()
  }

  const resetForm = () => {
    setEditingId(null)
    setName('')
    setDescription('')
    setPrompt('')
    setRole('Custom')
    setModelAffinity('')
  }

  const startEdit = (p: Persona) => {
    setEditingId(p.id)
    setName(p.name)
    setDescription(p.description || '')
    setPrompt(p.systemPrompt)
    setRole(p.role || 'Custom')
    setModelAffinity(p.modelAffinity || '')
  }

  const startDuplicate = (p: Persona) => {
    setEditingId('new')
    setName(`${p.name} (Copy)`)
    setDescription(p.description || '')
    setPrompt(p.systemPrompt)
    setRole(p.role || 'Custom')
    setModelAffinity(p.modelAffinity || '')
  }

  if (loading) return null

  return (
    <div className="space-y-6 font-mono text-xs text-zinc-300">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-zinc-200 uppercase tracking-widest">Agent Personas</h2>
          <p className="text-[10px] text-zinc-500 font-mono mt-1">Define specialised system prompts for model contexts.</p>
        </div>
        {!editingId && (
          <button 
            onClick={() => { setEditingId('new'); resetForm() }}
            className="flex items-center gap-2 px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded text-[10px] font-bold uppercase hover:border-copernicus-phosphor transition-colors"
          >
            <Plus size={12} /> New Persona
          </button>
        )}
      </div>

      {editingId && (
        <div className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-lg space-y-4 animate-in fade-in slide-in-from-top-2">
          <div className="grid grid-cols-2 gap-4">
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
              <label className="text-[9px] text-zinc-500 uppercase font-bold">Role Selector</label>
              <select 
                value={role}
                onChange={e => setRole(e.target.value as any)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-xs font-mono focus:border-copernicus-phosphor focus:outline-none"
              >
                <option value="Architect">Architect</option>
                <option value="Developer">Developer</option>
                <option value="Reviewer">Reviewer</option>
                <option value="Custom">Custom</option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[9px] text-zinc-500 uppercase font-bold">Description</label>
            <textarea 
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Short summary of this persona's expertise..."
              rows={2}
              className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-xs font-mono focus:border-copernicus-phosphor focus:outline-none resize-none"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[9px] text-zinc-500 uppercase font-bold">System Prompt</label>
            <textarea 
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              placeholder="You are an expert in..."
              rows={4}
              className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-xs font-mono focus:border-copernicus-phosphor focus:outline-none resize-none"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[9px] text-zinc-500 uppercase font-bold">Model Affinity (Optional)</label>
            <input 
              type="text" 
              value={modelAffinity}
              onChange={e => setModelAffinity(e.target.value)}
              placeholder="e.g. anthropic:claude-3-5-sonnet"
              className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-xs font-mono focus:border-copernicus-phosphor focus:outline-none"
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
              onClick={resetForm}
              className="px-4 py-2 bg-zinc-800 border border-zinc-700 rounded text-[10px] font-bold uppercase hover:bg-zinc-700 transition-colors text-zinc-400"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* System Personas */}
      <div className="space-y-2">
        <p className="text-[9px] text-zinc-600 uppercase font-bold tracking-widest flex items-center gap-1.5">
          <Lock size={9} /> System Personas
        </p>
        {SYSTEM_PERSONAS.map(p => {
          const enabled = !disabledPersonas.includes(p.id)
          return (
            <div key={p.id} className={`group bg-[#0A0A0A] border rounded-lg transition-colors ${enabled ? 'border-zinc-800/50' : 'border-zinc-900 opacity-50'}`}>
              <div className="p-3 flex items-center gap-3">
                <div className={`p-1.5 rounded bg-zinc-900 ${enabled ? 'text-zinc-400' : 'text-zinc-700'}`}>
                  <User size={13} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className={`text-[10px] font-bold uppercase truncate tracking-tight ${enabled ? 'text-zinc-300' : 'text-zinc-600'}`}>{p.name}</h3>
                    <span className="text-[8px] px-1 py-0.5 rounded bg-zinc-800 text-zinc-600 font-bold uppercase">{p.role}</span>
                  </div>
                  <p className="text-[9px] text-zinc-600 mt-0.5 truncate font-mono italic">
                    {p.description}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => startDuplicate(p)}
                      className="p-1.5 text-zinc-500 hover:text-copernicus-phosphor transition-colors"
                      title="Duplicate Persona"
                    >
                      <Copy size={14} />
                    </button>
                  </div>
                  <Toggle enabled={enabled} onClick={() => togglePersona(p.id)} />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* User Personas */}
      <div className="space-y-3">
        <p className="text-[9px] text-zinc-600 uppercase font-bold tracking-widest">Custom Personas</p>
        {customPersonas.map(p => {
          const enabled = !disabledPersonas.includes(p.id)
          return (
            <div key={p.id} className={`group bg-[#0F0F0F] border rounded-lg overflow-hidden transition-all ${enabled ? 'border-zinc-800 hover:border-zinc-700' : 'border-zinc-900 opacity-50'}`}>
              <div className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className={`p-2 rounded bg-zinc-900 ${enabled ? 'text-zinc-500' : 'text-zinc-700'}`}>
                    <User size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className={`text-xs font-bold uppercase truncate tracking-tight ${enabled ? 'text-zinc-200' : 'text-zinc-600'}`}>{p.name}</h3>
                      <span className="text-[8px] px-1 py-0.5 rounded bg-zinc-800 text-zinc-600 font-bold uppercase">{p.role}</span>
                    </div>
                    <p className="text-[10px] text-zinc-500 mt-0.5 truncate font-mono italic opacity-60">
                      {p.description || p.systemPrompt.substring(0, 80)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => startDuplicate(p)}
                      className="p-2 text-zinc-500 hover:text-copernicus-phosphor transition-colors"
                      title="Duplicate Persona"
                    >
                      <Copy size={14} />
                    </button>
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
                  <Toggle enabled={enabled} onClick={() => togglePersona(p.id)} />
                </div>
              </div>
            </div>
          )
        })}

        {customPersonas.length === 0 && !editingId && (
          <div className="p-8 text-center border-2 border-dashed border-zinc-900 rounded-xl">
            <User className="mx-auto text-zinc-800 mb-3" size={28} />
            <p className="text-[10px] text-zinc-600 uppercase font-bold tracking-widest font-mono">No custom personas defined</p>
          </div>
        )}
      </div>
    </div>
  )
}

function Toggle({ enabled, onClick }: { enabled: boolean, onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-8 h-4 rounded-full transition-colors relative flex-shrink-0 ${enabled ? 'bg-copernicus-phosphor' : 'bg-zinc-800'}`}
    >
      <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${enabled ? 'left-4.5' : 'left-0.5'}`} 
           style={{ left: enabled ? '18px' : '2px' }} />
    </button>
  )
}
