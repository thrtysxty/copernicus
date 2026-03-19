import React, { useState, useEffect } from 'react'
import { DiffEditor } from '@monaco-editor/react'
import { useLayoutStore } from '../../store/layout'
import { ReviewPanel, Verdict } from './ReviewPanel'
import { useIpcError } from '../../hooks/useIpcError'
import { unwrapIpc } from '../../types/ipc'

interface DiffViewerProps {
  original: string
  modified: string
  language: string
  onConfirm: () => void
  onCancel: () => void
}

export const DiffViewer: React.FC<DiffViewerProps> = ({
  original,
  modified,
  language,
  onConfirm,
  onCancel,
}) => {
  const invoke = useIpcError()
  const { reviewEnabled } = useLayoutStore()
  const [reviewState, setReviewState] = useState<'idle' | 'reviewing' | 'done'>('idle')
  const [sessionIds, setSessionIds] = useState<{ a: string; b: string } | null>(null)
  const [verdicts, setVerdicts] = useState<{ a: Verdict; b: Verdict } | null>(null)
  const [availableModels, setAvailableModels] = useState<Array<{ id: string; name: string }>>([])
  const [modelA, setModelA] = useState('')
  const [modelB, setModelB] = useState('')

  useEffect(() => {
    const fetchModels = async () => {
      const models = unwrapIpc(await invoke('models:list')) as Array<{ id: string; name: string }>
      setAvailableModels(models)
      setModelA(models[0]?.id ?? '')
      setModelB(models[1]?.id ?? models[0]?.id ?? '')
    }
    fetchModels()
  }, [invoke])

  const handleApply = async () => {
    if (!reviewEnabled) {
      onConfirm()
      return
    }

    const ts = Date.now()
    const agentAId = `review-a-${ts}`
    const agentBId = `review-b-${ts}`
    setSessionIds({ a: agentAId, b: agentBId })
    setReviewState('reviewing')

    const content = `Please review this code change.\n\nORIGINAL:\n${original}\n\nMODIFIED:\n${modified}\n\n[REVIEW] Does this change look correct? List any concerns.`

    invoke('chat:send', {
      sessionId: agentAId,
      model: modelA,
      messages: [{ role: 'user', content }]
    })

    invoke('chat:send', {
      sessionId: agentBId,
      model: modelB,
      messages: [{ role: 'user', content }]
    })
  }

  const handleConfirm = async () => {
    if (reviewEnabled && reviewState === 'done' && verdicts) {
      await invoke('review:log', {
        original,
        modified,
        verdicts
      })
    }
    onConfirm()
  }

  return (
    <div className="fixed inset-0 bg-black/80 z-[100] flex flex-col">
      <div className="flex items-center justify-between p-3 bg-[#0A0A0A] border-b border-copernicus-steel">
        <span className="text-xs font-mono text-copernicus-phosphor uppercase tracking-widest">
          DIFF PREVIEW — Review before applying
        </span>
        {reviewEnabled && reviewState === 'idle' && (
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-500">Reviewer A</span>
              <select
                className="text-xs bg-zinc-800 text-zinc-300 rounded px-2 py-1 border border-zinc-700"
                value={modelA}
                onChange={(e) => setModelA(e.target.value)}
              >
                {availableModels.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
            {availableModels.length >= 2 ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-500">Reviewer B</span>
                <select
                  className="text-xs bg-zinc-800 text-zinc-300 rounded px-2 py-1 border border-zinc-700"
                  value={modelB}
                  onChange={(e) => setModelB(e.target.value)}
                >
                  {availableModels.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <span className="text-xs text-zinc-500">Configure a second provider in Settings</span>
            )}
          </div>
        )}
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="text-xs px-3 py-1 rounded bg-zinc-700 text-zinc-300 hover:bg-zinc-600 transition-colors"
          >
            Cancel
          </button>

          {reviewEnabled && reviewState === 'reviewing' && (
             <span className="text-xs px-3 py-1 text-zinc-500 animate-pulse">
               Agents Reviewing...
             </span>
          )}

          {reviewEnabled && reviewState === 'done' ? (
             <div className="flex gap-2">
                <button
                  onClick={onConfirm} // Skip logging if skipping? Requirement says "User can override and skip". "Confirm Apply" activates only after both reviews complete.
                  // If "Skip & Confirm", maybe I should just call onConfirm without logging?
                  // Requirement: "Add Skip & Confirm link for manual override"
                  // "Confirm Apply button activates only after both reviews complete"
                  // So the main button is "Confirm Apply" which does logging.
                  className="text-xs px-3 py-1 rounded text-zinc-500 hover:text-zinc-300 transition-colors mr-2"
                >
                  Skip & Confirm
                </button>
                <button
                  onClick={handleConfirm}
                  className="text-xs px-3 py-1 rounded bg-copernicus-phosphor/20 text-copernicus-phosphor hover:bg-copernicus-phosphor/30 transition-colors"
                >
                  Confirm Apply
                </button>
             </div>
          ) : (
            <button
              onClick={handleApply}
              disabled={reviewEnabled && reviewState === 'reviewing'} // Hide button or disable? "Confirm Apply" button activates only after both reviews complete
              // Wait, before review starts, the button is "Apply Changes".
              // After review starts, it should wait.
              className={`text-xs px-3 py-1 rounded transition-colors ${
                 reviewEnabled && reviewState !== 'idle'
                 ? 'hidden' // Hide initial apply button during/after review
                 : 'bg-copernicus-phosphor/20 text-copernicus-phosphor hover:bg-copernicus-phosphor/30'
              }`}
            >
              {reviewEnabled ? 'Start Review' : 'Apply Changes'}
            </button>
          )}

          {/* Skip link for reviewing state */}
          {reviewEnabled && reviewState === 'reviewing' && (
             <button
               onClick={onConfirm}
               className="text-xs px-3 py-1 rounded text-zinc-500 hover:text-zinc-300 transition-colors"
             >
               Skip & Confirm
             </button>
          )}
        </div>
      </div>

      {/* Editor Area */}
      <div className="flex-1 relative">
        {/* We need to manage layout. DiffEditor takes 100%. ReviewPanel takes fixed height. */}
        <div className="absolute inset-0 flex flex-col">
            <div className="flex-1 overflow-hidden">
                <DiffEditor
                  height="100%"
                  theme="vs-dark"
                  language={language}
                  original={original}
                  modified={modified}
                  options={{
                    renderSideBySide: true,
                    readOnly: true,
                    fontSize: 12,
                    minimap: { enabled: false },
                    scrollBeyondLastLine: false,
                    automaticLayout: true,
                  }}
                />
            </div>
            {(reviewState === 'reviewing' || reviewState === 'done') && sessionIds && (
                <ReviewPanel
                    agentASessionId={sessionIds.a}
                    agentBSessionId={sessionIds.b}
                    agentALabel={availableModels.find(m => m.id === modelA)?.name ?? modelA}
                    agentBLabel={availableModels.find(m => m.id === modelB)?.name ?? modelB}
                    onComplete={(v) => {
                        setVerdicts(v)
                        setReviewState('done')
                    }}
                />
            )}
        </div>
      </div>
    </div>
  )
}
