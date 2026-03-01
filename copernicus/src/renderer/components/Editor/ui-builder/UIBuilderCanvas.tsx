import React, { useState, useRef, useEffect } from 'react'
import { useLayoutStore } from '../../../store/layout'
import { UIComponent, UIComponentType } from './types'
import { renderComponentTree } from './render'
import { UIComponentInspector } from './UIComponentInspector'
import { Rnd } from 'react-rnd'
import {
  Code, Download, Trash2, Layout,
  GripVertical,
  MousePointer2, Square, Type, Image as ImageIcon,
  FormInput, Layers, Box
} from 'lucide-react'
import { useIpcError } from '../../../hooks/useIpcError'
import { useToastStore } from '../../../store/toastStore'

const PALETTE: Array<{ section: string; icon: any; items: Array<{ type: UIComponentType; label: string; icon: any }> }> = [
  { 
    section: 'LAYOUT', 
    icon: Layout,
    items: [
      { type:'container',label:'Container', icon: Box },
      { type:'row',label:'Row', icon: GripVertical },
      { type:'column',label:'Column', icon: Layers },
      { type:'card',label:'Card', icon: Square },
      { type:'spacer',label:'Spacer', icon: MousePointer2 },
      { type:'divider',label:'Divider', icon: Square }
    ] 
  },
  { 
    section: 'CONTENT', 
    icon: Type,
    items: [
      { type:'heading',label:'Heading', icon: Type },
      { type:'paragraph',label:'Text', icon: Type },
      { type:'image',label:'Image', icon: ImageIcon },
      { type:'badge',label:'Badge', icon: Box },
      { type:'alert',label:'Alert', icon: Box }
    ] 
  },
  { 
    section: 'FORM', 
    icon: FormInput,
    items: [
      { type:'button',label:'Button', icon: FormInput },
      { type:'input',label:'Input', icon: FormInput },
      { type:'textarea',label:'Textarea', icon: FormInput },
      { type:'select',label:'Select', icon: FormInput }
    ] 
  },
]

