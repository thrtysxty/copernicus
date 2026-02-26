import React, { useEffect, useState, useRef } from 'react'

const ipcRenderer = window.ipcRenderer

export type Verdict = 'APPROVE' | 'WARN' | 'REJECT'

interface ReviewPanelProps {
  claudeSessionId: string
  geminiSessionId: string
  onComplete: (verdicts: { claude: Verdict; gemini: Verdict }) => void
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
  claudeSessionId,
  geminiSessionId,
  onComplete,
}) => {
  const [claudeText, setClaudeText] = useState('')
  const [geminiText, setGeminiText] = useState('')
  const [claudeStatus, setClaudeStatus] = useState<AgentStatus>('pending')
  const [geminiStatus, setGeminiStatus] = useState<AgentStatus>('pending')

  const claudeRef = useRef<HTMLDivElement>(null)
  const geminiRef = useRef<HTMLDivElement>(null)
  const hasCompletedRef = useRef(false)

  // Reset state on new session
  useEffect(() => {
    setClaudeText('')
    setGeminiText('')
    setClaudeStatus('pending')
    setGeminiStatus('pending')
    hasCompletedRef.current = false
  }, [claudeSessionId, geminiSessionId])

  // Auto-scroll
  useEffect(() => {
    if (claudeRef.current) claudeRef.current.scrollTop = claudeRef.current.scrollHeight
  }, [claudeText])

  useEffect(() => {
    if (geminiRef.current) geminiRef.current.scrollTop = geminiRef.current.scrollHeight
  }, [geminiText])

  useEffect(() => {
    const handleToken = (_event: any, { sessionId, token }: { sessionId: string; token: string }) => {
      if (sessionId === claudeSessionId) {
        setClaudeStatus('streaming')
        setClaudeText(prev => prev + token)
      } else if (sessionId === geminiSessionId) {
        setGeminiStatus('streaming')
        setGeminiText(prev => prev + token)
      }
    }

    const handleDone = (_event: any, { sessionId }: { sessionId: string }) => {
      if (sessionId === claudeSessionId) {
        setClaudeStatus('done')
      } else if (sessionId === geminiSessionId) {
        setGeminiStatus('done')
      }
    }

    ipcRenderer.on('chat:token', handleToken)
    ipcRenderer.on('chat:done', handleDone)

    return () => {
      ipcRenderer.off('chat:token', handleToken)
      ipcRenderer.off('chat:done', handleDone)
    }
  }, [claudeSessionId, geminiSessionId])

  // Check completion
  useEffect(() => {
    if (claudeStatus === 'done' && geminiStatus === 'done' && !hasCompletedRef.current) {
      hasCompletedRef.current = true
      const claudeVerdict = inferVerdict(claudeText)
      const geminiVerdict = inferVerdict(geminiText)
      onComplete({ claude: claudeVerdict, gemini: geminiVerdict })
    }
  }, [claudeStatus, geminiStatus, claudeText, geminiText, onComplete])

  return (
    <div className="h-64 border-t border-copernicus-steel bg-[#0D0D0D] flex flex-col">
      <div className="flex items-center justify-between px-3 py-2 border-b border-copernicus-steel bg-[#111]">
        <div className="flex items-center gap-4">
            <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">
                Agent Review Panel
            </span>
            {claudeStatus === 'done' && geminiStatus === 'done' && (
                <span className="text-[10px] text-zinc-400 animate-pulse">
                    Consensus Reached
                </span>
            )}
        </div>
        <div className="flex gap-2">
            {(claudeStatus !== 'done' || geminiStatus !== 'done') && (
                <span className="text-[10px] text-copernicus-phosphor animate-pulse">
                    Reviewing...
                </span>
            )}
        </div>
      </div>
      
      <div className="flex-1 flex overflow-hidden">
        {/* Claude Column */}
        <div className="flex-1 border-r border-copernicus-steel flex flex-col min-w-0">
          <div className="flex items-center justify-between px-3 py-1.5 bg-[#0A0A0A] border-b border-copernicus-steel/50">
            <span className="text-[11px] font-medium text-zinc-300">Claude 3.5 Sonnet</span>
            {claudeStatus === 'done' && <VerdictBadge verdict={inferVerdict(claudeText)} />}
          </div>
          <div 
            ref={claudeRef}
            className="flex-1 overflow-y-auto p-3 font-mono text-[11px] text-zinc-400 whitespace-pre-wrap leading-relaxed"
          >
            {claudeText || <span className="text-zinc-700 italic">Waiting for analysis...</span>}
          </div>
        </div>

        {/* Gemini Column */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex items-center justify-between px-3 py-1.5 bg-[#0A0A0A] border-b border-copernicus-steel/50">
            <span className="text-[11px] font-medium text-zinc-300">Gemini 1.5 Pro</span>
            {geminiStatus === 'done' && <VerdictBadge verdict={inferVerdict(geminiText)} />}
          </div>
          <div 
            ref={geminiRef}
            className="flex-1 overflow-y-auto p-3 font-mono text-[11px] text-zinc-400 whitespace-pre-wrap leading-relaxed"
          >
            {geminiText || <span className="text-zinc-700 italic">Waiting for analysis...</span>}
          </div>
        </div>
      </div>
    </div>
  )
}
