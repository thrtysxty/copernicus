import React from 'react'
import { UIComponent, UIComponentType } from './types'
import { Trash2, Type, Layout, MousePointer2, Image as ImageIcon, Box } from 'lucide-react'

interface UIComponentInspectorProps {
  component: UIComponent
  onChange: (updated: Partial<UIComponent>) => void
  onDelete: () => void
}

export const UIComponentInspector: React.FC<UIComponentInspectorProps> = ({ component, onChange, onDelete }) => {
  const { type, props, label } = component

  const updateProps = (patch: any) => {
    onChange({ props: { ...props, ...patch } })
  }

  return (
    <div className="flex flex-col h-full bg-[#080808]">
      <div className="h-8 flex items-center justify-between px-3 bg-zinc-900 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <SettingsIcon type={type} />
          <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Inspector</span>
        </div>
        <button 
          onClick={onDelete}
          className="p-1.5 text-zinc-600 hover:text-red-400 transition-colors"
          title="Delete Component"
        >
          <Trash2 size={12} />
        </button>
      </div>

      <div className="p-4 space-y-6 overflow-y-auto no-scrollbar">
        {/* Core fields */}
        <section className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-[9px] text-zinc-500 uppercase font-bold tracking-tighter">Component Label</label>
            <input 
              type="text" 
              value={label}
              onChange={e => onChange({ label: e.target.value })}
              className="w-full bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-xs font-mono text-zinc-300 focus:border-copernicus-phosphor focus:outline-none"
            />
          </div>
        </section>

        {/* Content fields */}
        <section className="space-y-3 border-t border-zinc-900 pt-4">
          <h4 className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest">Content</h4>
          
          {(['heading', 'paragraph', 'button', 'badge', 'alert', 'label'].includes(type)) && (
            <div className="space-y-1.5">
              <label className="text-[9px] text-zinc-500 uppercase font-bold tracking-tighter">Text Content</label>
              <textarea 
                value={props.text || ''}
                onChange={e => updateProps({ text: e.target.value })}
                rows={3}
                className="w-full bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-xs font-mono text-zinc-300 focus:border-copernicus-phosphor focus:outline-none resize-none"
              />
            </div>
          )}

          {(['input', 'textarea'].includes(type)) && (
            <div className="space-y-1.5">
              <label className="text-[9px] text-zinc-500 uppercase font-bold tracking-tighter">Placeholder</label>
              <input 
                type="text" 
                value={props.placeholder || ''}
                onChange={e => updateProps({ placeholder: e.target.value })}
                className="w-full bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-xs font-mono text-zinc-300 focus:border-copernicus-phosphor focus:outline-none"
              />
            </div>
          )}

          {type === 'image' && (
            <div className="space-y-1.5">
              <label className="text-[9px] text-zinc-500 uppercase font-bold tracking-tighter">Image Source URL</label>
              <input 
                type="text" 
                value={props.src || ''}
                onChange={e => updateProps({ src: e.target.value })}
                placeholder="https://..."
                className="w-full bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-xs font-mono text-zinc-300 focus:border-copernicus-phosphor focus:outline-none"
              />
            </div>
          )}
        </section>

        {/* Styling fields */}
        <section className="space-y-3 border-t border-zinc-900 pt-4">
          <h4 className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest">Styling & Layout</h4>
          
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[9px] text-zinc-500 uppercase font-bold tracking-tighter">Text Color</label>
              <input 
                type="text" 
                value={props.color || ''}
                onChange={e => updateProps({ color: e.target.value })}
                placeholder="text-zinc-400"
                className="w-full bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-xs font-mono text-zinc-300 focus:border-copernicus-phosphor focus:outline-none"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[9px] text-zinc-500 uppercase font-bold tracking-tighter">BG Color</label>
              <input 
                type="text" 
                value={props.bgColor || ''}
                onChange={e => updateProps({ bgColor: e.target.value })}
                placeholder="bg-zinc-950"
                className="w-full bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-xs font-mono text-zinc-300 focus:border-copernicus-phosphor focus:outline-none"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[9px] text-zinc-500 uppercase font-bold tracking-tighter">Padding (Tailwind)</label>
            <input 
              type="text" 
              value={props.padding || ''}
              onChange={e => updateProps({ padding: e.target.value })}
              placeholder="p-4"
              className="w-full bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-xs font-mono text-zinc-300 focus:border-copernicus-phosphor focus:outline-none"
            />
          </div>

          {type === 'button' && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-[9px] text-zinc-500 uppercase font-bold tracking-tighter">Variant</label>
                <select 
                  value={props.variant || 'primary'}
                  onChange={e => updateProps({ variant: e.target.value })}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-[10px] font-mono text-zinc-300 focus:border-copernicus-phosphor focus:outline-none"
                >
                  <option value="primary">Primary</option>
                  <option value="secondary">Secondary</option>
                  <option value="ghost">Ghost</option>
                  <option value="danger">Danger</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[9px] text-zinc-500 uppercase font-bold tracking-tighter">Size</label>
                <select 
                  value={props.size || 'md'}
                  onChange={e => updateProps({ size: e.target.value })}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-[10px] font-mono text-zinc-300 focus:border-copernicus-phosphor focus:outline-none"
                >
                  <option value="sm">Small</option>
                  <option value="md">Medium</option>
                  <option value="lg">Large</option>
                </select>
              </div>
            </div>
          )}

          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer group">
              <input 
                type="checkbox" 
                checked={props.rounded || false}
                onChange={e => updateProps({ rounded: e.target.checked })}
                className="w-3 h-3 rounded border-zinc-800 bg-zinc-900 text-copernicus-phosphor focus:ring-0 focus:ring-offset-0"
              />
              <span className="text-[9px] text-zinc-500 uppercase font-bold group-hover:text-zinc-300 transition-colors tracking-tighter">Rounded</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer group">
              <input 
                type="checkbox" 
                checked={props.shadow || false}
                onChange={e => updateProps({ shadow: e.target.checked })}
                className="w-3 h-3 rounded border-zinc-800 bg-zinc-900 text-copernicus-phosphor focus:ring-0 focus:ring-offset-0"
              />
              <span className="text-[9px] text-zinc-500 uppercase font-bold group-hover:text-zinc-300 transition-colors tracking-tighter">Shadow</span>
            </label>
          </div>

          <div className="space-y-1.5">
            <label className="text-[9px] text-zinc-500 uppercase font-bold tracking-tighter">Extra Tailwind Classes</label>
            <input 
              type="text" 
              value={props.extraClasses || ''}
              onChange={e => updateProps({ extraClasses: e.target.value })}
              placeholder="mt-2 border-dashed"
              className="w-full bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-xs font-mono text-zinc-300 focus:border-copernicus-phosphor focus:outline-none"
            />
          </div>
        </section>
      </div>
    </div>
  )
}

const SettingsIcon = ({ type }: { type: UIComponentType }) => {
  if (['heading', 'paragraph', 'label'].includes(type)) return <Type size={12} className="text-blue-400" />
  if (['container', 'row', 'column', 'card'].includes(type)) return <Layout size={12} className="text-purple-400" />
  if (['button', 'input', 'textarea', 'select'].includes(type)) return <MousePointer2 size={12} className="text-green-400" />
  if (type === 'image') return <ImageIcon size={12} className="text-orange-400" />
  return <Box size={12} className="text-zinc-500" />
}
