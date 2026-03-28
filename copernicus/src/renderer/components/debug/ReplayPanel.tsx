import log from '../../utils/logger'
import React, { useEffect, useState } from 'react'
import { useIpcError } from '../../hooks/useIpcError'
import { unwrapIpc } from '../../types/ipc'
import { useReplayStore, ReplayRun, ReplayStep, ReplayStepDetail } from '../../store/replay'
import { clsx } from 'clsx'
import { RefreshCw, ChevronRight, Activity, Terminal, Database } from 'lucide-react'

export const ReplayPanel: React.FC = () => {
  const invoke = useIpcError()
  const {
    runs, setRuns,
    selectedRunId, setSelectedRunId,
    steps, setSteps,
    selectedStepId, setSelectedStepId,
    selectedStepDetail, setSelectedStepDetail,
    isLoading, setIsLoading
  } = useReplayStore()

  const [activeTab, setActiveTab] = useState<'prompt' | 'context' | 'response'>('prompt')

  useEffect(() => {
    loadRuns()
  }, [])

  const loadRuns = async () => {
    setIsLoading(true)
    try {
      const res = await invoke<ReplayRun[]>('replay:list-runs', 50)
      setRuns(unwrapIpc<ReplayRun[]>(res))
    } catch (err) {
      log.error('Failed to load runs:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const selectRun = async (runId: string) => {
    setSelectedRunId(runId)
    try {
      const res = await invoke<ReplayStep[]>('replay:get-steps', runId)
      setSteps(unwrapIpc<ReplayStep[]>(res))
    } catch (err) {
      log.error('Failed to load steps:', err)
    }
  }

  const selectStep = async (stepId: number) => {
    setSelectedStepId(stepId)
    try {
      const res = await invoke<ReplayStepDetail>('replay:get-step-detail', stepId)
      setSelectedStepDetail(unwrapIpc<ReplayStepDetail>(res))
    } catch (err) {
      log.error('Failed to load step detail:', err)
    }
  }

  const formatTime = (dateStr: string) => {
    try {
      const date = new Date(dateStr)
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
    } catch {
      return dateStr
    }
  }

  return (
    <div className="flex h-full w-full bg-[#050505] text-zinc-300 font-mono text-xs overflow-hidden select-none">
      {/* Column 1: Runs */}
      <div className="w-1/4 border-r border-zinc-800 flex flex-col min-w-[200px]">
        <div className="h-8 px-2 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/50">
          <span className="font-bold uppercase tracking-wider text-zinc-500 flex items-center gap-1">
            <Activity size={12} /> History
          </span>
          <button 
            onClick={loadRuns} 
            className={clsx("hover:text-copernicus-phosphor transition-colors", isLoading && "animate-spin")}
          >
            <RefreshCw size={12} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {runs.map(run => (
            <div
              key={run.run_id}
              onClick={() => selectRun(run.run_id)}
              className={clsx(
                "p-2 cursor-pointer border-b border-zinc-900/50 hover:bg-zinc-800/30 transition-colors",
                selectedRunId === run.run_id ? "bg-copernicus-phosphor text-[#050505] rounded-none" : ""
              )}
            >
              <div className="flex justify-between items-start mb-1">
                <span className="truncate font-bold">{run.run_id.substring(0, 8)}...</span>
                <span className={clsx("text-[10px]", selectedRunId === run.run_id ? "text-[#050505]/70" : "text-zinc-500")}>
                  {formatTime(run.started_at)}
                </span>
              </div>
              <div className="flex justify-between text-[10px] opacity-80">
                <span className="truncate mr-2">{run.model_id}</span>
                <span className="whitespace-nowrap">{run.step_count} steps</span>
              </div>
            </div>
          ))}
          {runs.length === 0 && !isLoading && (
            <div className="p-4 text-center text-zinc-600 italic">No runs recorded</div>
          )}
        </div>
      </div>

      {/* Column 2: Steps */}
      <div className="w-1/4 border-r border-zinc-800 flex flex-col min-w-[180px]">
        <div className="h-8 px-2 border-b border-zinc-800 flex items-center bg-zinc-900/50">
          <span className="font-bold uppercase tracking-wider text-zinc-500 flex items-center gap-1">
            <Terminal size={12} /> Steps
          </span>
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {!selectedRunId && (
            <div className="p-8 text-center text-zinc-600 italic">Select a run</div>
          )}
          {steps.map((step, idx) => (
            <div
              key={step.id}
              onClick={() => selectStep(step.id)}
              className={clsx(
                "p-2 cursor-pointer border-b border-zinc-900/50 hover:bg-zinc-800/30 transition-colors flex items-center justify-between",
                selectedStepId === step.id ? "bg-copernicus-phosphor text-[#050505] rounded-none" : ""
              )}
            >
              <div className="flex flex-col overflow-hidden">
                <span className="font-bold">Step {idx + 1}</span>
                <span className={clsx("text-[10px] truncate", selectedStepId === step.id ? "text-[#050505]/70" : "text-zinc-500")}>
                  {step.model_id}
                </span>
              </div>
              <ChevronRight size={14} className={clsx(selectedStepId === step.id ? "text-[#050505]" : "text-zinc-700")} />
            </div>
          ))}
        </div>
      </div>

      {/* Column 3: Detail */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="h-8 px-2 border-b border-zinc-800 bg-zinc-900/50 flex items-center gap-4">
          <span className="font-bold uppercase tracking-wider text-zinc-500 flex items-center gap-1 mr-2">
            <Database size={12} /> Detail
          </span>
          <button
            onClick={() => {
              if (activeTab === 'prompt') setActiveTab('context')
              else if (activeTab === 'context') setActiveTab('response')
              else setActiveTab('prompt')
            }}
            title={`Switch to ${activeTab === 'prompt' ? 'Context' : activeTab === 'context' ? 'Response' : 'Prompt'}`}
            className="shrink-0 text-[10px] font-mono uppercase tracking-widest text-copernicus-phosphor hover:text-copernicus-phosphor transition-colors"
          >
            {activeTab}
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 whitespace-pre-wrap leading-relaxed selection:bg-copernicus-phosphor/30 select-text custom-scrollbar">
          {!selectedStepId && (
            <div className="flex flex-col items-center justify-center h-full text-zinc-600 italic">
              <Activity size={32} className="mb-2 opacity-20" />
              <span>Select a step to inspect payload</span>
            </div>
          )}
          {selectedStepDetail && (
            <div className="animate-in fade-in duration-200">
              {activeTab === 'prompt' && (
                <div className="text-zinc-400">
                  {selectedStepDetail.prompt_text || (
                    <span className="text-zinc-600 italic">[Not recorded — call predates replay logging]</span>
                  )}
                </div>
              )}
              {activeTab === 'context' && (
                <div className="text-zinc-400">
                  {selectedStepDetail.context_json ? (
                    (() => {
                      try {
                        return JSON.stringify(JSON.parse(selectedStepDetail.context_json), null, 2)
                      } catch {
                        return selectedStepDetail.context_json
                      }
                    })()
                  ) : (
                    <span className="text-zinc-600 italic">[No context recorded]</span>
                  )}
                </div>
              )}
              {activeTab === 'response' && (
                <div className="text-copernicus-phosphor brightness-90">
                  {selectedStepDetail.response_text || (
                    <span className="text-zinc-600 italic">[No response recorded]</span>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

