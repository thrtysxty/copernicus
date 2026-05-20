import { useEffect } from 'react'
import { useDebugStore } from '../../store/debug'
import { useIpcError } from '../../hooks/useIpcError'
import { unwrapIpc } from '../../types/ipc'
import { CallStack } from './CallStack'
import { VariableWatch } from './VariableWatch'

export function DebugPanel() {
  const isAttached = useDebugStore(s => s.isAttached)
  const isPaused = useDebugStore(s => s.isPaused)
  const setIsAttached = useDebugStore(s => s.setIsAttached)
  const setIsPaused = useDebugStore(s => s.setIsPaused)
  const setCallStack = useDebugStore(s => s.setCallStack)
  const setScopes = useDebugStore(s => s.setScopes)
  const clearVariables = useDebugStore(s => s.clearVariables)
  const invoke = useIpcError()

  useEffect(() => {
    // Listen for DAP events pushed via IPC
    const cleanup = window.ipcRenderer.on('debug:event', async (_e, { event, body }) => {
      if (event === 'stopped') {
        setIsPaused(true)
        const res = await invoke<any>('debug:get-call-stack', body.threadId || 1)
        if (res.ok) {
          const data = unwrapIpc<any>(res)
          setCallStack(data.stackFrames || [])

          if (data.stackFrames?.length > 0) {
            const topFrame = data.stackFrames[0]
            const scopeRes = await invoke<any>('debug:get-scopes', topFrame.id)
            if (scopeRes.ok) {
              const scopeData = unwrapIpc<any>(scopeRes)
              setScopes(scopeData.scopes || [])
            }
          }
        }
      } else if (event === 'continued') {
        setIsPaused(false)
        setCallStack([])
        clearVariables()
      } else if (event === 'terminated' || event === 'exited') {
        setIsAttached(false)
        setIsPaused(false)
        setCallStack([])
        clearVariables()
      } else if (event === 'initialized') {
        setIsAttached(true)
      }
    })

    return cleanup
  }, [])

  const handleLaunchNode = async () => {
    await invoke('debug:launch', { type: 'node' })
  }

  const handleLaunchPython = async () => {
    await invoke('debug:launch', { type: 'python' })
  }

  const handleStop = async () => {
    await invoke('debug:stop')
  }

  const handlePause = async () => {
    await invoke('debug:pause')
  }

  const handleResume = async () => {
    await invoke('debug:resume')
  }

  const handleStepOver = async () => {
    await invoke('debug:step-over')
  }

  const handleStepInto = async () => {
    await invoke('debug:step-into')
  }

  const handleStepOut = async () => {
    await invoke('debug:step-out')
  }

  return (
    <div data-testid="panel-debug" className="flex flex-col h-full bg-zinc-900 border-l border-zinc-800 w-64 text-zinc-300">
      {/* Header */}
      <div className="flex justify-between items-center p-2 border-b border-zinc-800 text-sm font-semibold uppercase tracking-wider text-zinc-400">
        Debug
        <div className="flex gap-2">
          {!isAttached && (
            <>
              <button
                className="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 rounded text-xs"
                onClick={handleLaunchNode}
                title="Launch Node.js"
              >
                Launch Node
              </button>
              <button
                className="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 rounded text-xs"
                onClick={handleLaunchPython}
                title="Launch Python"
              >
                Launch Python
              </button>
            </>
          )}
        </div>
      </div>

      {/* Toolbar */}
      {isAttached && (
        <div className="flex p-2 gap-1 border-b border-zinc-800 bg-zinc-800/50 justify-center">
          {isPaused ? (
            <button className="px-2 py-1 hover:bg-zinc-700 rounded text-zinc-300" onClick={handleResume} title="Continue (F5)">▶</button>
          ) : (
            <button className="px-2 py-1 hover:bg-zinc-700 rounded text-zinc-300" onClick={handlePause} title="Pause">⏸</button>
          )}
          <button className="px-2 py-1 hover:bg-zinc-700 rounded text-zinc-300" onClick={handleStepOver} title="Step Over (F10)" disabled={!isPaused}>↷</button>
          <button className="px-2 py-1 hover:bg-zinc-700 rounded text-zinc-300" onClick={handleStepInto} title="Step Into (F11)" disabled={!isPaused}>↓</button>
          <button className="px-2 py-1 hover:bg-zinc-700 rounded text-zinc-300" onClick={handleStepOut} title="Step Out (Shift+F11)" disabled={!isPaused}>↑</button>
          <button className="px-2 py-1 hover:bg-red-900/50 text-red-400 rounded" onClick={handleStop} title="Stop">■</button>
        </div>
      )}

      {/* State */}
      <div className="p-2 text-xs text-zinc-500 border-b border-zinc-800">
        Status: {isAttached ? (isPaused ? <span className="text-amber-500 font-bold">Paused</span> : <span className="text-copernicus-phosphor">Running</span>) : 'Disconnected'}
      </div>

      <CallStack />
      <VariableWatch />

    </div>
  )
}
