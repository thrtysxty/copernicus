import React, { useState, useEffect, useCallback } from 'react'
import { ExternalLink, RefreshCw } from 'lucide-react'
import { useIpcError } from '../../hooks/useIpcError'
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
        <span className="text-[10px] font-mono tracking-widest text-copernicus-phosphor uppercase">
          Jules_Sessions
        </span>
        <button
          onClick={load}
          className="text-zinc-500 hover:text-zinc-200 transition-colors"
          title="Refresh"
        >
          <RefreshCw size={11} />
        </button>
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
                        onClick={() => invoke('app:open-external', s.pr_url)}
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

