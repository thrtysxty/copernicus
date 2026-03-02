import React, { useState, useEffect, useRef, useCallback } from 'react'
import { ExternalLink, RefreshCw, ChevronLeft, ChevronRight, Globe, X } from 'lucide-react'
import { useIpcError } from '../../hooks/useIpcError'
import { useLayoutStore } from '../../store/layout'
import log from '../../utils/logger'

interface JulesSession {
  id: string
  story_id: string
  repo: string
  branch: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  pr_url?: string
  pr_number?: number
  started_at: string
}

// ─── Sessions list (rendered in terminal drawer) ──────────────────────────────
export const JulesPanel: React.FC = () => {
  const invoke = useIpcError()
  const { setJulesDialogOpen } = useLayoutStore()
  const [sessions, setSessions] = useState<JulesSession[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const result = await invoke<any>('jules:list-sessions')
      const data = result.data || result
      if (Array.isArray(data)) setSessions(data)
      else if (result.ok && Array.isArray(result.data)) setSessions(result.data)
    } catch (e) {
      log.error('Failed to load Jules sessions', e)
    } finally {
      setLoading(false)
    }
  }, [invoke])

  useEffect(() => { load() }, [load])

  const STATUS_COLORS: Record<JulesSession['status'], string> = {
    pending:   'bg-zinc-700 text-zinc-300',
    running:   'bg-copernicus-phosphor/20 text-copernicus-phosphor animate-pulse',
    completed: 'bg-green-900/40 text-green-400',
    failed:    'bg-red-900/40 text-red-400',
  }

  return (
    <div className="w-full h-full flex flex-col bg-copernicus-bg">
      <div className="h-8 flex items-center justify-between px-3 border-b border-copernicus-steel bg-copernicus-bg flex-shrink-0">
        <span className="text-sm vt-label tracking-widest text-copernicus-phosphor uppercase">
          Jules_Sessions
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            className="text-zinc-500 hover:text-zinc-200 transition-colors"
            title="Refresh"
          >
            <RefreshCw size={11} />
          </button>
          <button
            onClick={() => setJulesDialogOpen(true)}
            className="text-zinc-500 hover:text-copernicus-phosphor transition-colors"
            title="Open jules.google.com in canvas"
          >
            <Globe size={11} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="p-4 text-[10px] text-zinc-600 font-mono animate-pulse">LOADING_SESSIONS...</div>
        ) : sessions.length === 0 ? (
          <div className="p-6 text-center text-zinc-600 text-[11px] font-mono leading-relaxed">
            No Jules sessions yet.<br />
            <span className="text-zinc-700 text-[9px]">Dispatch from a story card in the Kanban board.</span>
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead className="bg-zinc-900/50 text-[9px] uppercase text-zinc-600 font-bold sticky top-0">
              <tr>
                <th className="p-2 pl-3">Story</th>
                <th className="p-2">Status</th>
                <th className="p-2">Branch</th>
                <th className="p-2">PR</th>
                <th className="p-2 text-right pr-3">Started</th>
              </tr>
            </thead>
            <tbody className="text-[10px] font-mono">
              {sessions.map(s => (
                <tr key={s.id} className="border-b border-zinc-800/40 hover:bg-white/5 transition-colors">
                  <td className="p-2 pl-3 text-copernicus-phosphor">{s.story_id || '—'}</td>
                  <td className="p-2">
                    <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${STATUS_COLORS[s.status]}`}>
                      {s.status.toUpperCase()}
                    </span>
                  </td>
                  <td className="p-2 text-zinc-500 truncate max-w-[120px]" title={s.branch}>{s.branch || '—'}</td>
                  <td className="p-2">
                    {s.pr_url ? (
                      <button
                        onClick={() => (window as any).ipcRenderer.invoke('app:open-external', s.pr_url)}
                        className="text-copernicus-phosphor hover:underline flex items-center gap-1"
                      >
                        <ExternalLink size={9} />
                        #{s.pr_number || 'PR'}
                      </button>
                    ) : '—'}
                  </td>
                  <td className="p-2 text-right pr-3 text-zinc-600">
                    {new Date(s.started_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

// ─── Full-canvas Jules browser (rendered in main canvas overlay) ──────────────
export const JulesCanvasDialog: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const webviewRef = useRef<any>(null)
  const [url, setUrl] = useState('https://jules.google.com')
  const [loading, setLoading] = useState(false)
  const [canGoBack, setCanGoBack] = useState(false)
  const [canGoForward, setCanGoForward] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    const wv = webviewRef.current
    if (!wv || !mounted) return

    const onNavigate = (e: any) => {
      setUrl(e.url)
      setCanGoBack(wv.canGoBack())
      setCanGoForward(wv.canGoForward())
    }
    const onStart = () => setLoading(true)
    const onStop  = () => setLoading(false)

    wv.addEventListener('did-navigate', onNavigate)
    wv.addEventListener('did-navigate-in-page', onNavigate)
    wv.addEventListener('did-start-loading', onStart)
    wv.addEventListener('did-stop-loading', onStop)

    return () => {
      wv.removeEventListener('did-navigate', onNavigate)
      wv.removeEventListener('did-navigate-in-page', onNavigate)
      wv.removeEventListener('did-start-loading', onStart)
      wv.removeEventListener('did-stop-loading', onStop)
    }
  }, [mounted])

  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-copernicus-bg border-t border-copernicus-phosphor/20">
      {/* Browser chrome */}
      <div className="h-9 flex items-center gap-1 px-2 border-b border-copernicus-steel bg-[#080808] flex-shrink-0">
        <button
          onClick={onClose}
          className="text-zinc-500 hover:text-copernicus-phosphor transition-colors p-1"
          title="Close Jules"
        >
          <X size={12} />
        </button>
        <div className="w-px h-4 bg-zinc-800 mx-1" />
        <button
          onClick={() => webviewRef.current?.goBack()}
          disabled={!canGoBack}
          className="p-1 text-zinc-500 hover:text-zinc-200 disabled:opacity-30 transition-colors"
        >
          <ChevronLeft size={13} />
        </button>
        <button
          onClick={() => webviewRef.current?.goForward()}
          disabled={!canGoForward}
          className="p-1 text-zinc-500 hover:text-zinc-200 disabled:opacity-30 transition-colors"
        >
          <ChevronRight size={13} />
        </button>
        <button
          onClick={() => webviewRef.current?.reload()}
          className={`p-1 text-zinc-500 hover:text-zinc-200 transition-colors ${loading ? 'animate-spin text-copernicus-phosphor' : ''}`}
          title="Reload"
        >
          <RefreshCw size={11} />
        </button>
        <div className="flex-1 mx-2 px-2 py-0.5 bg-zinc-900 border border-zinc-800 text-[9px] font-mono text-zinc-500 truncate">
          {url}
        </div>
        <span className="text-sm vt-label tracking-widest text-copernicus-phosphor/60 mr-1">JULES_BROWSER</span>
      </div>

      {/* Webview */}
      <div className="flex-1 relative bg-[#050505]">
        {!mounted ? (
          <div className="absolute inset-0 flex items-center justify-center text-zinc-700 text-[10px] font-mono animate-pulse">
            INIT_SESSION...
          </div>
        ) : (
          <webview
            ref={webviewRef}
            src="https://jules.google.com"
            partition="persist:jules"
            allowpopups="true"
            className="w-full h-full"
            style={{ display: 'flex' }}
          />
        )}
      </div>
    </div>
  )
}
