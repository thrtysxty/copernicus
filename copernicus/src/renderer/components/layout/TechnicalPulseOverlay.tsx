import log from '../../utils/logger'
import React, { useState, useEffect } from 'react'
import { useIpcError } from '../../hooks/useIpcError'
import { unwrapIpc } from '../../types/ipc'

interface HealthCheck {
  name: string
  ok: boolean
  timestamp: string
}

interface Props {
  onClose: () => void
}

export const TechnicalPulseOverlay: React.FC<Props> = ({ onClose }) => {
  const invoke = useIpcError()
  const [healthChecks, setHealthChecks] = useState<HealthCheck[]>([])
  const [checking, setChecking] = useState(false)

  const checkHealth = async () => {
    setChecking(true)
    // Initialize checks with 'checking...' state for all items
    const initialChecks: HealthCheck[] = [
      { name: 'Backend', ok: false, timestamp: 'checking...' },
      { name: 'DB connected', ok: false, timestamp: 'checking...' }, // Placeholder, no actual IPC for DB yet
      { name: 'Git repo valid', ok: false, timestamp: 'checking...' },
      { name: 'Ollama reachable', ok: false, timestamp: 'checking...' }, // Placeholder
      { name: 'Active model configured', ok: false, timestamp: 'checking...' }, // Placeholder
      { name: 'LSP running', ok: false, timestamp: 'checking...' }, // Placeholder
    ]
    setHealthChecks(initialChecks)

    try {
      const result = await invoke<HealthCheck[]>('health:check-all')
      const coreChecks = unwrapIpc<HealthCheck[]>(result as any) || []
      
      const allChecks: HealthCheck[] = initialChecks.map(initialCheck => {
        const found = coreChecks.find(cc => cc.name === initialCheck.name);
        if (found) {
          return { ...found, timestamp: new Date().toLocaleTimeString() };
        }
        // For placeholder items, assume they are not ok unless explicitly handled
        if (initialCheck.name === 'DB connected') {
          // In a real scenario, this would have an IPC handler
          return { ...initialCheck, ok: false, timestamp: 'N/A' };
        }
        if (initialCheck.name === 'Ollama reachable') {
          // In a real scenario, this would have an IPC handler
          return { ...initialCheck, ok: false, timestamp: 'N/A' };
        }
        if (initialCheck.name === 'Active model configured') {
          // In a real scenario, this would have an IPC handler
          return { ...initialCheck, ok: false, timestamp: 'N/A' };
        }
        if (initialCheck.name === 'LSP running') {
          // In a real scenario, this would have an IPC handler
          return { ...initialCheck, ok: false, timestamp: 'N/A' };
        }
        return initialCheck;
      });

      setHealthChecks(allChecks);

    } catch (error) {
      log.error('Failed to fetch health checks:', error)
      setHealthChecks(prev => prev.map(check => ({ ...check, ok: false, timestamp: 'Error' })))
    } finally {
      setChecking(false)
    }
  }

  useEffect(() => {
    checkHealth()
  }, [])

  return (
    <div className="fixed bottom-8 right-4 z-50 w-[300px] bg-[#0d0d0d] border border-copernicus-steel/40 rounded shadow-2xl p-2 text-zinc-300">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">System Health</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={checkHealth}
            className="text-[10px] text-copernicus-phosphor/80 hover:text-copernicus-phosphor transition-colors px-2 py-1 rounded disabled:opacity-50"
            disabled={checking}
          >
            {checking ? 'Checking…' : 'Re-check all'}
          </button>
          <button onClick={onClose} className="text-zinc-600 hover:text-zinc-300 text-[10px] transition-colors">✕</button>
        </div>
      </div>
      <ul className="space-y-1 text-[10px] font-mono">
        {healthChecks.map((check, index) => (
          <li key={index} className="flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              {check.ok ? (
                <span className="text-green-400">✓</span>
              ) : check.timestamp === 'checking...' ? (
                <span className="text-amber-400 animate-pulse">⟳</span>
              ) : (
                <span className="text-red-400">✗</span>
              )}
              <span className="text-zinc-300">{check.name}</span>
            </span>
            <span className="text-zinc-600">{check.timestamp}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
