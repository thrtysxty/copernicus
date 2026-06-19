import React, { useState, useRef } from 'react'
import { useUIBuilderStore } from '../../../store/uiBuilderStore'
import { useWorkspaceStore } from '../../../store/layout'
import { UIComponent, UIComponentType } from './types'
import { renderComponentTree } from './render'
import { unwrapIpc } from '../../../types/ipc'
import { UIComponentInspector } from './UIComponentInspector'
import { StitchVariantPanel } from './StitchVariantPanel'
import { Rnd } from 'react-rnd'
import {
  Layout, GripVertical,
  MousePointer2, Square, Type,
  FormInput, Layers, Box
} from 'lucide-react'
import { useIpcError } from '../../../hooks/useIpcError'
import { useToastStore } from '../../../store/toastStore'
import { TILE_MAP } from './tile-renders'
import { commandRegistry } from '../../../store/commandRegistry'

const renderPreview = (comp: UIComponent) => {
  const Tile = TILE_MAP[comp.type]
  return Tile ? <Tile props={comp.props} /> : null
}

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
      { type:'image',label:'Image', icon: Square },
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
  const { 
    uiComponents, setUIComponents, 
    paletteOpen, inspectorOpen
  } = useUIBuilderStore()
  const {
    stitchImportOpen, setStitchImportOpen,
    stitchVerifyOpen, setStitchVerifyOpen,
    setStitchTokens,
    activeFilePath,
    stitchScreenId,
    setStitchScreenId
  } = useWorkspaceStore()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [inspectorCollapsed, setInspectorCollapsed] = useState(false)

  const containerRef = useRef<HTMLDivElement>(null)
  const invoke = useIpcError()
  const addToast = useToastStore(s => s.addToast)
  const [stitchGhostHtml, setStitchGhostHtml] = useState<string | null>(null)
  const [stitchGhostCss, setStitchGhostCss] = useState<string | null>(null)

  const [stitchAvailable, setStitchAvailable] = useState(false)
  const [projectId, setProjectId] = useState<string | null>(null)
  const [deviceType, setDeviceType] = useState<'MOBILE' | 'DESKTOP' | 'TABLET' | 'AGNOSTIC'>('AGNOSTIC')
  const [isGenerating, setIsGenerating] = useState(false)
  const [showVariantsPanel, setShowVariantsPanel] = useState(false)
  const [editPrompt, setEditPrompt] = useState('')

  const selectedComponent = uiComponents.find(c => c.id === selectedId)

  const handleStitchEdit = async () => {
    if (!editPrompt.trim() || !projectId || !stitchScreenId) return
    setIsGenerating(true)
    try {
      const data = unwrapIpc<{ screenId: string }>(await invoke('stitch:edit', { projectId, screenId: stitchScreenId, prompt: editPrompt }))
      if (data?.screenId) {
        setStitchScreenId(data.screenId)
        addToast('Screen updated successfully', 'success')
        setEditPrompt('')

        // Fetch new html
        const htmlData = unwrapIpc<{ html: string, css: string }>(await invoke('stitch:extract-design', { projectId, screenId: data.screenId }))
        if (htmlData) {
          setStitchGhostHtml(htmlData.html)
          setStitchGhostCss(htmlData.css)
        }
      }
    } catch (e: unknown) {
      // useIpcError handles the toast
    } finally {
      setIsGenerating(false)
    }
  }

  React.useEffect(() => {
    async function initStitch() {
      try {
        const authData = unwrapIpc<{ status: { provider: string; hasKey: boolean }[] }>(await invoke('auth:status'))
        if (authData?.status) {
          const stitchAuth = authData.status.find((s) => s.provider === 'stitch')
          if (stitchAuth?.hasKey) {
            setStitchAvailable(true)
          }
        }

        const configData = unwrapIpc<{ projectId: string; deviceType?: string }>(await invoke('project:get-config'))
        if (configData) {
          setProjectId(configData.projectId)
          if (configData.deviceType) {
            setDeviceType(configData.deviceType as 'MOBILE' | 'DESKTOP' | 'TABLET' | 'AGNOSTIC')
          }
        }
      } catch (err) {
        // Suppress errors during mount detection
      }
    }
    initStitch()
  }, [])





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
      const rootDir = unwrapIpc<string>(await invoke('app:get-root-path')) ?? ''
      const srcDir = `${rootDir}/src`

      const filePath = `${srcDir}/GeneratedUI.tsx`
      unwrapIpc(await invoke('fs:save-file', { filePath, content: jsx }))
      addToast(`Exported to ${filePath}`, 'success')
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      addToast(`Export failed: ${message}`, 'error')
    }
  }

  const handleExportHTML = async () => {
    let html = renderComponentTree(uiComponents)
    try {
      if (stitchAvailable && stitchScreenId && projectId) {
        const htmlResult = await invoke<{ html: string, css: string }>('stitch:extract-design', { projectId, screenId: stitchScreenId })
        const htmlData = unwrapIpc<{ html: string, css: string }>(htmlResult)
        if (htmlData) {
          html = `<!DOCTYPE html>\n<html>\n<head>\n<style>\n${htmlData.css}\n</style>\n</head>\n<body>\n${htmlData.html}\n</body>\n</html>`
        }
      }

      const rootDir = unwrapIpc<string>(await invoke('app:get-root-path')) ?? ''
      const filePath2 = `${rootDir}/preview.html`

      unwrapIpc(await invoke('fs:save-file', { filePath: filePath2, content: html }))

      addToast(`Exported to ${filePath2}`, 'success')
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      addToast(`Export failed: ${message}`, 'error')
    }
  }

  // Expose these to satisfy React warnings if needed, though they were handled in headers
  window._ui_export_jsx = handleExportJSX
  window._ui_export_html = handleExportHTML

  const StitchImportModal = () => {
    const [projectId, setProjectId] = useState('')
    const [screenId, setScreenId] = useState('')

    const handleImport = async () => {
      if (!projectId || !screenId) {
        addToast('Please enter both Project ID and Screen ID', 'error')
        return
      }
      try {
        const { html, css } = await invoke<{ html: string, css: string }>('stitch:extract-design', { projectId, screenId })
        const { fonts, colors, spacing } = await invoke<{ fonts: string[], colors: string[], spacing: string[] }>('stitch:design-dna', { projectId })
        setStitchTokens({ fonts, colors, spacing })
        setStitchGhostHtml(html)
        setStitchGhostCss(css)
        addToast('Stitch design imported as ghost suggestion!', 'success')
        setStitchImportOpen(false)
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e)
        addToast(`Stitch import failed: ${message}`, 'error')
      }
    }

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in">
        <div className="bg-zinc-900 p-6 rounded-lg shadow-xl border border-zinc-800 w-96">
          <h3 className="text-lg font-bold text-white mb-4">Import from Stitch</h3>
          <div className="space-y-3 mb-6">
            <div>
              <label htmlFor="projectIdImport" className="block text-sm font-medium text-zinc-400 mb-1">Project ID</label>
              <input
                id="projectIdImport"
                type="text"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-white focus:ring-copernicus-phosphor focus:border-copernicus-phosphor"
                placeholder="Enter Project ID"
              />
            </div>
            <div>
              <label htmlFor="screenIdImport" className="block text-sm font-medium text-zinc-400 mb-1">Screen ID</label>
              <input
                id="screenIdImport"
                type="text"
                value={screenId}
                onChange={(e) => setScreenId(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-white focus:ring-copernicus-phosphor focus:border-copernicus-phosphor"
                placeholder="Enter Screen ID"
              />
            </div>
          </div>
          <div className="flex justify-end space-x-3">
            <button
              onClick={() => setStitchImportOpen(false)}
              className="px-4 py-2 text-sm font-medium text-zinc-300 bg-zinc-700 rounded-md hover:bg-zinc-600 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleImport}
              className="px-4 py-2 text-sm font-medium text-black bg-copernicus-phosphor rounded-md hover:bg-copernicus-phosphor/80 transition-colors"
            >
              Import
            </button>
          </div>
        </div>
      </div>
    )
  }

  const StitchVerifyModal = () => {
    const [projectId, setProjectId] = useState('')
    const [screenId, setScreenId] = useState('')

    const handleVerify = async () => {
      if (!projectId || !screenId) {
        addToast('Please enter both Project ID and Screen ID', 'error')
        return
      }
      if (!activeFilePath) {
        addToast('No active file to verify', 'error')
        return
      }

      try {
        const fileContent = await invoke<string>('fs:read-file', activeFilePath)
        const { specHtml, specCss, screenshot } = await invoke<{ specHtml: string, specCss: string, screenshot: string }>('stitch:verify-ui', { projectId, screenId, currentHtml: fileContent })

        const precomposedMessage = `Verify my implementation against the Stitch design spec for screen ${screenId}.

**Stitch design spec (HTML/CSS):**
\`\`\`html
${specHtml}
\`\`\`
\`\`\`css
${specCss}
\`\`\`

**My current implementation:**
\`\`\`html
${fileContent}
\`\`\`

Identify visual discrepancies, missing tokens, and suggest the minimum changes needed to match the spec.`

        const activeModel = await invoke<{ id: string }>('models:active')
        await invoke('chat:send', { sessionId: 'stitch-verify-' + Date.now(), messages: [{ role: 'user', content: precomposedMessage, imageBase64: screenshot, imageMimeType: 'image/png' }], model: activeModel?.id ?? '' })
        addToast('Stitch verification initiated!', 'success')
        setStitchVerifyOpen(false)
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e)
        addToast(`Stitch verification failed: ${message}`, 'error')
      }
    }

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in">
        <div className="bg-zinc-900 p-6 rounded-lg shadow-xl border border-zinc-800 w-96">
          <h3 className="text-lg font-bold text-white mb-4">Verify with Stitch</h3>
          <div className="space-y-3 mb-6">
            <div>
              <label htmlFor="projectIdVerify" className="block text-sm font-medium text-zinc-400 mb-1">Project ID</label>
              <input
                id="projectIdVerify"
                type="text"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-white focus:ring-copernicus-phosphor focus:border-copernicus-phosphor"
                placeholder="Enter Project ID"
              />
            </div>
            <div>
              <label htmlFor="screenIdVerify" className="block text-sm font-medium text-zinc-400 mb-1">Screen ID</label>
              <input
                id="screenIdVerify"
                type="text"
                value={screenId}
                onChange={(e) => setScreenId(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-white focus:ring-copernicus-phosphor focus:border-copernicus-phosphor"
                placeholder="Enter Screen ID"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">Current File</label>
              <input
                type="text"
                readOnly
                value={activeFilePath || 'No file open'}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-zinc-500"
              />
            </div>
          </div>
          <div className="flex justify-end space-x-3">
            <button
              onClick={() => setStitchVerifyOpen(false)}
              className="px-4 py-2 text-sm font-medium text-zinc-300 bg-zinc-700 rounded-md hover:bg-zinc-600 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleVerify}
              className="px-4 py-2 text-sm font-medium text-black bg-copernicus-phosphor rounded-md hover:bg-copernicus-phosphor/80 transition-colors"
            >
              Verify
            </button>
          </div>
        </div>
      </div>
    )
  }



  return (
    <div className="flex-1 flex flex-col h-full bg-[#050505] overflow-hidden" ref={containerRef}>
      {/* Stitch Toolbar */}
      {stitchAvailable && (
        <div className="h-12 border-b border-zinc-800 bg-[#080808] flex items-center px-4 justify-between shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (!projectId) return
                const canvasContext = uiComponents.length > 0
                  ? `${uiComponents.length} component(s): ${uiComponents.map(c => c.type).join(', ')}`
                  : 'Empty canvas'
                const seededPrompt = `Generate UI. Canvas: ${canvasContext}. Device: ${deviceType}.`
                commandRegistry.unregisterCommand('stitch-generate')
                commandRegistry.registerCommand({
                  id: 'stitch-generate',
                  label: `Stitch: Generate — ${canvasContext}`,
                  action: () => {
                    setIsGenerating(true)
                    invoke('stitch:generate', { projectId, prompt: seededPrompt, deviceType })
                      .then(async (result) => {
                        const data = unwrapIpc<{ screenId: string }>(result)
                        if (data?.screenId) {
                          setStitchScreenId(data.screenId)
                          addToast('Screen generated successfully', 'success')
                          const htmlData = unwrapIpc<{ html: string, css: string }>(
                            await invoke('stitch:extract-design', { projectId, screenId: data.screenId })
                          )
                          if (htmlData) {
                            setStitchGhostHtml(htmlData.html)
                            setStitchGhostCss(htmlData.css)
                          }
                        }
                      })
                      .catch(() => {})
                      .finally(() => setIsGenerating(false))
                  }
                })
                window.ipcRenderer.send('layout:open-palette')
              }}
              disabled={isGenerating}
              className="px-3 py-1.5 text-xs font-medium text-black bg-copernicus-phosphor hover:bg-copernicus-phosphor/80 rounded disabled:opacity-50"
            >
              {isGenerating ? 'Generating...' : 'Generate with Stitch'}
            </button>
            {stitchScreenId && (
              <button
                onClick={() => setShowVariantsPanel(!showVariantsPanel)}
                disabled={isGenerating}
                className="px-3 py-1.5 text-xs font-medium text-zinc-300 bg-zinc-800 hover:bg-zinc-700 rounded border border-zinc-700 disabled:opacity-50"
              >
                Variants
              </button>
            )}
            {stitchScreenId && (
              <button
                onClick={() => {
                  setStitchScreenId(null)
                  setStitchGhostHtml(null)
                  setStitchGhostCss(null)
                }}
                disabled={isGenerating}
                className="px-3 py-1.5 text-xs font-medium text-zinc-300 hover:text-white"
              >
                Clear Screen
              </button>
            )}
          </div>
          {stitchScreenId && (
            <div className="text-xs text-zinc-500 font-mono">
              Screen ID: {stitchScreenId}
            </div>
          )}
        </div>
      )}

      <div className="flex-1 flex overflow-hidden relative">
        {showVariantsPanel && stitchAvailable && stitchScreenId && projectId && (
          <StitchVariantPanel
            projectId={projectId}
            baseScreenId={stitchScreenId}
            onClose={() => setShowVariantsPanel(false)}
            onSelectVariant={async (newScreenId) => {
              setStitchScreenId(newScreenId)
              setShowVariantsPanel(false)
              addToast('Variant applied', 'success')

              // Fetch new html for the selected variant
              try {
                const htmlData = unwrapIpc<{ html: string, css: string }>(
                  await invoke('stitch:extract-design', { projectId, screenId: newScreenId })
                )
                if (htmlData) {
                  setStitchGhostHtml(htmlData.html)
                  setStitchGhostCss(htmlData.css)
                }
              } catch (e) {
                // ignore
              }
            }}
          />
        )}

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
                className={`pointer-events-auto border-2 transition-colors ${
                  selectedId === comp.id
                    ? 'border-solid border-copernicus-phosphor/60 bg-indigo-500/5'
                    : 'border-dashed border-zinc-400/30 hover:border-zinc-400/60'
                }`}
                style={{ zIndex: selectedId === comp.id ? 20 : 10 }}
              >
                <div className="absolute top-0 left-0 z-30 pointer-events-none">
                  <span className="text-[9px] font-mono text-zinc-500 bg-[#0a0a0a]/80 px-1 py-0.5 rounded-br uppercase tracking-wider leading-none">
                    {comp.type}
                  </span>
                </div>
                <div className="w-full h-full relative pointer-events-none select-none">
                  {renderPreview(comp)}
                </div>
              </Rnd>
            ))}
          </div>


        </div>

        {/* Inspector */}
        {inspectorOpen && selectedComponent && (
          <div className={`border-l border-zinc-800 bg-[#080808] flex flex-col overflow-y-auto no-scrollbar animate-in slide-in-from-right duration-200 transition-all duration-200 ${inspectorCollapsed ? 'w-9' : 'w-72'}`}>
            <UIComponentInspector 
              component={selectedComponent}
              onChange={(updated) => updateComponent(selectedComponent.id, updated)}
              onDelete={() => deleteComponent(selectedComponent.id)}
              collapsed={inspectorCollapsed}
              setCollapsed={setInspectorCollapsed}
            />
          </div>
        )}
      </div>

      {/* Edit Prompt Bar */}
      {stitchAvailable && stitchScreenId && (
        <div className="h-12 border-t border-zinc-800 bg-[#080808] shrink-0 flex items-center px-4 relative z-20">
          <input
            type="text"
            value={editPrompt}
            onChange={(e) => setEditPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleStitchEdit()
            }}
            disabled={isGenerating}
            placeholder="Type a refinement and press Enter to edit the screen..."
            className="w-full bg-zinc-900 border border-zinc-700 text-sm text-white rounded px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-copernicus-phosphor disabled:opacity-50"
          />
        </div>
      )}

      {/* Stitch Active IFrame Overlay */}
      {stitchScreenId && stitchGhostHtml && (
        <div className="absolute inset-0 z-40 bg-white">
          <iframe
            title={`Stitch Screen ${stitchScreenId}`}
            className="w-full h-full border-none"
            srcDoc={`<!DOCTYPE html><html><head><style>${stitchGhostCss || ''}</style></head><body>${stitchGhostHtml}</body></html>`}
          />
        </div>
      )}

      {/* Modals */}
      {stitchImportOpen && <StitchImportModal />}
      {stitchVerifyOpen && <StitchVerifyModal />}
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
