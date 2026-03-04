import { useEffect, useState } from 'react'
import { useIpcError } from '../hooks/useIpcError'
import log from '../utils/logger'
import { unwrapIpc } from '../types/ipc'
import { RotateCcw } from 'lucide-react'

export function CommandDeck() {
  const invoke = useIpcError()
  const [targets, setTargets] = useState<string[]>([])
  const [running, setRunning] = useState<string | null>(null)

  const fetchTargets = async () => {
    try {
      const _raw = await invoke<any>('makefile:list')
      setTargets(unwrapIpc<any>(_raw) ?? [])
    } catch (e) {
      log.warn("Failed to fetch makefile targets, using fallback", e)
      setTargets(['test', 'test_e2e', 'backlog', 'deploy', 'clean', 'dev', 'db-migrate'])
    }
  }

  useEffect(() => {
    fetchTargets()
  }, [invoke])

  const runTarget = async (target: string) => {
    setRunning(target)
    try {
      await invoke('makefile:run', target)
    } catch (e) {
      log.error(`Failed to run target ${target}`, e)
    } finally {
      setRunning(null)
    }
  }

  return (
    <div className="flex flex-col h-full bg-copernicus-bg text-zinc-300">
      {/* Standard h-8 Header */}
      <div className="h-8 flex items-center px-3 bg-black/20 border-b border-copernicus-steel/30 justify-between shrink-0 group/cmd">
        <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Command Deck</span>
        <div className="flex items-center gap-2">
          {running && (
            <span className="text-[9px] text-copernicus-phosphor font-mono animate-pulse uppercase tracking-tighter">
              Executing_{running}...
            </span>
          )}
          <button 
            onClick={fetchTargets} 
            className="opacity-0 group-hover/cmd:opacity-100 transition-opacity p-1 hover:text-copernicus-phosphor"
            title="Refresh Makefile"
          >
            <RotateCcw size={12} />
          </button>
        </div>
      </div>
      
      <div className="flex-1 p-3 overflow-y-auto grid grid-cols-2 gap-2 content-start custom-scrollbar">
        {targets.map(target => (
          <button
            key={target}
            onClick={() => runTarget(target)}
            disabled={!!running}
            className={`
              h-9 px-2 text-[10px] font-mono border border-copernicus-steel/50 rounded hover:bg-copernicus-steel/20 hover:border-copernicus-phosphor hover:text-copernicus-phosphor transition-all text-left truncate uppercase tracking-tight
              ${['test', 'test_e2e', 'backlog', 'git commit'].includes(target) ? 'col-span-2 border-l-2 border-l-copernicus-phosphor' : ''}
              ${running === target ? 'bg-copernicus-phosphor/10 text-copernicus-phosphor border-copernicus-phosphor animate-pulse' : ''}
              disabled:opacity-50 disabled:cursor-not-allowed
            `}
          >
            make {target}
          </button>
        ))}
      </div>
    </div>
  )
}
