import { useEffect, useState } from 'react'

const ipcRenderer = (window as any).ipcRenderer

export function CommandDeck() {
  const [targets, setTargets] = useState<string[]>([])
  const [running, setRunning] = useState<string | null>(null)

  useEffect(() => {
    const fetchTargets = async () => {
      try {
        const result = await ipcRenderer.invoke('makefile:list')
        setTargets(result)
      } catch (e) {
        console.warn("Failed to fetch makefile targets, using fallback", e)
        setTargets(['test', 'test_e2e', 'backlog', 'deploy', 'clean', 'dev', 'db-migrate'])
      }
    }
    fetchTargets()
  }, [])

  const runTarget = async (target: string) => {
    setRunning(target)
    try {
      await ipcRenderer.invoke('makefile:run', target)
    } catch (e) {
      console.error(`Failed to run target ${target}`, e)
    } finally {
      setRunning(null)
    }
  }

  return (
    <div className="flex flex-col h-full bg-benway-bg text-zinc-300">
      <div className="h-6 flex items-center px-2 bg-benway-bg border-b border-hairline border-benway-steel justify-between">
        <span className="text-[10px] uppercase text-zinc-500">Command Deck</span>
        <span className="text-[9px] text-benway-phosphor font-mono">
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
              h-8 px-2 text-xs font-mono border border-benway-steel rounded hover:bg-benway-steel/20 hover:border-benway-phosphor hover:text-benway-phosphor transition-all text-left truncate
              ${['test', 'test_e2e', 'backlog', 'git commit'].includes(target) ? 'col-span-2 border-l-2 border-l-benway-phosphor' : ''}
              ${running === target ? 'bg-benway-phosphor/10 text-benway-phosphor border-benway-phosphor animate-pulse' : ''}
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
