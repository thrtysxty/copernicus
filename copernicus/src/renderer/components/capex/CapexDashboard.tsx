import React, { useEffect, useRef, useState } from 'react'
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  RadialBarChart, RadialBar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import { Download, Play, RefreshCw, Maximize2, Minimize2 } from 'lucide-react'
import { useIpcError } from '../../hooks/useIpcError'
import { useToastStore } from '../../store/toastStore'
import { CHART_THEME } from './chart-theme'
import { unwrapIpc } from '../../types/ipc'

// ── Types ──────────────────────────────────────────────────────────────────

interface CapexReportRow {
  story_id: string; component: string; financial_category: string
  total_hours: number; session_count: number; start_date: string; end_date: string
}
interface TestRunRecord {
  id: number; run_at: string; total_tests: number; passed: number
  failed: number; skipped: number; coverage_pct: number | null; duration_ms: number | null
}
interface WeeklyVelocity { week: string; hours: number; stories: number }
interface DailyCost      { day: string; total_cost: number; total_tokens: number }
interface CostByModel    { model_id: string; provider: string; total_cost: number; call_count: number }
interface CostByStory    { story_id: string; total_cost: number; call_count: number; total_tokens: number }
interface Throughput     { week: string; completed: number }
interface StatusDist     { status: string; count: number }
interface BugsByAssignee { assignee: string; bug_count: number }

type DashTab = 'financial' | 'quality' | 'llm' | 'velocity'
const TABS: { id: DashTab; label: string }[] = [
  { id: 'financial', label: 'FINANCIAL' },
  { id: 'quality',   label: 'QUALITY'   },
  { id: 'llm',       label: 'LLM'       },
  { id: 'velocity',  label: 'VELOCITY'  },
]

// ── Components ─────────────────────────────────────────────────────────────

function SummaryCard({ title, value, accent }: { title: string; value: string; accent?: boolean }) {
  return (
    <div className="bg-[#0A0A0A] border border-zinc-800 p-4 flex flex-col gap-1">
      <span className="text-[10px] uppercase text-zinc-500 tracking-wider">{title}</span>
      <span className={`text-2xl font-mono font-bold ${accent ? 'text-copernicus-phosphor phosphor-glow' : 'text-zinc-200'}`}>{value}</span>
    </div>
  )
}

function MiniStat({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[9px] uppercase text-zinc-600 tracking-wider">{label}</span>
      <span className="text-lg font-mono font-bold" style={{ color: color ?? CHART_THEME.text }}>{value}</span>
    </div>
  )
}

function EmptyState({ msg }: { msg: string }) {
  return <div className="flex items-center justify-center h-32 text-zinc-600 text-xs italic">{msg}</div>
}

