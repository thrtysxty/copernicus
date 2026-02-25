import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'

const ipcRenderer = (window as any).ipcRenderer

interface Story {
  id: string
  title: string
  status: string
  path: string
}

const COLUMNS = [
  { id: 'Blueprint', title: 'Blueprint', status: 'READY', color: 'bg-blue-900/10 border-blue-900/30' },
  { id: 'Engine Room', title: 'Engine Room', status: 'IN PROGRESS', color: 'bg-yellow-900/10 border-yellow-900/30' },
  { id: 'Test Bench', title: 'Test Bench', status: 'TESTING', color: 'bg-orange-900/10 border-orange-900/30' },
  { id: 'QA / Review', title: 'QA / Review', status: 'REVIEW', color: 'bg-purple-900/10 border-purple-900/30' },
  { id: 'Documenting', title: 'Documenting', status: 'DOCUMENTING', color: 'bg-cyan-900/10 border-cyan-900/30' },
  { id: 'Done', title: 'Done', status: 'COMPLETE', color: 'bg-green-900/10 border-green-900/30' },
]

export function KanbanBoard() {
  const [stories, setStories] = useState<Story[]>([])

  useEffect(() => {
    const fetchStories = async () => {
       try {
         const result = await ipcRenderer.invoke('stories:list')
         setStories(result)
       } catch (e) {
         console.warn("Failed to fetch stories", e)
         setStories([
           { id: 'STORY-001', title: 'Implement Login', status: 'READY', path: '' },
           { id: 'STORY-002', title: 'Database Migration', status: 'IN PROGRESS', path: '' },
           { id: 'STORY-003', title: 'Unit Tests', status: 'TESTING', path: '' },
         ])
       }
    }
    fetchStories()
    
    const removeListener = ipcRenderer.on('stories:updated', (_event: any, newStories: Story[]) => {
      setStories(newStories)
    })
    return () => removeListener()
  }, [])

  const handleDragStart = (e: any, id: string) => {
    e.dataTransfer.setData('text/plain', id)
  }

  const handleDrop = async (e: React.DragEvent, targetStatus: string) => {
    e.preventDefault()
    const id = e.dataTransfer.getData('text/plain')
    
    // Optimistic update
    setStories(prev => prev.map(s => s.id === id ? { ...s, status: targetStatus } : s))
    
    try {
      await ipcRenderer.invoke('stories:update', id, targetStatus)
    } catch (e) {
      console.error("Failed to update story status", e)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  return (
    <div className="flex h-full w-full overflow-x-auto gap-2 p-2 bg-copernicus-bg select-none">
      {COLUMNS.map(col => (
        <div 
          key={col.id} 
          className={`min-w-[200px] w-64 h-full flex flex-col rounded border ${col.color} transition-colors hover:bg-opacity-20`}
          onDrop={(e) => handleDrop(e, col.status)}
          onDragOver={handleDragOver}
        >
          <div className="h-8 flex items-center justify-center border-b border-copernicus-steel/20 font-bold text-[10px] text-zinc-400 uppercase tracking-wider">
            {col.title}
          </div>
          <div className="flex-1 p-2 space-y-2 overflow-y-auto scrollbar-thin scrollbar-thumb-copernicus-steel scrollbar-track-transparent">
            {stories.filter(s => s.status === col.status).map(story => (
              <motion.div
                layoutId={story.id}
                key={story.id}
                draggable
                onDragStart={(e) => handleDragStart(e, story.id as any)}
                className="p-3 bg-zinc-900/80 border border-zinc-800 rounded cursor-grab active:cursor-grabbing hover:border-copernicus-phosphor/50 hover:shadow-[0_0_10px_rgba(74,222,128,0.1)] transition-all group"
                onClick={() => {
                  try {
                    ipcRenderer.invoke('stories:hydrate', story.id)
                  } catch (e) { console.error(e) }
                }}
              >
                <div className="text-xs font-semibold text-zinc-300 group-hover:text-copernicus-phosphor truncate">
                  {story.title}
                </div>
                <div className="text-[9px] text-zinc-600 mt-1 truncate font-mono">
                  {story.id}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
