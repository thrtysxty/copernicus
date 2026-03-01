import React, { useState, useEffect, useRef } from 'react'
import { Loader2, Send } from 'lucide-react'
import { useIpcError } from '../../hooks/useIpcError'
import log from '../../utils/logger'

interface GeminiPanelProps {
  sessionId: string
}

export const GeminiPanel: React.FC<GeminiPanelProps> = ({ sessionId }) => {
  const invoke = useIpcError()
  const [output, setOutput] = useState('')
  const [input, setInput] = useState('')
  const [isBusy, setIsBusy] = useState(false)
  const outputRef = useRef<HTMLPreElement>(null)

  // Stream output chunks from main process
  useEffect(() => {
    const unlisten = window.ipcRenderer.on(
      'gemini:output',
      (_e: Electron.IpcRendererEvent, payload: { sessionId: string; chunk: string }) => {
        if (payload.sessionId !== sessionId) return
        setOutput(prev => prev + payload.chunk)
      }
    )
    return unlisten
  }, [sessionId])

  // Auto-scroll to bottom on new output
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight
    }
  }, [output])

  const handleSend = async () => {
    const text = input.trim()
    if (!text || isBusy) return
    setInput('')
    setIsBusy(true)
    try {
      await invoke('gemini:send-prompt', { sessionId, text })
    } catch (e) {
      log.error('[GeminiPanel] send-prompt failed', e)
    } finally {
      setIsBusy(false)
    }
  }

  return (
    <div className="flex flex-col h-full bg-copernicus-bg font-mono">
      {/* Output area */}
      <pre
        ref={outputRef}
        className="flex-1 overflow-y-auto p-3 text-[11px] text-zinc-300 whitespace-pre-wrap leading-relaxed"
      >
        {output || <span className="text-zinc-600">Gemini session starting…</span>}
      </pre>

      {/* Prompt input bar */}
      <div className="flex items-center gap-2 px-3 py-2 border-t border-copernicus-steel bg-black/30 flex-shrink-0">
        {isBusy ? (
          <Loader2 size={12} className="animate-spin text-copernicus-phosphor flex-shrink-0" />
        ) : (
          <span className="text-copernicus-phosphor text-[11px] select-none flex-shrink-0">❯</span>
        )}
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleSend() }}
          disabled={isBusy}
          placeholder={isBusy ? 'Waiting for Gemini…' : 'Send a prompt…'}
          className="flex-1 bg-transparent text-[11px] text-zinc-200 placeholder-zinc-600 focus:outline-none"
          autoFocus
        />
        <button
          onClick={handleSend}
          disabled={isBusy || !input.trim()}
          className="text-zinc-600 hover:text-copernicus-phosphor disabled:opacity-30 transition-colors"
          title="Send (Enter)"
        >
          <Send size={12} />
        </button>
      </div>
    </div>
  )
}
