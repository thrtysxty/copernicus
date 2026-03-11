import React, { useEffect, useState } from 'react'
import { useIpcError } from '../../../hooks/useIpcError'
import { unwrapIpc, IpcResult } from '../../../types/ipc'
import { MonacoEditor } from '../../Editor/MonacoEditor'
import { RotateCcw, Edit2, Check, X } from 'lucide-react'

interface Template {
  id: string
  name: string
  type: string
  content: string
  isOverridden: boolean
}

export const SystemTemplatesSection: React.FC = () => {
  const invoke = useIpcError()
  const [templates, setTemplates] = useState<Template[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editId, setEditId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')

  const loadTemplates = () => {
    invoke<IpcResult<Template[]>>('templates:list').then((res: IpcResult<Template[]>) => {
      const data = unwrapIpc<Template[]>(res)
      if (data) setTemplates(data)
    })
  }

  useEffect(() => {
    loadTemplates()
  }, [])

  const handleEdit = (t: Template) => {
    setEditId(t.id)
    setEditContent(t.content)
  }

  const handleSave = async (id: string) => {
    const res = await invoke<IpcResult<void>>('templates:save', id, editContent)
    if (res?.ok) {
      setEditId(null)
      loadTemplates()
    }
  }

  const handleReset = async (id: string) => {
    const res = await invoke<IpcResult<void>>('templates:reset', id)
    if (res?.ok) {
      setEditId(null)
      loadTemplates()
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-sm font-bold text-zinc-200 uppercase tracking-widest">System Templates</h2>
        <p className="text-[10px] text-zinc-500 font-mono mt-1">Override system workflow and story templates with custom JSON definitions.</p>
      </div>

      <div className="space-y-2">
        {templates.map(t => (
          <div key={t.id} className="border border-copernicus-steel/30 rounded-lg overflow-hidden bg-zinc-900/20">
            <div 
              className="px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-white/5 transition-colors"
              onClick={() => {
                if (expandedId === t.id) setExpandedId(null)
                else {
                    setExpandedId(t.id)
                    if (editId !== t.id) setEditId(null)
                }
              }}
            >
              <div className="flex items-center gap-3">
                <span className="text-[11px] font-bold text-zinc-300 font-mono">{t.name}</span>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-500 font-mono uppercase">{t.type}</span>
                {t.isOverridden && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-copernicus-phosphor/20 text-copernicus-phosphor font-bold uppercase tracking-tighter">Overridden</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {expandedId === t.id ? <X size={14} className="text-zinc-600" /> : <Edit2 size={12} className="text-zinc-600" />}
              </div>
            </div>

            {expandedId === t.id && (
              <div className="border-t border-copernicus-steel/20 p-4 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="h-[200px] border border-copernicus-steel/30 rounded overflow-hidden">
                  <MonacoEditor
                    filePath={`template-${t.id}.json`}
                    value={editId === t.id ? editContent : t.content}
                    language="json"
                    onChange={(v: string | undefined) => { if (editId === t.id) setEditContent(v ?? '') }}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {editId === t.id ? (
                      <>
                        <button
                          onClick={() => handleSave(t.id)}
                          className="flex items-center gap-1.5 px-3 py-1 bg-copernicus-phosphor text-[#050505] rounded text-[10px] font-bold uppercase hover:opacity-90 transition-opacity"
                        >
                          <Check size={12} /> Save Override
                        </button>
                        <button
                          onClick={() => setEditId(null)}
                          className="px-3 py-1 bg-zinc-800 text-zinc-400 rounded text-[10px] font-bold uppercase hover:bg-zinc-700 transition-colors"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => handleEdit(t)}
                        className="flex items-center gap-1.5 px-3 py-1 bg-zinc-800 text-zinc-300 rounded text-[10px] font-bold uppercase hover:bg-zinc-700 transition-colors"
                      >
                        <Edit2 size={12} /> Edit Template
                      </button>
                    )}
                  </div>

                  {t.isOverridden && (
                    <button
                      onClick={() => handleReset(t.id)}
                      className="flex items-center gap-1.5 text-red-400/60 hover:text-red-400 transition-colors text-[9px] font-bold uppercase tracking-wider"
                    >
                      <RotateCcw size={12} /> Reset to Default
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