function DashboardPanel({ 
  title, 
  id, 
  spotlightId, 
  setSpotlightId, 
  children,
  actions
}: { 
  title: string; 
  id: string; 
  spotlightId: string | null; 
  setSpotlightId: (id: string | null) => void;
  children: React.ReactNode;
  actions?: React.ReactNode;
}) {
  const isSpotlit = spotlightId === id
  const isHidden = spotlightId !== null && !isSpotlit

  if (isHidden) return null

  return (
    <div className={`bg-[#0A0A0A] border border-zinc-800 flex flex-col overflow-hidden transition-all duration-300 ${isSpotlit ? 'flex-1' : ''}`}>
      <header className="h-8 flex items-center justify-between px-3 border-b border-white/5 bg-black/20 shrink-0 group/dashpanel">
        <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">{title}</span>
        <div className="flex items-center gap-2 opacity-0 group-hover/dashpanel:opacity-100 transition-opacity">
          {actions}
          <button 
            onClick={() => setSpotlightId(isSpotlit ? null : id)} 
            className={`p-1 rounded ${isSpotlit ? 'text-copernicus-phosphor bg-copernicus-phosphor/10' : 'text-zinc-600 hover:text-zinc-300'}`}
            title={isSpotlit ? "Minimize" : "Spotlight"}
          >
            {isSpotlit ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
          </button>
        </div>
      </header>
      <div className={`p-4 overflow-hidden relative flex-1 ${isSpotlit ? 'flex-1' : ''}`}>
        {children}
      </div>
    </div>
  )
}

// ── Shared helpers ─────────────────────────────────────────────────────────

function exportToCsv(filename: string, headers: string[], rows: string[][]) {
  const content = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
  const blob = new Blob([content], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

const tooltipStyle = {
  contentStyle: { background: '#0A0A0A', border: `1px solid ${CHART_THEME.grid}`, fontSize: 11, color: '#e4e4e7' },
  labelStyle: { color: CHART_THEME.phosphor },
}

// ── Main Component ─────────────────────────────────────────────────────────

export const CapexDashboard: React.FC = () => {
  const invoke = useIpcError()
  const addToast = useToastStore(s => s.addToast)
  const loadedTabs = useRef<Set<DashTab>>(new Set())

  const [activeTab, setActiveTab] = useState<DashTab>('financial')
  const [rate, setRate] = useState(65)
  const [spotlightId, setSpotlightId] = useState<string | null>(null)

  // Financial
  const [report, setReport]               = useState<CapexReportRow[]>([])
  const [weeklyVelocity, setWeeklyVelocity] = useState<WeeklyVelocity[]>([])
  const [finLoading, setFinLoading]        = useState(false)

  // Quality
  const [testRuns, setTestRuns]            = useState<TestRunRecord[]>([])
  const [bugs, setBugs]                    = useState<BugsByAssignee[]>([])
  const [testRunning, setTestRunning]      = useState(false)

  // LLM
  const [dailyCosts, setDailyCosts]        = useState<DailyCost[]>([])
  const [costByModel, setCostByModel]      = useState<CostByModel[]>([])
  const [costByStory, setCostByStory]      = useState<CostByStory[]>([])
  const [totalCost, setTotalCost]          = useState(0)

  // Velocity
  const [throughput, setThroughput]        = useState<Throughput[]>([])
  const [statusDist, setStatusDist]        = useState<StatusDist[]>([])

  const fetchTabData = async (tab: DashTab) => {
    if (tab === 'financial') {
      setFinLoading(true)
      try {
        const [rep, vel] = await Promise.all([
          invoke<any>('devtime:report'),
          invoke<any>('devtime:weekly-velocity'),
        ])
        setReport(unwrapIpc<CapexReportRow[]>(rep) ?? [])
        setWeeklyVelocity(unwrapIpc<WeeklyVelocity[]>(vel) ?? [])
      } finally { setFinLoading(false) }
    }
    if (tab === 'quality') {
      const [hist, b] = await Promise.all([
        invoke<any>('devtime:test-history'),
        invoke<any>('stories:bugs-by-assignee'),
      ])
      setTestRuns(unwrapIpc<TestRunRecord[]>(hist) ?? [])
      setBugs(unwrapIpc<BugsByAssignee[]>(b) ?? [])
    }
    if (tab === 'llm') {
      const [daily, byModel, byStory] = await Promise.all([
        invoke<any>('ledger:daily-costs'),
        invoke<any>('ledger:cost-by-model'),
        invoke<any>('ledger:cost-by-story'),
      ])
      const dc = unwrapIpc<DailyCost[]>(daily) ?? []
      const bm = unwrapIpc<CostByModel[]>(byModel) ?? []
      const bs = unwrapIpc<CostByStory[]>(byStory) ?? []
      setDailyCosts(dc)
      setCostByModel(bm)
      setCostByStory(bs)
      if (Array.isArray(bm)) {
        setTotalCost(bm.reduce((s: number, r: CostByModel) => s + (r.total_cost ?? 0), 0))
      } else {
        setTotalCost(0)
      }
    }
    if (tab === 'velocity') {
      const [tp, sd] = await Promise.all([
        invoke<any>('stories:throughput'),
        invoke<any>('stories:status-distribution'),
      ])
      setThroughput(unwrapIpc<Throughput[]>(tp) ?? [])
      setStatusDist(unwrapIpc<StatusDist[]>(sd) ?? [])
    }
  }

  const activateTab = (tab: DashTab) => {
    setActiveTab(tab)
    setSpotlightId(null)
    if (!loadedTabs.current.has(tab)) {
      loadedTabs.current.add(tab)
      fetchTabData(tab)
    }
  }

  useEffect(() => {
    invoke<any>('settings:load').then(raw => {
      const s = unwrapIpc<any>(raw)
      const r = s?.capex?.rate ?? s?.developerRate
      if (typeof r === 'number' && r > 0) setRate(r)
    }).catch(() => {})
    loadedTabs.current.add('financial')
    fetchTabData('financial')
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const stats = report.reduce((acc, row) => {
    if (row.financial_category === 'CAPEX') acc.capexHours += row.total_hours
    else acc.opexHours += row.total_hours
    acc.totalSessions += row.session_count
    return acc
  }, { capexHours: 0, opexHours: 0, totalSessions: 0 })

  const totalHours = stats.capexHours + stats.opexHours
  const capPct = totalHours > 0 ? (stats.capexHours / totalHours) * 100 : 0

  const saveRate = (v: number) => {
    setRate(v)
    invoke('settings:save', { developerRate: v })
  }

  const latestRun = testRuns[0] ?? null
  const coveragePct = latestRun?.coverage_pct ?? 0
  const gaugeColor = coveragePct >= 80 ? CHART_THEME.phosphor : coveragePct >= 60 ? CHART_THEME.warn : CHART_THEME.danger

  const runTests = async () => {
    setTestRunning(true)
    try {
      const res = await invoke<any>('devtime:run-tests')
      const record = unwrapIpc<any>(res)
      setTestRuns(prev => [record, ...prev])
      addToast(`Tests complete: ${record.passed}/${record.total_tests} passed`, record.failed > 0 ? 'error' : 'success')
    } catch (e: any) {
      addToast(`Test run failed: ${e.message}`, 'error')
    } finally { setTestRunning(false) }
  }

  return (
    <div className="flex flex-col h-full w-full px-4 bg-copernicus-bg font-mono text-zinc-300 overflow-hidden">
      {/* Internal Sub-Header / Tab bar */}
      <div className="h-8 px-3 border-b border-zinc-800 shrink-0 flex items-center justify-between bg-black/20">
        <div className="flex h-full">
          {TABS.map(t => (
            <button key={t.id} onClick={() => activateTab(t.id)}
              className={`px-3 text-[10px] font-bold tracking-widest transition-all h-full border-r border-zinc-800/50 ${
                activeTab === t.id
                  ? 'text-copernicus-phosphor bg-copernicus-phosphor/5'
                  : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'
              }`}
            >{t.label}</button>
          ))}
        </div>

        <div className="flex items-center gap-4 pr-2">
          <div className="flex items-center gap-2">
            <span className="text-[9px] uppercase text-zinc-600 font-bold tracking-tighter">Rate_$/hr //</span>
            <input
              type="number" value={rate}
              onChange={e => saveRate(Number(e.target.value))}
              className="bg-black border border-zinc-800 text-right w-12 px-1 py-0.5 text-[10px] focus:border-copernicus-phosphor focus:outline-none text-zinc-400 font-mono"
            />
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 flex flex-col p-0 overflow-hidden custom-scrollbar">
        <div className={`space-y-4 flex flex-col h-full ${spotlightId ? 'space-y-0' : ''}`}>

          {/* ── FINANCIAL ─────────────────────────────────────────────────── */}
          {activeTab === 'financial' && (
            <>
              {finLoading ? (
                <div className="text-copernicus-phosphor animate-pulse text-[10px] uppercase tracking-widest p-4">Loading_Financial_Stream...</div>
              ) : (
                <>
                  {!spotlightId && (
                    <div className="grid grid-cols-4 gap-4 mb-4">
                      <SummaryCard title="CAPEX Hours"     value={stats.capexHours.toFixed(1)} accent />
                      <SummaryCard title="OPEX Hours"      value={stats.opexHours.toFixed(1)} />
                      <SummaryCard title="Capitalizable %" value={`${capPct.toFixed(1)}%`} />
                      <SummaryCard title="Total Sessions"  value={stats.totalSessions.toString()} />
                    </div>
                  )}

                  <DashboardPanel 
                    title="Weekly Hours Velocity" 
                    id="weekly-vel" 
                    spotlightId={spotlightId} 
                    setSpotlightId={setSpotlightId}
                  >
                    {weeklyVelocity.length === 0 ? (
                      <EmptyState msg="No session data recorded yet" />
                    ) : (
                      <ResponsiveContainer width="100%" height={spotlightId ? 400 : 160}>
                        <AreaChart data={weeklyVelocity} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                          <defs>
                            <linearGradient id="velGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%"  stopColor={CHART_THEME.phosphor} stopOpacity={0.3} />
                              <stop offset="95%" stopColor={CHART_THEME.phosphor} stopOpacity={0.02} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid stroke={CHART_THEME.grid} strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="week" tick={{ fill: CHART_THEME.text, fontSize: 9 }} />
                          <YAxis tick={{ fill: CHART_THEME.text, fontSize: 9 }} />
                          <Tooltip {...tooltipStyle} />
                          <Area type="monotone" dataKey="hours" name="Hours" stroke={CHART_THEME.phosphor} fill="url(#velGrad)" strokeWidth={2} />
                        </AreaChart>
                      </ResponsiveContainer>
                    )}
                  </DashboardPanel>

                  <div className={spotlightId === 'story-detail' ? 'flex-1 mt-0' : 'mt-4'}>
                    <DashboardPanel 
                      title="Story Detail Attribution" 
                      id="story-detail" 
                      spotlightId={spotlightId} 
                      setSpotlightId={setSpotlightId}
                      actions={
                        <button onClick={() => exportToCsv(
                          `capex_${Date.now()}.csv`,
                          ['Story ID','Component','Hours','Cost','Category','Sessions','Last Active'],
                          report.map(r => [r.story_id, r.component, r.total_hours.toFixed(2), (r.total_hours * rate).toFixed(2), r.financial_category, String(r.session_count), r.end_date])
                        )} className="p-1 text-zinc-600 hover:text-zinc-300 transition-colors" title="Export CSV">
                          <Download size={12} />
                        </button>
                      }
                    >
                      <div className={`overflow-auto ${spotlightId === 'story-detail' ? 'h-full' : 'max-h-[300px]'}`}>
                        <table className="w-full text-left text-[10px] border-collapse">
                          <thead className="text-[9px] uppercase text-zinc-600 sticky top-0 bg-[#0A0A0A] z-10">
                            <tr className="border-b border-zinc-800">
                              {['Story','Component','Hours','Est. Cost','Category','Sessions','Last Active'].map(h => (
                                <th key={h} className="p-2 font-black tracking-tight">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {report.length === 0 ? (
                              <tr><td colSpan={7} className="p-6 text-center text-zinc-600 italic uppercase">No_Session_Data</td></tr>
                            ) : (
                              report.map((r, i) => (
                                <tr key={i} className="border-b border-zinc-800/40 hover:bg-white/5 transition-colors">
                                  <td className="p-2 text-copernicus-phosphor font-bold">{r.story_id || '—'}</td>
                                  <td className="p-2 truncate max-w-[150px]">{r.component}</td>
                                  <td className="p-2 text-right font-mono">{r.total_hours.toFixed(2)}</td>
                                  <td className="p-2 text-right text-zinc-400 font-mono">${(r.total_hours * rate).toFixed(2)}</td>
                                  <td className="p-2">
                                    <span className={`px-1.5 py-0.5 text-[8px] rounded font-black ${r.financial_category === 'CAPEX' ? 'bg-copernicus-phosphor/20 text-copernicus-phosphor' : 'bg-zinc-800 text-zinc-500'}`}>
                                      {r.financial_category}
                                    </span>
                                  </td>
                                  <td className="p-2 text-right text-zinc-600 font-mono">{r.session_count}</td>
                                  <td className="p-2 text-right text-zinc-600 font-mono">{r.end_date}</td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </DashboardPanel>
                  </div>
                </>
              )}
            </>
          )}

          {/* ── QUALITY ───────────────────────────────────────────────────── */}
          {activeTab === 'quality' && (
            <>
              {!spotlightId && (
                <div className="flex items-center gap-4 mb-4">
                  <button onClick={runTests} disabled={testRunning}
                    className="flex items-center gap-2 px-3 py-1.5 text-[10px] uppercase font-bold border border-copernicus-phosphor/30 text-copernicus-phosphor hover:bg-copernicus-phosphor/10 transition-colors disabled:opacity-50">
                    {testRunning ? <RefreshCw size={12} className="animate-spin" /> : <Play size={12} />}
                    {testRunning ? 'RUNNING...' : 'EXECUTE_SUITE'}
                  </button>
                  {latestRun && <span className="text-[9px] text-zinc-600 font-mono uppercase">Last_Run: {new Date(latestRun.run_at).toLocaleString()}</span>}
                </div>
              )}

              <DashboardPanel title="Coverage Intelligence" id="coverage-intel" spotlightId={spotlightId} setSpotlightId={setSpotlightId}>
                {latestRun ? (
                  <div className={`flex items-center gap-12 justify-between max-w-4xl mx-auto ${spotlightId ? 'py-12' : ''}`}>
                    <div className="relative w-32 h-32 flex-shrink-0">
                      <RadialBarChart width={128} height={128} cx={64} cy={64} innerRadius={44} outerRadius={60} data={[{ value: coveragePct, fill: gaugeColor }]} startAngle={90} endAngle={-270}>
                        <RadialBar background={{ fill: CHART_THEME.muted }} dataKey="value" />
                      </RadialBarChart>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-xl font-bold" style={{ color: gaugeColor }}>{coveragePct.toFixed(1)}%</span>
                        <span className="text-[9px] text-zinc-600 uppercase font-black">Coverage</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-12 flex-1">
                      <MiniStat label="Total Tests" value={latestRun.total_tests} />
                      <MiniStat label="Passed" value={latestRun.passed} color={CHART_THEME.phosphor} />
                      <MiniStat label="Failed" value={latestRun.failed} color={latestRun.failed > 0 ? CHART_THEME.danger : CHART_THEME.text} />
                    </div>
                  </div>
                ) : (
                  <EmptyState msg="No test runs recorded — execute suite to initialize" />
                )}
              </DashboardPanel>

              {testRuns.length > 1 && (
                <div className={spotlightId === 'coverage-trend' ? 'flex-1 mt-0' : 'mt-4'}>
                  <DashboardPanel title="Coverage Trend" id="coverage-trend" spotlightId={spotlightId} setSpotlightId={setSpotlightId}>
                    <ResponsiveContainer width="100%" height={spotlightId ? 400 : 120}>
                      <LineChart data={[...testRuns].reverse()} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                        <CartesianGrid stroke={CHART_THEME.grid} strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="run_at" tickFormatter={v => new Date(v).toLocaleDateString()} tick={{ fill: CHART_THEME.text, fontSize: 8 }} />
                        <YAxis domain={[0, 100]} tick={{ fill: CHART_THEME.text, fontSize: 9 }} />
                        <Tooltip {...tooltipStyle} formatter={(v: number | undefined) => [`${(v ?? 0).toFixed(1)}%`, 'Coverage']} />
                        <Line type="monotone" dataKey="coverage_pct" name="Coverage" stroke={CHART_THEME.phosphor} strokeWidth={2} dot={spotlightId ? { r: 3 } : false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </DashboardPanel>
                </div>
              )}

              <div className={spotlightId === 'defect-dist' ? 'flex-1 mt-0' : 'mt-4'}>
                <DashboardPanel title="Defect Distribution by Assignee" id="defect-dist" spotlightId={spotlightId} setSpotlightId={setSpotlightId}>
                  {bugs.length === 0 ? (
                    <EmptyState msg="No defect-tagged stories found" />
                  ) : (
                    <ResponsiveContainer width="100%" height={spotlightId ? 400 : Math.min(200, Math.max(80, bugs.length * 24))}>
                      <BarChart data={bugs} layout="vertical" margin={{ left: 16, right: 24 }}>
                        <CartesianGrid stroke={CHART_THEME.grid} horizontal={false} />
                        <XAxis type="number" tick={{ fill: CHART_THEME.text, fontSize: 9 }} />
                        <YAxis type="category" dataKey="assignee" width={80} tick={{ fill: CHART_THEME.text, fontSize: 9 }} />
                        <Tooltip {...tooltipStyle} />
                        <Bar dataKey="bug_count" name="Bugs" fill={CHART_THEME.danger} radius={[0, 2, 2, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </DashboardPanel>
              </div>
            </>
          )}

          {/* ── LLM ───────────────────────────────────────────────────────── */}
          {activeTab === 'llm' && (
            <>
              {!spotlightId && (
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <SummaryCard title="Total LLM Burn" value={`$${totalCost.toFixed(6)}`} accent />
                  <SummaryCard title="Active Models"    value={String(costByModel.length)} />
                  <SummaryCard title="Total Calls"    value={String(costByModel.reduce((s, r) => s + r.call_count, 0))} />
                </div>
              )}

              <DashboardPanel title="Daily Burn Rate (30d)" id="llm-burn" spotlightId={spotlightId} setSpotlightId={setSpotlightId}>
                {dailyCosts.length === 0 ? (
                  <EmptyState msg="No LLM telemetry recorded yet" />
                ) : (
                  <ResponsiveContainer width="100%" height={spotlightId ? 400 : 160}>
                    <AreaChart data={dailyCosts} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
                      <defs>
                        <linearGradient id="costGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor={CHART_THEME.phosphor} stopOpacity={0.3} />
                          <stop offset="95%" stopColor={CHART_THEME.phosphor} stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke={CHART_THEME.grid} strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="day" tickFormatter={v => v.slice(5)} tick={{ fill: CHART_THEME.text, fontSize: 9 }} />
                      <YAxis tick={{ fill: CHART_THEME.text, fontSize: 9 }} tickFormatter={v => `$${v.toFixed(4)}`} />
                      <Tooltip {...tooltipStyle} formatter={(v: number | undefined) => [`$${(v ?? 0).toFixed(6)}`, 'Cost']} />
                      <Area type="monotone" dataKey="total_cost" name="Cost" stroke={CHART_THEME.phosphor} fill="url(#costGrad)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </DashboardPanel>

              <div className={spotlightId === 'llm-providers' ? 'flex-1 mt-0' : 'mt-4'}>
                <DashboardPanel title="Cost per Intelligence Provider" id="llm-providers" spotlightId={spotlightId} setSpotlightId={setSpotlightId}>
                  {costByModel.length === 0 ? (
                    <EmptyState msg="No model calls recorded" />
                  ) : (
                    <ResponsiveContainer width="100%" height={spotlightId ? 400 : Math.min(240, Math.max(120, costByModel.length * 24))}>
                      <BarChart data={costByModel} layout="vertical" margin={{ left: 16, right: 48 }}>
                        <CartesianGrid stroke={CHART_THEME.grid} horizontal={false} />
                        <XAxis type="number" tick={{ fill: CHART_THEME.text, fontSize: 9 }} tickFormatter={v => `$${v.toFixed(4)}`} />
                        <YAxis type="category" dataKey="model_id" width={120} tick={{ fill: CHART_THEME.text, fontSize: 9 }} />
                        <Tooltip {...tooltipStyle} formatter={(v: number | undefined) => [`$${(v ?? 0).toFixed(6)}`, 'Cost']} />
                        <Bar dataKey="total_cost" name="Cost" radius={[0, 2, 2, 0]}>
                          {costByModel.map((row, i) => (
                            <Cell key={i} fill={CHART_THEME.providers[row.provider as keyof typeof CHART_THEME.providers] ?? CHART_THEME.phosphor} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </DashboardPanel>
              </div>

              <div className={spotlightId === 'llm-attribution' ? 'flex-1 mt-0' : 'mt-4'}>
                <DashboardPanel 
                  title="Contextual Resource Attribution" 
                  id="llm-attribution" 
                  spotlightId={spotlightId} 
                  setSpotlightId={setSpotlightId}
                  actions={
                    <button onClick={() => exportToCsv('llm_cost.csv',
                      ['Context','Calls','Tokens','Cost'],
                      costByStory.map(r => [r.story_id, String(r.call_count), String(r.total_tokens), r.total_cost.toFixed(6)])
                    )} className="p-1 text-zinc-600 hover:text-zinc-300 transition-colors" title="Export CSV">
                      <Download size={12} />
                    </button>
                  }
                >
                  <div className={`overflow-auto ${spotlightId === 'llm-attribution' ? 'h-full' : 'max-h-[300px]'}`}>
                    <table className="w-full text-left text-[10px] border-collapse">
                      <thead className="text-[9px] uppercase text-zinc-600 sticky top-0 bg-[#0A0A0A] z-10">
                        <tr className="border-b border-zinc-800">
                          {['Context','Calls','Tokens','Cost'].map(h => <th key={h} className="p-2 font-black">{h}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {costByStory.length === 0 ? (
                          <tr><td colSpan={4} className="p-4 text-center text-zinc-600 italic uppercase">No_Context_Uplinks</td></tr>
                        ) : (
                          costByStory.map((r, i) => (
                            <tr key={i} className="border-b border-zinc-800/40 hover:bg-white/5 transition-colors">
                              <td className="p-2 text-copernicus-phosphor font-bold">{r.story_id}</td>
                              <td className="p-2 text-right font-mono">{r.call_count}</td>
                              <td className="p-2 text-right font-mono">{(r.total_tokens / 1000).toFixed(1)}k</td>
                              <td className="p-2 text-right text-zinc-400 font-mono">${r.total_cost.toFixed(6)}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </DashboardPanel>
              </div>
            </>
          )}

          {/* ── VELOCITY ──────────────────────────────────────────────────── */}
          {activeTab === 'velocity' && (
            <>
              <DashboardPanel 
                title="Sprint Throughput (Stories/Week)" 
                id="throughput" 
                spotlightId={spotlightId} 
                setSpotlightId={setSpotlightId}
                actions={
                  <button onClick={() => exportToCsv('throughput.csv',
                    ['Week','Completed'],
                    throughput.map(r => [r.week, String(r.completed)])
                  )} className="p-1 text-zinc-600 hover:text-zinc-300 transition-colors" title="Export CSV">
                    <Download size={12} />
                  </button>
                }
              >
                {throughput.length === 0 ? (
                  <EmptyState msg="No completed stories yet" />
                ) : (
                  <ResponsiveContainer width="100%" height={spotlightId ? 400 : 160}>
                    <BarChart data={throughput} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                      <CartesianGrid stroke={CHART_THEME.grid} strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="week" tick={{ fill: CHART_THEME.text, fontSize: 9 }} />
                      <YAxis tick={{ fill: CHART_THEME.text, fontSize: 9 }} />
                      <Tooltip {...tooltipStyle} />
                      <Bar dataKey="completed" name="Stories" fill={CHART_THEME.phosphor} radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </DashboardPanel>

              <div className={spotlightId === 'pipeline-dist' ? 'flex-1 mt-0' : 'mt-4'}>
                <DashboardPanel title="Pipeline Status Distribution" id="pipeline-dist" spotlightId={spotlightId} setSpotlightId={setSpotlightId}>
                  {statusDist.length === 0 ? (
                    <EmptyState msg="No pipeline data available" />
                  ) : (
                    <ResponsiveContainer width="100%" height={spotlightId ? 400 : Math.min(180, Math.max(100, statusDist.length * 24))}>
                      <BarChart data={statusDist} layout="vertical" margin={{ left: 16, right: 24 }}>
                        <CartesianGrid stroke={CHART_THEME.grid} horizontal={false} />
                        <XAxis type="number" tick={{ fill: CHART_THEME.text, fontSize: 9 }} />
                        <YAxis type="category" dataKey="status" width={100} tick={{ fill: CHART_THEME.text, fontSize: 9 }} />
                        <Tooltip {...tooltipStyle} />
                        <Bar dataKey="count" name="Stories" fill={CHART_THEME.axis} radius={[0, 2, 2, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </DashboardPanel>
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  )
}
