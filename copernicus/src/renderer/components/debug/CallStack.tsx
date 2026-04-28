import { useDebugStore } from '../../store/debug'
import { useLayoutStore } from '../../store/layout'
import { useIpcError } from '../../hooks/useIpcError'
import { unwrapIpc } from '../../types/ipc'

export function CallStack() {
  const callStack = useDebugStore(s => s.callStack)
  const isPaused = useDebugStore(s => s.isPaused)
  const setActiveFile = useLayoutStore(s => s.setActiveFile)
  const openFile = useLayoutStore(s => s.openFile)
  const setEditorFocusLine = useLayoutStore(s => s.setEditorFocusLine)
  const invoke = useIpcError()
  const setScopes = useDebugStore(s => s.setScopes)
  const clearVariables = useDebugStore(s => s.clearVariables)

  if (!isPaused) {
    return <div className="text-zinc-500 text-sm p-2 italic">Not paused</div>
  }

  if (callStack.length === 0) {
    return <div className="text-zinc-500 text-sm p-2 italic">No call stack</div>
  }

  const handleFrameClick = async (frameId: number, sourcePath?: string, _line?: number) => {
    // Open file
    if (sourcePath) {
      openFile(sourcePath)
      setActiveFile(sourcePath)

      if (_line) {
        setEditorFocusLine({ file: sourcePath, line: _line, col: 1 })
        invoke<void>('layout:goto-line', { file: sourcePath, line: _line, col: 1 }).catch(() => {})
      }
    }

    // Load scopes for this frame
    clearVariables()
    const res = await invoke<any>('debug:get-scopes', frameId)
    if (res.ok) {
      const data = unwrapIpc<any>(res)
      setScopes(data.scopes || [])
    }
  }

  return (
    <div className="flex flex-col text-sm text-zinc-300">
      <div className="font-semibold px-2 py-1 bg-zinc-800">Call Stack</div>
      <div className="overflow-y-auto max-h-48">
        {callStack.map((frame, index) => (
          <div
            key={frame.id}
            className={`cursor-pointer px-2 py-1 hover:bg-zinc-700 truncate ${index === 0 ? 'text-copernicus-phosphor' : ''}`}
            onClick={() => handleFrameClick(frame.id, frame.source?.path, frame.line)}
          >
            {frame.name} <span className="text-zinc-500 text-xs ml-1">{frame.source?.name}:{frame.line}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
