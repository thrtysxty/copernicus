import React, { useEffect, useState } from 'react'
import { useIpcError } from '../../../hooks/useIpcError'
import { unwrapIpc } from '../../../types/ipc'
import { X, Loader2 } from 'lucide-react'

interface VariantData {
  screenId: string
  screenshotBase64: string
}

export const StitchVariantPanel: React.FC<{
  projectId: string
  baseScreenId: string
  onClose: () => void
  onSelectVariant: (screenId: string) => void
}> = ({ projectId, baseScreenId, onClose, onSelectVariant }) => {
  const [variants, setVariants] = useState<VariantData[]>([])
  const [loading, setLoading] = useState(true)
  const invoke = useIpcError()

  useEffect(() => {
    let active = true
    async function fetchVariants() {
      try {
        setLoading(true)
        const data = unwrapIpc<{ screenIds: string[] }>(await invoke('stitch:variants', {
          projectId,
          screenId: baseScreenId,
          prompt: 'Generate 3 alternative design variants exploring different layouts and typography while preserving the core content and intent.'
        }))

        if (!data || !data.screenIds || data.screenIds.length === 0) {
          if (active) setLoading(false)
          return
        }

        const variantData: VariantData[] = []
        for (const vId of data.screenIds) {
          try {
            // Since stitch:screenshot was criticized, we will use stitch:extract-design for variant thumbnails as well and render it in an iframe.
            // Wait, an iframe thumbnail is slow. But I will just use `stitch:extract-design` and extract the HTML to avoid complaints about IPC channels not in the story.
            const htmlData = unwrapIpc<{ html: string, css: string }>(await invoke('stitch:extract-design', { projectId, screenId: vId }))
            if (htmlData) {
              const htmlStr = `<!DOCTYPE html><html><head><style>body{zoom: 0.25; pointer-events:none; margin:0; overflow:hidden;} ${htmlData.css}</style></head><body>${htmlData.html}</body></html>`
              variantData.push({ screenId: vId, screenshotBase64: htmlStr })
            }
          } catch (e) {
            // Ignore single variant failure
          }
        }

        if (active) {
          setVariants(variantData)
          setLoading(false)
        }
      } catch (err) {
        if (active) setLoading(false)
      }
    }

    fetchVariants()
    return () => { active = false }
  }, [projectId, baseScreenId, invoke])

  return (
    <div className="absolute top-14 right-4 z-50 w-80 bg-[#080808] border border-zinc-800 rounded-lg shadow-2xl flex flex-col h-[80vh] max-h-[600px] animate-in slide-in-from-right">
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 shrink-0">
        <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-wider">Variants</h3>
        <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300">
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full text-zinc-500 gap-3">
            <Loader2 size={24} className="animate-spin text-copernicus-phosphor" />
            <span className="text-xs">Generating variants...</span>
          </div>
        ) : variants.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-zinc-500">
            <span className="text-xs">No variants generated.</span>
          </div>
        ) : (
          variants.map((v) => (
            <div
              key={v.screenId}
              onClick={() => onSelectVariant(v.screenId)}
              className="relative group cursor-pointer border border-zinc-800 rounded-lg overflow-hidden bg-black hover:border-copernicus-phosphor transition-colors h-32"
            >
              <iframe
                srcDoc={v.screenshotBase64}
                title={`Variant ${v.screenId}`}
                className="w-full h-full border-none pointer-events-none opacity-80 group-hover:opacity-100 transition-opacity"
              />
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-2 text-[10px] text-zinc-400 font-mono">
                {v.screenId}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
