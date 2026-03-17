import React, { useEffect, useRef } from 'react'
import { useLayoutStore } from '../../store/layout'
import { useIpcError } from '../../hooks/useIpcError'
import { unwrapIpc } from '../../types/ipc'

type LayoutStoreState = ReturnType<typeof useLayoutStore.getState>;

interface LspStatusPopoverProps {
  isOpen: boolean
  onClose: () => void
  lspRunning: boolean
  language?: string
}

interface LspStatus {
  running: boolean
  languageServerName: string
  activeFileLanguage: string
  status: 'connected' | 'starting' | 'disconnected'
}

export const LspStatusPopover: React.FC<LspStatusPopoverProps> = ({ isOpen, onClose, lspRunning, language }) => {
  const invoke = useIpcError()
  const popoverRef = useRef<HTMLDivElement>(null)
  const diagnosticErrorCount = useLayoutStore((s: LayoutStoreState) => s.diagnosticErrorCount)
  const [lspDetailedStatus, setLspDetailedStatus] = React.useState<LspStatus | null>(null)

  useEffect(() => {
    if (!isOpen) return

    const fetchLspStatus = async () => {
      try {
        const result = await invoke<any>('lsp:status')
        const data = unwrapIpc<LspStatus>(result)
        setLspDetailedStatus(data)
      } catch (err) {
        console.error('Failed to fetch LSP status:', err)
        setLspDetailedStatus(null)
      }
    }
    fetchLspStatus()

    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        onClose()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen, onClose, invoke])

  if (!isOpen) return null

  // Determine connection status text and color
  let connectionStatusText: string
  let connectionStatusColor: string
  if (lspDetailedStatus?.status === 'starting') {
    connectionStatusText = 'Starting'
    connectionStatusColor = 'text-amber-400'
  } else if (lspRunning) {
    connectionStatusText = 'Connected'
    connectionStatusColor = 'text-green-500'
  } else {
    connectionStatusText = 'Disconnected'
    connectionStatusColor = 'text-red-500'
  }

  return (
    <div
      ref={popoverRef}
      className="absolute z-50 mt-1 left-full -translate-x-full bg-zinc-900 border border-zinc-700 rounded p-2 text-xs shadow-lg min-w-[220px]"
    >
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className="text-zinc-400">Connection:</span>
          <span className={`${connectionStatusColor} font-semibold`}>{connectionStatusText}</span>
        </div>
        {lspDetailedStatus?.languageServerName && (
          <div className="flex items-center justify-between">
            <span className="text-zinc-400">Server:</span>
            <span className="text-white">{lspDetailedStatus.languageServerName}</span>
          </div>
        )}
        {language && (
          <div className="flex items-center justify-between">
            <span className="text-zinc-400">Language:</span>
            <span className="text-white">{language}</span>
          </div>
        )}
        {diagnosticErrorCount > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-zinc-400">Errors:</span>
            <span className="text-red-400">{diagnosticErrorCount}</span>
          </div>
        )}
        {diagnosticErrorCount === 0 && lspRunning && (
          <div className="flex items-center justify-between">
            <span className="text-zinc-400">Errors:</span>
            <span className="text-green-500">0</span>
          </div>
        )}
      </div>
    </div>
  )
}
