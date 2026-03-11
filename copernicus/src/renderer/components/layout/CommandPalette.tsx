import React, { useEffect, useState, useMemo, useRef } from 'react'
import { commandRegistry } from '../../store/commandRegistry'

interface CommandPaletteProps {
  open: boolean
  onClose: () => void
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({ open, onClose }) => {
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)

  const results = useMemo(() => {
    return commandRegistry.search(query)
  }, [query])

  useEffect(() => {
    if (open) {
      setQuery('')
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 10)
    }
  }, [open])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!open) return
      if (e.key === 'Escape') {
        onClose()
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex(prev => (prev + 1) % results.length)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex(prev => (prev - 1 + results.length) % results.length)
      } else if (e.key === 'Enter') {
        e.preventDefault()
        if (results[selectedIndex]) {
          results[selectedIndex].command.action()
          onClose()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, results, selectedIndex, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[200] flex items-start justify-center pt-[20vh] pointer-events-none" onClick={onClose}>
      <div 
        className="pointer-events-auto w-[min(600px,90vw)] bg-[#0d0d0d] border border-copernicus-steel/50 rounded shadow-2xl font-mono overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Type a command..."
          className="w-full bg-transparent px-4 py-3 text-sm text-zinc-200 outline-none border-b border-copernicus-steel/20"
          autoFocus
        />
        <div className="max-h-[240px] overflow-y-auto scrollbar-thin scrollbar-thumb-copernicus-steel">
          {results.length === 0 ? (
            <div className="px-4 py-8 text-center text-zinc-600 text-[11px] uppercase tracking-widest">
              No commands found
            </div>
          ) : (
            results.map((res, idx) => (
              <div
                key={res.command.id}
                className={`px-4 py-2 text-[11px] flex items-center justify-between cursor-pointer transition-colors
                  ${idx === selectedIndex ? 'bg-white/10 text-copernicus-phosphor' : 'text-zinc-400 hover:bg-white/5'}
                `}
                onClick={() => {
                  res.command.action()
                  onClose()
                }}
                onMouseEnter={() => setSelectedIndex(idx)}
              >
                <div className="flex items-center gap-2">
                  <span>{res.command.label}</span>
                </div>
                {res.command.shortcut && (
                  <span className="text-[9px] text-zinc-600 font-mono">{res.command.shortcut}</span>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
