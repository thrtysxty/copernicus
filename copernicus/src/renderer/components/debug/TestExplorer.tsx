import React, { useEffect, useRef } from 'react'
import { Play, Square, FileText, CheckCircle, XCircle, Circle, RefreshCw } from 'lucide-react'
import { useTestRunnerStore } from '../../store/testRunner'
import { useWorkspaceStore } from '../../store/layout'
import { useIpcError } from '../../hooks/useIpcError'
import { unwrapIpc } from '../../types/ipc'

export const TestExplorer: React.FC = () => {
  const {
    suites, setSuites, isRunning, setIsRunning,
    runLogs, appendLog, clearLogs,
    rerunOnSave, setRerunOnSave, setCoverage
  } = useTestRunnerStore()

  const invoke = useIpcError()
  const logRef = useRef<HTMLDivElement>(null)
  const setCenterMode = useWorkspaceStore(s => s.setCenterMode)
  const openFile = useWorkspaceStore(s => s.openFile)

  const isMounted = useRef(true)
  useEffect(() => {
    return () => { isMounted.current = false }
  }, [])

  useEffect(() => {
    discoverTests()
  }, [])

  useEffect(() => {
    const unsub = window.ipcRenderer.on('test:results', (_e: any, result: any) => {
      if (result.type === 'log') {
        appendLog(result.data)
        if (logRef.current) {
          logRef.current.scrollTop = logRef.current.scrollHeight
        }
      } else if (result.type === 'done') {
        setIsRunning(false)
        appendLog(`\nProcess exited with code ${result.code}\n`)
      }
    })
    return unsub
  }, [])

  const discoverTests = async () => {
    const res = await invoke<any[]>('test:discover')
    if (res && isMounted.current) {
      setSuites(unwrapIpc<any[]>(res) ?? [])
    }
  }

  const handleRunAll = async () => {
    clearLogs()
    setIsRunning(true)
    await invoke('test:run')
  }

  const handleRunSuite = async (suiteId: string) => {
    clearLogs()
    setIsRunning(true)
    await invoke('test:run', undefined, suiteId)
  }

  const handleRunTest = async (testId: string, suiteId: string) => {
    clearLogs()
    setIsRunning(true)
    await invoke('test:run', testId, suiteId)
  }

  const handleStop = async () => {
    await invoke('test:stop')
    setIsRunning(false)
  }

  const handleRunCoverage = async () => {
    clearLogs()
    setIsRunning(true)
    const res = await invoke<TestCoverage>('test:coverage')
    if (res) {
      setCoverage(unwrapIpc<TestCoverage>(res) ?? {})
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'passed': return <CheckCircle size={14} className="text-green-500" />
      case 'failed': return <XCircle size={14} className="text-red-500" />
      case 'running': return <RefreshCw size={14} className="text-blue-500 animate-spin" />
      case 'skipped': return <Circle size={14} className="text-zinc-500" />
      default: return <Circle size={14} className="text-zinc-600" />
    }
  }

  const handleTestClick = (file?: string, _line?: number) => {
    if (file) {
      openFile(file)
      setCenterMode('code')
    }
  }

  return (
    <div data-testid="panel-test-explorer" className="flex flex-col h-full bg-[#050505] text-zinc-300 font-sans text-sm">
      <div className="flex items-center justify-between p-3 border-b border-copernicus-steel shrink-0 bg-[#080808]">
        <div className="font-medium text-white flex items-center gap-2">
          <FileText size={16} className="text-copernicus-phosphor" />
          Test Explorer
        </div>
        <div className="flex gap-2">
          <button
            onClick={discoverTests}
            className="p-1 hover:bg-white/10 rounded transition-colors text-zinc-400 hover:text-white"
            title="Refresh Tests"
          >
            <RefreshCw size={14} />
          </button>
          {isRunning ? (
            <button
              onClick={handleStop}
              className="p-1 bg-red-500/20 text-red-500 hover:bg-red-500/30 rounded transition-colors"
              title="Stop Tests"
            >
              <Square size={14} />
            </button>
          ) : (
            <button
              onClick={handleRunAll}
              className="p-1 bg-copernicus-phosphor/20 text-copernicus-phosphor hover:bg-copernicus-phosphor/30 rounded transition-colors"
              title="Run All Tests"
            >
              <Play size={14} />
            </button>
          )}
          <button
            onClick={handleRunCoverage}
            className="px-2 py-0.5 text-xs bg-zinc-800 hover:bg-zinc-700 rounded transition-colors"
            title="Run with Coverage"
          >
            Coverage
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-2 border-b border-copernicus-steel">
          {suites.length === 0 ? (
            <div className="text-center text-zinc-500 mt-10 text-xs">No test suites discovered</div>
          ) : (
            <div className="space-y-4">
              {suites.map((suite) => (
                <div key={suite.id}>
                  <div className="flex items-center justify-between group hover:bg-white/5 p-1 rounded">
                    <div className="flex items-center gap-2 font-medium text-zinc-200">
                      <span className="text-xs px-1.5 py-0.5 rounded bg-zinc-800 uppercase">{suite.type}</span>
                      {suite.name}
                    </div>
                    <button
                      onClick={() => handleRunSuite(suite.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:text-copernicus-phosphor transition-colors"
                    >
                      <Play size={12} />
                    </button>
                  </div>
                  <div className="pl-4 mt-1 space-y-0.5 border-l border-zinc-800 ml-2">
                    {suite.tests.map(test => (
                      <div
                        key={test.id}
                        className="flex items-center justify-between group hover:bg-white/5 p-1 rounded cursor-pointer"
                        onClick={() => handleTestClick(test.file, test.line)}
                      >
                        <div className="flex items-center gap-2 text-zinc-400">
                          {getStatusIcon(test.status)}
                          <span className="truncate max-w-[200px] text-xs" title={test.name}>{test.name}</span>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleRunTest(test.id, suite.id) }}
                          className="opacity-0 group-hover:opacity-100 p-1 hover:text-copernicus-phosphor transition-colors"
                        >
                          <Play size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="h-1/3 min-h-[150px] bg-[#000] flex flex-col">
          <div className="flex items-center justify-between p-1.5 border-b border-zinc-800 bg-[#080808] shrink-0">
            <span className="text-xs font-mono text-zinc-500 uppercase">Test Output</span>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1.5 text-xs text-zinc-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rerunOnSave}
                  onChange={(e) => setRerunOnSave(e.target.checked)}
                  className="accent-copernicus-phosphor w-3 h-3"
                />
                Watch / Re-run on Save
              </label>
            </div>
          </div>
          <div
            ref={logRef}
            className="flex-1 overflow-y-auto p-2 font-mono text-xs whitespace-pre-wrap text-zinc-400"
          >
            {runLogs || <span className="text-zinc-600">No output</span>}
          </div>
        </div>
      </div>
    </div>
  )
}

type TestCoverage = { [filePath: string]: { lines: { [line: number]: 'covered' | 'uncovered' | 'partial' } } }
