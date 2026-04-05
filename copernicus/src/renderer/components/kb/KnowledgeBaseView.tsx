import React, { useState, useRef, useEffect, MouseEvent } from 'react'
import { BookOpen } from 'lucide-react'
import { KbTree } from './KbTree'
import { KbArticle } from './KbArticle'
import { ChatPanel } from '../chat/ChatPanel'
import { useLayoutStore } from '../../store/layout'

export const KnowledgeBaseView: React.FC = () => {
  const activeKbArticleId = useLayoutStore(s => s.activeKbArticleId)
  const setActiveKbArticleId = useLayoutStore(s => s.setActiveKbArticleId)

  // 60/40 split defaults
  const [splitHeight, setSplitHeight] = useState<number>(60)
  const isDragging = useRef(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const handleMouseDown = (e: MouseEvent) => {
    isDragging.current = true
    e.preventDefault()
  }

  useEffect(() => {
    const handleMouseMove = (e: globalThis.MouseEvent) => {
      if (!isDragging.current || !containerRef.current) return
      const containerRect = containerRef.current.getBoundingClientRect()
      const newHeight = ((e.clientY - containerRect.top) / containerRect.height) * 100
      if (newHeight > 20 && newHeight < 80) {
        setSplitHeight(newHeight)
      }
    }

    const handleMouseUp = () => {
      isDragging.current = false
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [])

  return (
    <div className="flex h-full w-full bg-copernicus-bg text-zinc-300 font-sans overflow-hidden">
      {/* Sidebar for Content Tree */}
      <KbTree
        activeArticleId={activeKbArticleId}
        onSelectArticle={setActiveKbArticleId}
      />

      {/* Main Area for Articles */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#050505]" ref={containerRef}>
        {!activeKbArticleId ? (
          <div className="flex-1 flex flex-col items-center justify-center text-zinc-500">
            <BookOpen size={48} className="mb-4 text-zinc-600 opacity-50" />
            <span className="text-sm font-mono tracking-widest uppercase">Select an article to get started</span>
          </div>
        ) : (
          <>
            <div
              style={{ height: `${splitHeight}%` }}
              className="flex flex-col overflow-hidden relative"
            >
              <KbArticle articleId={activeKbArticleId} />
            </div>

            {/* Draggable Divider */}
            <div
              onMouseDown={handleMouseDown}
              className="h-1 bg-copernicus-steel/50 cursor-ns-resize hover:bg-copernicus-phosphor/50 transition-colors shrink-0"
            />

            <div
              style={{ height: `${100 - splitHeight}%` }}
              className="flex flex-col overflow-hidden relative"
            >
              <ChatPanel panelId={`kb:${activeKbArticleId}`} />
            </div>
          </>
        )}
      </div>
    </div>
  )
}
