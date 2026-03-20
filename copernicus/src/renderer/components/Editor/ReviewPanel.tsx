import React, { useEffect, useState, useRef } from 'react'

const ipcRenderer = window.ipcRenderer

export type Verdict = 'APPROVE' | 'WARN' | 'REJECT'

interface ReviewPanelProps {
  agentASessionId: string
  agentBSessionId: string
  agentALabel: string
  agentBLabel: string
  onComplete: (verdicts: { a: Verdict; b: Verdict }) => void
}

type AgentStatus = 'pending' | 'streaming' | 'done'

const VERDICT_PATTERNS = {
  REJECT: /\b(reject|incorrect|broken|dangerous|wrong|error)\b/i,
  WARN: /\b(warn|concern|careful|potential|consider|might)\b/i,
}

function inferVerdict(text: string): Verdict {
  if (VERDICT_PATTERNS.REJECT.test(text)) return 'REJECT'
  if (VERDICT_PATTERNS.WARN.test(text)) return 'WARN'
  return 'APPROVE'
}

const VerdictBadge: React.FC<{ verdict: Verdict }> = ({ verdict }) => {
  const colors = {
    APPROVE: 'bg-green-500/20 text-green-400 border-green-500/30',
    WARN: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    REJECT: 'bg-red-500/20 text-red-400 border-red-500/30',
  }

  return (
    <span className={`text-[10px] px-2 py-0.5 rounded border ${colors[verdict]} uppercase tracking-wider font-mono`}>
      {verdict}
    </span>
  )
}

export const ReviewPanel: React.FC<ReviewPanelProps> = ({
  agentASessionId,
  agentBSessionId,
  agentALabel,
  agentBLabel,
  onComplete,
}) => {
  const [agentAText, setAgentAText] = useState('')
  const [agentBText, setAgentBText] = useState('')
  const [agentAStatus, setAgentAStatus] = useState<AgentStatus>('pending')
  const [agentBStatus, setAgentBStatus] = useState<AgentStatus>('pending')

  const agentARef = useRef<HTMLDivElement>(null)
  const agentBRef = useRef<HTMLDivElement>(null)
  const hasCompletedRef = useRef(false)

  // Reset state on new session
  useEffect(() => {
    setAgentAText('')
    setAgentBText('')
    setAgentAStatus('pending')
    setAgentBStatus('pending')
    hasCompletedRef.current = false
  }, [agentASessionId, agentBSessionId])

  // Auto-scroll
  useEffect(() => {
    if (agentARef.current) agentARef.current.scrollTop = agentARef.current.scrollHeight
  }, [agentAText])

  useEffect(() => {
    if (agentBRef.current) agentBRef.current.scrollTop = agentBRef.current.scrollHeight
  }, [agentBText])

  useEffect(() => {
    const handleToken = (_event: any, { sessionId, token }: { sessionId: string; token: string }) => {
      if (sessionId === agentASessionId) {
        setAgentAStatus('streaming')
        setAgentAText(prev => prev + token)
      } else if (sessionId === agentBSessionId) {
        setAgentBStatus('streaming')
        setAgentBText(prev => prev + token)
      }
    }

    const handleDone = (_event: any, { sessionId }: { sessionId: string }) => {
      if (sessionId === agentASessionId) {
        setAgentAStatus('done')
      } else if (sessionId === agentBSessionId) {
        setAgentBStatus('done')
      }
    }

    ipcRenderer.on('chat:token', handleToken)
    ipcRenderer.on('chat:done', handleDone)

    return () => {
      ipcRenderer.off('chat:token', handleToken)
      ipcRenderer.off('chat:done', handleDone)
    }
  }, [agentASessionId, agentBSessionId])

  // Check completion
  useEffect(() => {
    if (agentAStatus === 'done' && agentBStatus === 'done' && !hasCompletedRef.current) {
      hasCompletedRef.current = true
      const agentAVerdict = inferVerdict(agentAText)
      const agentBVerdict = inferVerdict(agentBText)
      onComplete({ a: agentAVerdict, b: agentBVerdict })
    }
  }, [agentAStatus, agentBStatus, agentAText, agentBText, onComplete])

  return (
    <div className="h-64 border-t border-copernicus-steel bg-[#0D0D0D] flex flex-col">
      <div className="flex items-center justify-between px-3 py-2 border-b border-copernicus-steel bg-[#111]">
        <div className="flex items-center gap-4">
            <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">
                Agent Review Panel
            </span>
            {agentAStatus === 'done' && agentBStatus === 'done' && (
                <span className="text-[10px] text-zinc-400 animate-pulse">
                    Consensus Reached
                </span>
            )}
        </div>
        <div className="flex gap-2">
            {(agentAStatus !== 'done' || agentBStatus !== 'done') && (
                <span className="text-[10px] text-copernicus-phosphor animate-pulse">
                    Reviewing...
                </span>
            )}
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Agent A Column */}
        <div className="flex-1 border-r border-copernicus-steel flex flex-col min-w-0">
          <div className="flex items-center justify-between px-3 py-1.5 bg-[#0A0A0A] border-b border-copernicus-steel/50">
            <span className="text-[11px] font-medium text-zinc-300">{agentALabel}</span>
            {agentAStatus === 'done' && <VerdictBadge verdict={inferVerdict(agentAText)} />}
          </div>
          <div
            ref={agentARef}
            className="flex-1 overflow-y-auto p-3 font-mono text-[11px] text-zinc-400 whitespace-pre-wrap leading-relaxed"
          >
            {agentAText || <span className="text-zinc-700 italic">Waiting for analysis...</span>}
          </div>
        </div>

        {/* Agent B Column */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex items-center justify-between px-3 py-1.5 bg-[#0A0A0A] border-b border-copernicus-steel/50">
            <span className="text-[11px] font-medium text-zinc-300">{agentBLabel}</span>
            {agentBStatus === 'done' && <VerdictBadge verdict={inferVerdict(agentBText)} />}
          </div>
          <div
            ref={agentBRef}
            className="flex-1 overflow-y-auto p-3 font-mono text-[11px] text-zinc-400 whitespace-pre-wrap leading-relaxed"
          >
            {agentBText || <span className="text-zinc-700 italic">Waiting for analysis...</span>}
          </div>
        </div>
      </div>
    </div>
  )
}
