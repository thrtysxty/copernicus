import React, { useEffect, useRef } from 'react'
import { File, Folder, Edit2, Trash2, Copy, Eye } from 'lucide-react'

export interface ContextMenuProps {
  x: number
  y: number
  nodeType: 'file' | 'folder' | 'background'
  onClose: () => void
  onAction: (action: 'new-file' | 'new-folder' | 'rename' | 'delete' | 'copy-path' | 'reveal' | 'open') => void
}

export const FileTreeContextMenu: React.FC<ContextMenuProps> = ({ x, y, nodeType, onClose, onAction }) => {
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onClose])

  const style: React.CSSProperties = {
    position: 'fixed',
    top: y,
    left: x,
    zIndex: 1000,
  }

  const handleAction = (action: 'new-file' | 'new-folder' | 'rename' | 'delete' | 'copy-path' | 'reveal' | 'open') => {
    onAction(action)
    onClose()
  }

  const items: { label: string; action: 'new-file' | 'new-folder' | 'rename' | 'delete' | 'copy-path' | 'reveal' | 'open'; icon: React.ReactNode; show: boolean; danger?: boolean }[] = [
    { label: 'Open', action: 'open', icon: <Eye size={14} />, show: nodeType === 'file' },
    { label: 'New File', action: 'new-file', icon: <File size={14} />, show: nodeType === 'folder' || nodeType === 'background' },
    { label: 'New Folder', action: 'new-folder', icon: <Folder size={14} />, show: nodeType === 'folder' || nodeType === 'background' },
    { label: 'Rename', action: 'rename', icon: <Edit2 size={14} />, show: nodeType !== 'background' },
    { label: 'Copy Path', action: 'copy-path', icon: <Copy size={14} />, show: nodeType !== 'background' },
    { label: 'Reveal in Finder', action: 'reveal', icon: <Eye size={14} />, show: nodeType !== 'background' },
    { label: 'Delete', action: 'delete', icon: <Trash2 size={14} />, show: nodeType !== 'background', danger: true },
  ]

  return (
    <div
      ref={menuRef}
      style={style}
      className="bg-[#1a1a1a] border border-white/10 rounded-md shadow-lg py-1 min-w-[160px] text-[11px] text-zinc-300"
      onContextMenu={(e) => e.preventDefault()}
    >
      {items.filter(item => item.show).map((item) => (
        <button
          key={item.action}
          onClick={() => handleAction(item.action)}
          className={`w-full text-left px-3 py-1.5 flex items-center gap-2 hover:bg-copernicus-phosphor hover:text-[#050505] transition-colors
            ${item.danger ? 'hover:bg-red-500 hover:text-white' : ''}
          `}
        >
          {item.icon}
          {item.label}
        </button>
      ))}
    </div>
  )
}
