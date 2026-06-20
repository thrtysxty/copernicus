import React, { useEffect, useState } from 'react'
import { useIpcError } from '../../hooks/useIpcError'
import { IpcResult } from '../../types/ipc'
// Types based on the DB schema
export interface RetroReport {
  id: string
  project_id: string
  scope: string
  status: 'draft' | 'pending_review' | 'approved' | 'archived'
  ts_generated: number
  ts_approved: number | null
  sessions_range: string // JSON: { from_ts, to_ts, session_count }
  inflection_ids: string | null // JSON array of prior retro_report IDs
  items?: RetroItem[] // Populated via retro:get
}

export interface RetroItem {
  id: string
  retro_id: string
  item_type: 'memory_fact' | 'file_patch' | 'story_queue' | 'convention'
  content: string
  target: string | null
  importance: number | null
  supersedes_memory_id: string | null
  status: 'pending' | 'approved' | 'rejected' | 'edited'
  edited_content: string | null
  ts: number
}

function formatDate(tsMs: number) {
  return new Date(tsMs).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function RetroItemRow({ item }: { item: RetroItem }) {
  const isRejected = item.status === 'rejected'
  const isApprovedOrEdited = item.status === 'approved' || item.status === 'edited'
  const content = item.edited_content || item.content

  return (
    <div className={`p-2 border-b border-zinc-800/40 last:border-b-0 text-[11px] ${isRejected ? 'opacity-50' : ''}`}>
      <div className="flex items-center gap-2 mb-1">
        <span className="uppercase text-[11px] font-bold text-zinc-500 tracking-wider">
          {item.item_type.replace('_', ' ')}
        </span>
        <span className={`px-1.5 py-0.5 rounded-full text-[11px] font-bold uppercase ${
          isRejected ? 'bg-zinc-800 text-zinc-400 line-through' : 
          isApprovedOrEdited ? 'bg-copernicus-phosphor/20 text-copernicus-phosphor' : 
          'bg-zinc-800 text-zinc-300'
        }`}>
          {item.status}
        </span>
      </div>
      <div className={`font-mono leading-relaxed whitespace-pre-wrap ${isRejected ? 'line-through text-zinc-500' : 'text-zinc-300'}`}>
        {content}
      </div>
    </div>
  )
}

function RetroReportCard({ report }: { report: RetroReport }) {
  const invoke = useIpcError()
  const [expanded, setExpanded] = useState(false)
  const [items, setItems] = useState<RetroItem[]>([])
  const [loading, setLoading] = useState(false)

  const handleExpand = async () => {
    if (expanded) {
      setExpanded(false)
      return
    }
    setLoading(true)
    const res = await invoke<IpcResult<RetroReport>>('retro:get', report.id)
    if (res.ok && res.data?.items) {
      setItems(res.data.items)
    }
    setLoading(false)
    setExpanded(true)
  }

  // Parse JSON fields
  const range = JSON.parse(report.sessions_range) as { from_ts: number, to_ts: number, session_count: number }
  const inflections = report.inflection_ids ? JSON.parse(report.inflection_ids) as string[] : []
  
  // Calculate item counts based on loaded items if available
  // To avoid needing to load all items just for counts, the AC states:
  // Item counts and approval rate ("5 items · 4 approved")
  // Since we don't have this in the summary from listRetroReports, we might have to fetch it or we can just compute it when expanded?
  // Actually, wait, the db schema does not store aggregated item counts in `retro_reports`. 
  // Let's check how the AC expects this to be handled.
  
  // Actually, if we fetch all items, we can show it. But initially `items` might be empty.
  // Wait, let's look at getRetroReport, it returns items. `listRetroReports` does not join `retro_items`.
  // So we may need to fetch the items immediately, or just let's see if there are other ways.
  // I'll fetch it lazily but show loading for counts if not loaded.
  
  const fromDate = formatDate(range.from_ts)
  const toDate = formatDate(range.to_ts)

  return (
    <div className="bg-[#0A0A0A] border border-zinc-800 mb-4 overflow-hidden">
      <div className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="text-zinc-200 font-bold mb-1">
            {fromDate} &ndash; {toDate}
          </div>
          <div className="text-[11px] text-zinc-500 flex items-center gap-2">
            <span>across {range.session_count} sessions</span>
          </div>
          
          {inflections.length > 0 && (
            <div className="mt-2 text-[11px] text-zinc-500 flex items-center gap-2 flex-wrap">
              <span>Built on:</span>
              {inflections.map((inflectionId, idx) => (
                <React.Fragment key={inflectionId}>
                  {idx > 0 && <span>&rarr;</span>}
                  <span className="px-1.5 py-0.5 bg-zinc-800 text-zinc-300 rounded font-mono text-[11px]" title={inflectionId}>
                    {inflectionId.replace('retro_', '').slice(0, 8)}...
                  </span>
                </React.Fragment>
              ))}
            </div>
          )}
        </div>
        
        <div>
          <button 
            onClick={handleExpand}
            disabled={loading}
            className="px-3 py-1 bg-white/5 hover:bg-white/10 text-zinc-300 text-[11px] font-bold tracking-widest uppercase transition-colors rounded"
          >
            {loading ? 'Loading...' : expanded ? 'Hide' : 'View'}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-zinc-800 bg-black/40 p-4">
          <div className="mb-4 text-[11px] text-zinc-500 uppercase tracking-widest font-bold">
            {items.length} items &middot; {items.filter(i => i.status === 'approved' || i.status === 'edited').length} approved
          </div>
          
          <div className="space-y-4">
            {['memory_fact', 'file_patch', 'story_queue', 'convention'].map(type => {
              const typeItems = items.filter(i => i.item_type === type)
              if (typeItems.length === 0) return null
              
              return (
                <div key={type} className="border border-zinc-800/50 rounded bg-[#0A0A0A]">
                  <div className="bg-zinc-900/50 px-3 py-2 border-b border-zinc-800/50 text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                    {type.replace('_', ' ')}s
                  </div>
                  <div>
                    {typeItems.map(item => (
                      <RetroItemRow key={item.id} item={item} />
                    ))}
                  </div>
                </div>
              )
            })}
            
            {items.length === 0 && (
              <div className="text-center p-4 text-[11px] text-zinc-500 italic">
                No items in this retrospective.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export const RetroArchiveView: React.FC = () => {
  const invoke = useIpcError()
  const projectId = 'default'
  
  const [reports, setReports] = useState<RetroReport[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)

  const fetchReports = async () => {
    setLoading(true)
    const res = await invoke<IpcResult<RetroReport[]>>('retro:list', projectId)
    if (res.ok && res.data) {
      // Filter only approved/archived reports as per AC #6
      const validReports = (res.data as RetroReport[]).filter(r => r.status === 'approved' || r.status === 'archived')
      setReports(validReports)
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchReports()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])

  const handleGenerate = async () => {
    setGenerating(true)
    const res = await invoke<IpcResult<{ retroId: string }>>('retro:generate', {
      projectId,
      scope: 'project',
      fromTs: 0,
      toTs: Date.now()
    })
    setGenerating(false)
    if (res.ok) {
      fetchReports()
    }
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center h-full text-zinc-500 text-xs italic">
        Loading retrospectives...
      </div>
    )
  }

  if (reports.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center h-full p-8 text-center">
        <div className="text-zinc-500 text-xs italic mb-4 max-w-sm">
          No retrospectives yet. Retros are generated automatically after 20 sessions.
        </div>
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="px-4 py-2 bg-copernicus-phosphor text-[#050505] text-[11px] font-bold uppercase tracking-widest rounded-none hover:bg-copernicus-phosphor/90 transition-colors"
        >
          {generating ? 'Generating...' : 'Generate Now'}
        </button>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 max-h-full">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-6 border-b border-zinc-800 pb-2">
          Retrospective Archive
        </h2>
        
        <div className="space-y-4">
          {reports.map(report => (
            <RetroReportCard key={report.id} report={report} />
          ))}
        </div>
      </div>
    </div>
  )
}
