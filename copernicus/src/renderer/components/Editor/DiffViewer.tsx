import React, { useState } from 'react'
import { DiffEditor } from '@monaco-editor/react'
import { useLayoutStore } from '../../store/layout'
import { ReviewPanel, Verdict } from './ReviewPanel'

const ipcRenderer = (window as any).ipcRenderer

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
  const { reviewEnabled } = useLayoutStore()
  const [reviewState, setReviewState] = useState<'idle' | 'reviewing' | 'done'>('idle')
  const [sessionIds, setSessionIds] = useState<{ claude: string; gemini: string } | null>(null)
  const [verdicts, setVerdicts] = useState<{ claude: Verdict; gemini: Verdict } | null>(null)

  const handleApply = async () => {
    if (!reviewEnabled) {
      onConfirm()
      return
    }

    // Start Review
    const ts = Date.now()
    const claudeId = `review-claude-${ts}`
    const geminiId = `review-gemini-${ts}`
    setSessionIds({ claude: claudeId, gemini: geminiId })
    setReviewState('reviewing')

    // Sending modified content as diff isn't easily available as text diff, or should I send both?
    // Actually, sending just modified content is often enough, but for a true diff review, I should send the diff.
    // Since I don't have the diff text readily available (Monaco computes it), I'll send the modified file content and ask for a review of it.
    // Or better: "Review the following code change." + modified.
    // The requirement says: "Gemini session: same prompt, same diff".
    // I'll send: "Original:\n" + original + "\n\nModified:\n" + modified
    
    const content = `Please review this code change.\n\nORIGINAL:\n${original}\n\nMODIFIED:\n${modified}\n\n[REVIEW] Does this change look correct? List any concerns.`

    // Fire requests
    ipcRenderer.invoke('chat:send', {
      sessionId: claudeId,
      model: 'claude-3-5-sonnet-20240620',
      messages: [{ role: 'user', content }]
    })

    ipcRenderer.invoke('chat:send', {
      sessionId: geminiId,
      model: 'gemini-1.5-pro',
      messages: [{ role: 'user', content }]
    })
  }

  const handleConfirm = async () => {
    if (reviewEnabled && reviewState === 'done' && verdicts) {
      await ipcRenderer.invoke('review:log', {
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
              Apply Changes
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
                    claudeSessionId={sessionIds.claude}
                    geminiSessionId={sessionIds.gemini}
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
