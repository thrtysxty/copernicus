import React, { useEffect, useState } from 'react'
import { ChevronRight, ChevronDown, Link as LinkIcon, FileText, Wand2 } from 'lucide-react'
import { useIpcError } from '../../hooks/useIpcError'
import { unwrapIpc } from '../../types/ipc'

interface NotebookSource {
  id: string
  title: string
  type: string
}

interface StudioArtifact {
  id: string
  title: string
  type: string
}

interface NbLmContents {
  sources: NotebookSource[]
  studio: StudioArtifact[]
}

interface NbLmTreeViewProps {
  notebookId: string
}

export const NbLmTreeView: React.FC<NbLmTreeViewProps> = ({ notebookId }) => {
  const invoke = useIpcError()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [contents, setContents] = useState<NbLmContents>({ sources: [], studio: [] })

  const [sourcesOpen, setSourcesOpen] = useState(true)
  const [studioOpen, setStudioOpen] = useState(true)
  const [notesOpen, setNotesOpen] = useState(true)

  useEffect(() => {
    let active = true
    const loadContents = async () => {
      setLoading(true)
      setError(false)
      try {
        const res = await invoke<NbLmContents>('notebooklm:notebook-contents', notebookId)
        if (active) {
          const data = unwrapIpc<NbLmContents>(res)
          if (data) {
            setContents({
              sources: data.sources || [],
              studio: data.studio || []
            })
          } else {
            setError(true)
          }
          setLoading(false)
        }
      } catch (err) {
        if (active) {
          console.error(err)
          setError(true)
          setLoading(false)
        }
      }
    }

    if (notebookId) {
      loadContents()
    }

    return () => { active = false }
  }, [notebookId, invoke])

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  const openExternal = async (url: string) => {
    await invoke('app:open-external', url)
  }

  if (loading) {
    return <div className="text-zinc-600 text-[10px] p-2 italic">Loading...</div>
  }

  if (error) {
    return <div className="text-red-400 text-[10px] p-2">Failed to load</div>
  }

  const SectionHeader = ({ title, isOpen, onToggle }: { title: string, isOpen: boolean, onToggle: () => void }) => (
    <div
      className="flex items-center gap-1 px-1 py-[4px] cursor-pointer hover:bg-copernicus-phosphor/10 rounded text-[11px] select-none text-zinc-300 font-semibold"
      onClick={onToggle}
    >
      {isOpen ? <ChevronDown size={14} className="text-zinc-500" /> : <ChevronRight size={14} className="text-zinc-500" />}
      {title}
    </div>
  )

  return (
    <div className="flex flex-col h-full w-full py-1">
      {/* Sources Section */}
      <div>
        <SectionHeader title="Sources" isOpen={sourcesOpen} onToggle={() => setSourcesOpen(!sourcesOpen)} />
        {sourcesOpen && (
          <div className="ml-4">
            {contents.sources.length === 0 ? (
              <div className="text-zinc-600 text-[10px] italic px-1 py-[2px]">None</div>
            ) : (
              contents.sources.map(src => (
                <div
                  key={src.id}
                  className="flex items-center gap-1 px-1 py-[2px] cursor-pointer hover:bg-copernicus-phosphor/10 rounded text-[11px] select-none text-zinc-400 group"
                  onClick={() => copyToClipboard(src.title)}
                  title="Click to copy title"
                >
                  <div className="w-[14px]">
                     {src.type === 'url' ? <LinkIcon size={12} className="text-zinc-500" /> : <FileText size={12} className="text-zinc-500" />}
                  </div>
                  <span className="truncate group-hover:text-zinc-300">{src.title}</span>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Studio Section */}
      <div className="mt-2">
        <SectionHeader title="Studio" isOpen={studioOpen} onToggle={() => setStudioOpen(!studioOpen)} />
        {studioOpen && (
          <div className="ml-4">
            {contents.studio.length === 0 ? (
              <div className="text-zinc-600 text-[10px] italic px-1 py-[2px]">None</div>
            ) : (
              contents.studio.map(art => (
                <div
                  key={art.id}
                  className="flex items-center gap-1 px-1 py-[2px] cursor-pointer hover:bg-copernicus-phosphor/10 rounded text-[11px] select-none text-zinc-400 group"
                  onClick={() => copyToClipboard(art.title)}
                  title="Click to copy title"
                >
                  <div className="w-[14px]">
                    <Wand2 size={12} className="text-zinc-500" />
                  </div>
                  <span className="truncate group-hover:text-zinc-300">{art.title}</span>
                  <span className="text-[9px] bg-white/10 px-1 rounded ml-1 uppercase text-zinc-500">{art.type}</span>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Notes Section */}
      <div className="mt-2">
        <SectionHeader title="Notes" isOpen={notesOpen} onToggle={() => setNotesOpen(!notesOpen)} />
        {notesOpen && (
          <div className="ml-4 flex flex-col gap-1 px-1 py-[2px]">
            <div className="text-zinc-600 text-[10px] italic">Notes not available via API</div>
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault()
                openExternal('https://notebooklm.google.com')
              }}
              className="text-copernicus-phosphor hover:underline text-[10px] inline-block"
            >
              Open in NotebookLM ↗
            </a>
          </div>
        )}
      </div>

    </div>
  )
}