export const UIBuilderCanvas: React.FC = () => {
  const { uiComponents, setUIComponents } = useLayoutStore()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [paletteOpen, setPaletteOpen] = useState(true)
  const [inspectorOpen, setInspectorOpen] = useState(true)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const invoke = useIpcError()
  const addToast = useToastStore(s => s.addToast)

  const selectedComponent = uiComponents.find(c => c.id === selectedId)

  // AC-4: Report iframe bounds to main process
  useEffect(() => {
    const report = () => {
      if (!iframeRef.current) return
      const rect = iframeRef.current.getBoundingClientRect()
      window.ipcRenderer.send('canvas:iframe-bounds', {
        x: Math.round(rect.x), y: Math.round(rect.y),
        width: Math.round(rect.width), height: Math.round(rect.height),
      })
    }
    report()
    window.addEventListener('resize', report)
    // Also report when palette or inspector toggles
    const timeout = setTimeout(report, 250) 
    return () => {
      window.removeEventListener('resize', report)
      clearTimeout(timeout)
    }
  }, [paletteOpen, inspectorOpen])

  // Update preview iframe
  useEffect(() => {
    if (!iframeRef.current) return
    const doc = iframeRef.current.contentDocument || iframeRef.current.contentWindow?.document
    if (!doc) return

    const html = renderComponentTree(uiComponents)
    doc.open()
    doc.write(html)
    doc.close()
  }, [uiComponents])

  const addComponent = (type: UIComponentType, x: number, y: number) => {
    const id = `ui-${type}-${Date.now()}`
    const newComp: UIComponent = {
      id,
      type,
      label: type.toUpperCase(),
      props: {
        text: type === 'button' || type === 'heading' || type === 'paragraph' || type === 'label' || type === 'badge' || type === 'alert' ? type.toUpperCase() : undefined,
        placeholder: type === 'input' || type === 'textarea' ? 'Placeholder...' : undefined,
        padding: 'p-4',
        extraClasses: ''
      },
      children: [],
      x, y,
      w: type === 'container' || type === 'card' || type === 'column' ? 300 : 200,
      h: type === 'container' || type === 'card' ? 200 : 60
    }
    setUIComponents([...uiComponents, newComp])
    setSelectedId(id)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const type = e.dataTransfer.getData('componentType') as UIComponentType
    if (!type || !containerRef.current) return

    const rect = containerRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    addComponent(type, x, y)
  }

  const updateComponent = (id: string, patch: Partial<UIComponent>) => {
    setUIComponents(uiComponents.map(c => c.id === id ? { ...c, ...patch } : c))
  }

  const deleteComponent = (id: string) => {
    setUIComponents(uiComponents.filter(c => c.id !== id))
    if (selectedId === id) setSelectedId(null)
  }

  const handleExportJSX = async () => {
    const jsx = exportToJSX(uiComponents)
    try {
      const rootPath = await invoke<string>('app:get-root-path')
      const srcDir = `${rootPath}/src`
      
      // Basic check if src exists, if not use root
      const filePath = `${srcDir}/GeneratedUI.tsx`
      await invoke('fs:save-file', { filePath, content: jsx })
      addToast(`Exported to ${filePath}`, 'success')
    } catch (e: any) {
      addToast(`Export failed: ${e.message}`, 'error')
    }
  }

  const handleExportHTML = async () => {
    const html = renderComponentTree(uiComponents)
    try {
      const rootPath = await invoke<string>('app:get-root-path')
      const filePath = `${rootPath}/preview.html`
      await invoke('fs:save-file', { filePath, content: html })
      addToast(`Exported to ${filePath}`, 'success')
    } catch (e: any) {
      addToast(`Export failed: ${e.message}`, 'error')
    }
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-[#050505] overflow-hidden" ref={containerRef}>
      {/* Toolbar */}
      <div className="h-8 flex items-center gap-2 px-3 border-b border-zinc-800 bg-[#0A0A0A] select-none">
        <div className="flex items-center gap-1 border-r border-zinc-800 pr-2 mr-1">
          <button 
            onClick={handleExportJSX}
            className="p-1.5 text-zinc-500 hover:text-copernicus-phosphor transition-colors rounded hover:bg-zinc-900"
            title="Export JSX"
          >
            <Code size={14} />
          </button>
          <button
            onClick={handleExportHTML}
            className="p-1.5 text-zinc-500 hover:text-copernicus-phosphor transition-colors rounded hover:bg-zinc-900"
            title="Export HTML"
          >
            <Download size={14} />
          </button>
        </div>
        
        <button 
          onClick={() => setUIComponents([])}
          className="p-1.5 text-zinc-500 hover:text-red-400 transition-colors rounded hover:bg-zinc-900"
          title="Clear Canvas"
        >
          <Trash2 size={14} />
        </button>

        <div className="flex-1" />
        
        <div className="flex items-center gap-3">
          <span className="text-[9px] text-zinc-600 font-mono uppercase tracking-widest">
            {uiComponents.length} components
          </span>
          <div className="flex bg-zinc-900 rounded p-0.5 border border-zinc-800">
            <button 
              onClick={() => setPaletteOpen(!paletteOpen)}
              className={`px-2 py-0.5 text-[8px] font-bold rounded uppercase ${paletteOpen ? 'bg-zinc-800 text-copernicus-phosphor' : 'text-zinc-600'}`}
            >
              Palette
            </button>
            <button 
              onClick={() => setInspectorOpen(!inspectorOpen)}
              className={`px-2 py-0.5 text-[8px] font-bold rounded uppercase ${inspectorOpen ? 'bg-zinc-800 text-copernicus-phosphor' : 'text-zinc-600'}`}
            >
              Inspector
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden relative">
        {/* Palette */}
        {paletteOpen && (
          <div className="w-44 border-r border-zinc-800 bg-[#080808] flex flex-col overflow-y-auto no-scrollbar animate-in slide-in-from-left duration-200">
            {PALETTE.map(sec => (
              <div key={sec.section} className="p-3 border-b border-zinc-900">
                <div className="flex items-center gap-2 mb-3 text-zinc-600">
                  <sec.icon size={10} />
                  <h4 className="text-[9px] font-bold uppercase tracking-[0.2em]">{sec.section}</h4>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {sec.items.map(item => (
                    <div
                      key={item.type}
                      draggable
                      onDragStart={(e) => e.dataTransfer.setData('componentType', item.type)}
                      className="flex flex-col items-center gap-1.5 p-2 bg-zinc-900/50 border border-zinc-800 rounded-lg cursor-grab hover:border-copernicus-phosphor hover:bg-zinc-900 transition-all group"
                    >
                      <item.icon size={14} className="text-zinc-500 group-hover:text-copernicus-phosphor" />
                      <span className="text-[8px] font-bold text-zinc-400 group-hover:text-zinc-200 uppercase tracking-tighter text-center leading-none">
                        {item.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Canvas Area */}
        <div 
          className="flex-1 relative bg-black overflow-hidden"
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => setSelectedId(null)}
        >
          {/* Transparent interaction overlay */}
          <div className="absolute inset-0 z-10 pointer-events-none">
            {uiComponents.map(comp => (
              <Rnd
                key={comp.id}
                position={{ x: comp.x ?? 0, y: comp.y ?? 0 }}
                size={{ width: comp.w ?? 200, height: comp.h ?? 60 }}
                onDragStop={(_e, d) => updateComponent(comp.id, { x: d.x, y: d.y })}
                onResizeStop={(_e, _dir, ref, _delta, pos) => updateComponent(
                  comp.id, { w: ref.offsetWidth, h: ref.offsetHeight, x: pos.x, y: pos.y }
                )}
                onClick={(e: React.MouseEvent) => {
                  e.stopPropagation()
                  setSelectedId(comp.id)
                }}
                enableResizing={{
                  bottomRight: true,
                  bottom: true,
                  right: true
                }}
                className={`pointer-events-auto border-2 transition-colors ${selectedId === comp.id ? 'border-copernicus-phosphor/60' : 'border-transparent hover:border-zinc-700'}`}
                style={{ zIndex: selectedId === comp.id ? 20 : 10 }}
              />
            ))}
          </div>

          <iframe 
            ref={iframeRef}
            className="w-full h-full border-none pointer-events-none"
            title="UI Preview"
          />
        </div>

        {/* Inspector */}
        {inspectorOpen && selectedComponent && (
          <div className="w-72 border-l border-zinc-800 bg-[#080808] flex flex-col overflow-y-auto no-scrollbar animate-in slide-in-from-right duration-200">
            <UIComponentInspector 
              component={selectedComponent}
              onChange={(updated) => updateComponent(selectedComponent.id, updated)}
              onDelete={() => deleteComponent(selectedComponent.id)}
            />
          </div>
        )}
      </div>
    </div>
  )
}

function exportToJSX(components: UIComponent[]): string {
  const componentToJSX = (comp: UIComponent, indent = 4): string => {
    const pad = ' '.repeat(indent)
    const { type, props, children } = comp
    
    const commonProps = `className="${props.extraClasses || ''} ${props.padding || ''} ${props.color || ''} ${props.bgColor || ''} ${props.borderColor || ''} ${props.rounded ? 'rounded-lg' : ''} ${props.shadow ? 'shadow-lg' : ''}"`
    
    const childrenJsx = children.map(c => componentToJSX(c, indent + 2)).join('\n')

    switch (type) {
      case 'container': return `${pad}<div ${commonProps} style={{position: 'relative'}}>\n${childrenJsx}\n${pad}</div>`
      case 'row': return `${pad}<div ${commonProps} className={\`${commonProps} flex flex-row ${props.gap || 'gap-2'}\`}>\n${childrenJsx}\n${pad}</div>`
      case 'column': return `${pad}<div ${commonProps} className={\`${commonProps} flex flex-col ${props.gap || 'gap-2'}\`}>\n${childrenJsx}\n${pad}</div>`
      case 'heading': return `${pad}<h2 ${commonProps}>${props.text || 'Heading'}</h2>`
      case 'paragraph': return `${pad}<p ${commonProps}>${props.text || ''}</p>`
      case 'button': return `${pad}<button ${commonProps}>${props.text || 'Button'}</button>`
      case 'input': return `${pad}<input type="text" placeholder="${props.placeholder || ''}" ${commonProps} />`
      case 'card': return `${pad}<div ${commonProps} className={\`${commonProps} bg-zinc-900 border border-zinc-800\`}>\n${childrenJsx}\n${pad}</div>`
      default: return `${pad}<div ${commonProps}>${type}</div>`
    }
  }

  return `import React from 'react'

export default function GeneratedUI() {
  return (
    <div className="relative min-h-screen bg-[#050505]">
${components.map(c => componentToJSX(c, 6)).join('\n')}
    </div>
  )
}
`
}
