import React, { useState, useEffect, useRef } from 'react'
import { Check, ChevronDown, GitBranch, AlertTriangle } from 'lucide-react'
import { useIpcError } from '../../hooks/useIpcError'
import { IpcResult, unwrapIpc } from '../../types/ipc'
import { useLayoutStore } from '../../store/layout'

interface Branch {
  name: string
  active: boolean
}

interface BranchSelectorProps {
  onBranchChange?: () => void
}

export const BranchSelector: React.FC<BranchSelectorProps> = ({ onBranchChange }) => {
  const [isOpen, setIsOpen] = useState(false)
  const [branches, setBranches] = useState<Branch[]>([])
  const [loading, setLoading] = useState(false)
  const [showWarning, setShowWarning] = useState<string | null>(null)
  
  const invoke = useIpcError()
  const dropdownRef = useRef<HTMLDivElement>(null)
  
  const currentBranchName = useLayoutStore(s => s.gitBranch)
  const isGitDirty = useLayoutStore(s => s.isGitDirty)

  const fetchBranches = async () => {
    setLoading(true)
    try {
      const b = await invoke<IpcResult<Branch[]>>('git:list-branches')
      setBranches(unwrapIpc(b) ?? [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen) {
      fetchBranches()
    }
  }, [isOpen])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
        setShowWarning(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelectBranch = async (branchName: string) => {
    if (branchName === currentBranchName) {
      setIsOpen(false)
      return
    }

    if (isGitDirty && showWarning !== branchName) {
      setShowWarning(branchName)
      return
    }

    try {
      await invoke('git:checkout', { branch: branchName })
      setIsOpen(false)
      setShowWarning(null)
      if (onBranchChange) {
        onBranchChange()
      }
    } catch (e) {
      // useIpcError handles toast if there's an error envelope
    }
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 hover:bg-zinc-900 px-2 py-1 rounded transition-colors group"
      >
        <GitBranch size={14} className="text-copernicus-phosphor" />
        <span className="font-bold">{currentBranchName}</span>
        <ChevronDown size={12} className="text-zinc-500 group-hover:text-zinc-300 transition-colors" />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-64 bg-zinc-950 border border-copernicus-steel/30 rounded shadow-xl z-50 py-1">
          <div className="px-3 py-2 border-b border-copernicus-steel/20 text-[10px] uppercase tracking-widest text-zinc-500 font-bold flex justify-between items-center">
            <span>Local Branches</span>
            {loading && <span className="animate-pulse">...</span>}
          </div>
          <div className="max-h-64 overflow-y-auto">
            {branches.map(branch => (
              <div key={branch.name} className="flex flex-col">
                <button
                  onClick={() => handleSelectBranch(branch.name)}
                  className={`w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-zinc-900 transition-colors
                    ${branch.name === currentBranchName ? 'text-copernicus-phosphor bg-zinc-900/50' : 'text-zinc-300'}
                  `}
                >
                  <div className="w-3 flex justify-center">
                    {branch.name === currentBranchName && <Check size={12} className="text-copernicus-phosphor" />}
                  </div>
                  <span className="truncate flex-1">{branch.name}</span>
                </button>
                
                {showWarning === branch.name && (
                  <div className="px-3 py-2 bg-amber-500/10 border-t border-b border-amber-500/30 text-amber-500 flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <AlertTriangle size={12} />
                      <span className="font-bold">Uncommitted changes</span>
                    </div>
                    <span className="text-zinc-400 leading-tight">Switching branches may overwrite your working tree.</span>
                    <button 
                      onClick={() => {
                        setShowWarning(null) // just hide warning and click again to confirm checkout if we wanted to allow, but AC says:
                        // "Uncommitted changes → warning shown before switching (not a hard block)"
                        // We will allow checkout on second click.
                        handleSelectBranch(branch.name)
                      }}
                      className="mt-1 w-full bg-amber-500 text-black py-1 rounded font-bold hover:bg-amber-400 transition-colors text-center"
                    >
                      SWITCH ANYWAY
                    </button>
                  </div>
                )}
              </div>
            ))}
            {!loading && branches.length === 0 && (
              <div className="px-3 py-4 text-center text-zinc-500 italic">
                No branches found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
