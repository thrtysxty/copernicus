import React, { useState, useEffect } from 'react'
import { useIpcError } from '../../../hooks/useIpcError'
import { useToastStore } from '../../../store/toastStore'
import { FileText, Plus, Trash2, Edit3 } from 'lucide-react'
import { TEMPLATE_MANIFEST } from '../../../templates'
import { SettingsLoadResponse } from '../../../types/ipc'
import { SystemTemplatesSection } from './SystemTemplatesSection'
import { DEFAULT_TEMPLATES } from '../../../../../electron/data/default-templates'

interface StoryTemplate {
  id: string
  name: string
  body: string
}

const DEFAULT_TEMPLATE = `# {{storyTitle}}

## Context

## Requirements

## Technical Implementation
`

export const TemplatesSection: React.FC = () => {
  const invoke = useIpcError()
  const addToast = useToastStore(s => s.addToast)

  const [templates, setTemplates] = useState<StoryTemplate[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // Form State
  const [name, setName] = useState('')
  const [body, setBody] = useState('')

  useEffect(() => {
    invoke<SettingsLoadResponse>('settings:load').then(result => {
      const s = result as any
      if (s?.storyTemplates && s.storyTemplates.length > 0) {
        setTemplates(s.storyTemplates)
      } else {
        // Seed from DEFAULT_TEMPLATES so all types are present
        const initial: StoryTemplate[] = TEMPLATE_MANIFEST.map(t => {
          const defaultTpl = DEFAULT_TEMPLATES.find(dt => dt.id === t.id)
          return {
            id: t.id,
            name: t.label,
            body: defaultTpl ? defaultTpl.body : DEFAULT_TEMPLATE,
          }
        })
        setTemplates(initial)
        invoke('settings:save', { storyTemplates: initial })
      }
      setLoading(false)
    })
  }, [invoke])

  const handleSave = async (newTemplates: StoryTemplate[]) => {
    try {
      await invoke('settings:save', { storyTemplates: newTemplates })
      setTemplates(newTemplates)
      addToast('Templates updated', 'success')
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      addToast(`Save failed: ${message}`, 'error')
    }
  }

  const handleAdd = () => {
    if (!name || !body) return
    const newTpl: StoryTemplate = {
      id: `tpl-${Date.now()}`,
      name,
      body
    }
    handleSave([...templates, newTpl])
    setName(''); setBody(''); setEditingId(null)
  }

  const handleDelete = (id: string) => {
    if (templates.length === 1) {
      addToast('At least one template is required', 'warn')
      return
    }
    handleSave(templates.filter(t => t.id !== id))
  }

  const handleUpdate = () => {
    if (!editingId || !name || !body) return
    const updated = templates.map(t => 
      t.id === editingId ? { ...t, name, body } : t
    )
    handleSave(updated)
    setEditingId(null); setName(''); setBody('')
  }

  const startEdit = (t: StoryTemplate) => {
    setEditingId(t.id)
    setName(t.name)
    setBody(t.body)
  }

  if (loading) return null

  return (
    <div className="space-y-12">
      <SystemTemplatesSection />

      <hr className="border-copernicus-steel/20" />

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-zinc-200 uppercase tracking-widest">Story Templates</h2>
            <p className="text-[10px] text-zinc-500 font-mono mt-1">Configure boilerplate for new Kanban stories.</p>
          </div>
          {!editingId && (
            <button 
              onClick={() => { setEditingId('new'); setName(''); setBody(DEFAULT_TEMPLATE) }}
              className="flex items-center gap-2 px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded text-[10px] font-bold uppercase hover:border-copernicus-phosphor transition-colors"
            >
              <Plus size={12} /> New Template
            </button>
          )}
        </div>

        {editingId === 'new' && (
          <div className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-lg space-y-4 animate-in fade-in slide-in-from-top-2">
            <div className="space-y-1.5">
              <label className="text-[9px] text-zinc-500 uppercase font-bold">Template Name</label>
              <input 
                type="text" 
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Bug Report, Feature Request"
                className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-xs font-mono focus:border-copernicus-phosphor focus:outline-none"
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="text-[9px] text-zinc-500 uppercase font-bold">Markdown Content</label>
                <span className="text-[8px] text-zinc-600 font-mono italic">Supports &#123;&#123;storyTitle&#125;&#125; variable</span>
              </div>
              <textarea 
                value={body}
                onChange={e => setBody(e.target.value)}
                rows={8}
                className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-xs font-mono focus:border-copernicus-phosphor focus:outline-none resize-none"
              />
            </div>
            <div className="flex gap-2">
              <button 
                onClick={handleAdd}
                className="flex-1 py-2 bg-copernicus-phosphor text-black rounded text-[10px] font-bold uppercase hover:bg-green-400 transition-colors"
              >
                Create Template
              </button>
              <button 
                onClick={() => { setEditingId(null); setName(''); setBody('') }}
                className="px-4 py-2 bg-zinc-800 border border-zinc-700 rounded text-[10px] font-bold uppercase hover:bg-zinc-700 transition-colors text-zinc-400"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-3">
          {templates.map(t => (
            <React.Fragment key={t.id}>
              {editingId === t.id ? (
                <div className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-lg space-y-4 animate-in fade-in">
                  <div className="space-y-1.5">
                    <label className="text-[9px] text-zinc-500 uppercase font-bold">Template Name</label>
                    <input
                      type="text"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      placeholder="e.g. Bug Report, Feature Request"
                      className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-xs font-mono focus:border-copernicus-phosphor focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <label className="text-[9px] text-zinc-500 uppercase font-bold">Markdown Content</label>
                      <span className="text-[8px] text-zinc-600 font-mono italic">Supports &#123;&#123;storyTitle&#125;&#125; variable</span>
                    </div>
                    <textarea
                      value={body}
                      onChange={e => setBody(e.target.value)}
                      rows={8}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-xs font-mono focus:border-copernicus-phosphor focus:outline-none resize-none"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleUpdate}
                      className="flex-1 py-2 bg-copernicus-phosphor text-black rounded text-[10px] font-bold uppercase hover:bg-green-400 transition-colors"
                    >
                      Update Template
                    </button>
                    <button
                      onClick={() => { setEditingId(null); setName(''); setBody('') }}
                      className="px-4 py-2 bg-zinc-800 border border-zinc-700 rounded text-[10px] font-bold uppercase hover:bg-zinc-700 transition-colors text-zinc-400"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="group bg-[#0F0F0F] border border-zinc-800 rounded-lg overflow-hidden transition-all hover:border-zinc-700">
                  <div className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="p-2 rounded bg-zinc-900 text-zinc-500">
                        <FileText size={16} />
                      </div>
                      <div>
                        <h3 className="text-xs font-bold text-zinc-200 uppercase">{t.name}</h3>
                        <p className="text-[10px] text-zinc-500 mt-0.5 font-mono">{t.body.split('\n').length} lines</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => startEdit(t)}
                        className="p-2 text-zinc-500 hover:text-copernicus-phosphor transition-colors"
                        title="Edit Template"
                      >
                        <Edit3 size={14} />
                      </button>
                      <button
                        onClick={() => handleDelete(t.id)}
                        className="p-2 text-zinc-500 hover:text-red-400 transition-colors"
                        title="Delete Template"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  )
}
