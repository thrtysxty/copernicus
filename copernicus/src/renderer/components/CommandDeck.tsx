import { useEffect, useState } from 'react'
import { useIpcError } from '../hooks/useIpcError'
import log from '../utils/logger'

export function CommandDeck() {
  const invoke = useIpcError()
  const [targets, setTargets] = useState<string[]>([])
  const [running, setRunning] = useState<string | null>(null)

  useEffect(() => {
    const fetchTargets = async () => {
      try {
        const _raw = await invoke<any>('makefile:list')
        setTargets((_raw as any)?.data ?? _raw ?? [])
      } catch (e) {
        log.warn("Failed to fetch makefile targets, using fallback", e)
        setTargets(['test', 'test_e2e', 'backlog', 'deploy', 'clean', 'dev', 'db-migrate'])
      }
    }
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
      <div className="h-6 flex items-center px-2 bg-copernicus-bg border-b border-hairline border-copernicus-steel justify-between">
        <span className="text-[10px] uppercase text-zinc-500">Command Deck</span>
        <span className="text-[9px] text-copernicus-phosphor font-mono">
          {running ? `>> EXECUTING: ${running}` : '>> READY'}
        </span>
      </div>
      <div className="flex-1 p-2 overflow-y-auto grid grid-cols-2 gap-2 content-start">
        {targets.map(target => (
          <button
            key={target}
            onClick={() => runTarget(target)}
            disabled={!!running}
            className={`
              h-8 px-2 text-xs font-mono border border-copernicus-steel rounded hover:bg-copernicus-steel/20 hover:border-copernicus-phosphor hover:text-copernicus-phosphor transition-all text-left truncate
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
