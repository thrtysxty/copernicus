import React, { useEffect } from 'react'
import { useLayoutStore } from '../../store/layout'

export const StatusBar: React.FC = () => {
  const { 
    workingDir, 
    gitBranch, 
    isGitDirty, 
    agentTelemetry, 
    capexTotal, 
    capexSessionTime,
    activeStoryId,
    setTelemetry
  } = useLayoutStore()

  // Session Timer Effect
  useEffect(() => {
    const timer = setInterval(() => {
      setTelemetry({ capexSessionTime: capexSessionTime + 1 })
    }, 1000)
    return () => clearInterval(timer)
  }, [capexSessionTime, setTelemetry])

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60
    return `${h}h ${m}m ${s}s`
  }

  const formatTokens = (tokens: number) => {
    if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(1)}M`
    if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}k`
    return tokens.toString()
  }

  return (
    <footer className="h-5 w-full bg-copernicus-bg border-t border-hairline border-copernicus-steel flex items-center justify-between px-2 text-[10px] text-zinc-600 select-none overflow-hidden">
      <div className="flex items-center gap-3 divide-x divide-copernicus-steel/30">
        
        {/* Workspace Root */}
        <div className="flex items-center gap-1.5 cursor-pointer hover:text-zinc-400 transition-colors pr-3">
          <span className="text-copernicus-phosphor/60">📁</span>
          <span className="truncate max-w-[150px]">{workingDir}</span>
        </div>

        {/* Git Branch */}
        <div className="flex items-center gap-1.5 px-3">
          <span className="text-copernicus-phosphor/60">🌿</span>
          <span className={`${isGitDirty ? 'text-zinc-400' : 'text-copernicus-phosphor/80'}`}>
            {gitBranch}{isGitDirty ? '*' : ''}
          </span>
        </div>

        {/* Agent Telemetry */}
        <div className="flex items-center gap-4 px-3">
          {Object.entries(agentTelemetry).map(([agent, data]) => (
            <div key={agent} className="flex items-center gap-1.5">
              <span className="uppercase font-bold text-zinc-500">{agent}:</span>
              <span className="text-zinc-400">
                {formatTokens(data.tokensIn + data.tokensOut)}/{formatTokens(data.limit)}
              </span>
              <span className="text-copernicus-phosphor/40">↑</span>
              <span className="text-zinc-500">${data.cost.toFixed(2)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3 divide-x divide-copernicus-steel/30">
        {/* CapEx Segment */}
        <div className="flex items-center gap-3 px-3 cursor-pointer hover:text-zinc-400 transition-colors">
          <div className="flex items-center gap-1.5">
            <span className="text-zinc-500">⏱</span>
            <span>{formatTime(capexSessionTime)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-zinc-500 uppercase font-bold">CapEx</span>
            <span className="text-copernicus-phosphor phosphor-glow font-bold">${capexTotal.toLocaleString()}</span>
          </div>
        </div>

        {/* Story ID & Status */}
        <div className="flex items-center gap-3 pl-3">
          <span className="italic underline underline-offset-2 text-zinc-500">{activeStoryId || 'NO_STORY'}</span>
          <div className="flex items-center gap-1.5">
            <span className="text-copernicus-phosphor phosphor-glow text-[8px] animate-pulse">●</span>
            <span className="uppercase text-zinc-500 tracking-tighter">Technical_Pulse_Online</span>
          </div>
        </div>
      </div>
    </footer>
  )
}
