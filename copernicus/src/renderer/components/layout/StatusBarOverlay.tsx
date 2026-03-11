import React, { useEffect, useRef } from 'react'

interface Props {
  anchorRef: React.RefObject<HTMLElement>
  open: boolean
  onClose: () => void
  children: React.ReactNode
  width?: number
}

export const StatusBarOverlay: React.FC<Props> = ({ anchorRef, open, onClose, children, width = 280 }) => {
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    const handleClick = (e: MouseEvent) => {
      if (overlayRef.current && !overlayRef.current.contains(e.target as Node) &&
          anchorRef.current && !anchorRef.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('keydown', handleKey)
    document.addEventListener('mousedown', handleClick)
    return () => { document.removeEventListener('keydown', handleKey); document.removeEventListener('mousedown', handleClick) }
  }, [open, onClose, anchorRef])

  if (!open) return null

  const anchor = anchorRef.current?.getBoundingClientRect()
  const left = Math.min(anchor?.left ?? 0, window.innerWidth - width - 8)
  const bottom = window.innerHeight - (anchor?.top ?? 0) + 4

  return (
    <div
      ref={overlayRef}
      style={{ position: 'fixed', left, bottom, width, zIndex: 200 }}
      className="bg-[#0d0d0d] border border-copernicus-steel/40 rounded shadow-2xl font-mono animate-in slide-in-from-bottom-2 fade-in duration-100"
    >
      {children}
    </div>
  )
}
