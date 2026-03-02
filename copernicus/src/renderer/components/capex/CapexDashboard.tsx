import React, { useEffect, useRef, useState } from 'react'
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  RadialBarChart, RadialBar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import { BarChart2, Download, Play, RefreshCw } from 'lucide-react'
import { useIpcError } from '../../hooks/useIpcError'
import { useToastStore } from '../../store/toastStore'
import { CHART_THEME } from './chart-theme'

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

// ── Shared helpers ─────────────────────────────────────────────────────────

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

  // (rate loaded in the main mount effect below)

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

  // ── Data loading ────────────────────────────────────────────────────────

  const fetchTabData = async (tab: DashTab) => {
    if (tab === 'financial') {
      setFinLoading(true)
      try {
        const [rep, vel] = await Promise.all([
          invoke<any>('devtime:report'),
          invoke<any>('devtime:weekly-velocity'),
        ])
        setReport(Array.isArray(rep) ? rep : Array.isArray(rep?.data) ? rep.data : [])
        setWeeklyVelocity(Array.isArray(vel) ? vel : Array.isArray(vel?.data) ? vel.data : [])
      } finally { setFinLoading(false) }
    }
    if (tab === 'quality') {
      const [hist, b] = await Promise.all([
        invoke<any>('devtime:test-history'),
        invoke<any>('stories:bugs-by-assignee'),
      ])
      setTestRuns(Array.isArray(hist) ? hist : Array.isArray(hist?.data) ? hist.data : [])
      setBugs(Array.isArray(b) ? b : Array.isArray(b?.data) ? b.data : [])
    }
    if (tab === 'llm') {
      const [daily, byModel, byStory] = await Promise.all([
        invoke<any>('ledger:daily-costs'),
        invoke<any>('ledger:cost-by-model'),
        invoke<any>('ledger:cost-by-story'),
      ])
      const dc = Array.isArray(daily) ? daily : Array.isArray(daily?.data) ? daily.data : []
      const bm = Array.isArray(byModel) ? byModel : Array.isArray(byModel?.data) ? byModel.data : []
      const bs = Array.isArray(byStory) ? byStory : Array.isArray(byStory?.data) ? byStory.data : []
      setDailyCosts(dc)
      setCostByModel(bm)
      setCostByStory(bs)
      setTotalCost(bm.reduce((s: number, r: CostByModel) => s + (r.total_cost ?? 0), 0))
    }
    if (tab === 'velocity') {
      const [tp, sd] = await Promise.all([
        invoke<any>('stories:throughput'),
        invoke<any>('stories:status-distribution'),
      ])
      setThroughput(Array.isArray(tp) ? tp : Array.isArray(tp?.data) ? tp.data : [])
      setStatusDist(Array.isArray(sd) ? sd : Array.isArray(sd?.data) ? sd.data : [])
    }
  }

  const activateTab = (tab: DashTab) => {
    setActiveTab(tab)
    if (!loadedTabs.current.has(tab)) {
      loadedTabs.current.add(tab)
      fetchTabData(tab)
    }
  }

  useEffect(() => {
    invoke<any>('settings:load').then(raw => {
      const s = (raw as any)?.data ?? raw
      const r = s?.capex?.rate ?? s?.developerRate
      if (typeof r === 'number' && r > 0) setRate(r)
    }).catch(() => {})
    loadedTabs.current.add('financial')
    fetchTabData('financial')
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Financial helpers ───────────────────────────────────────────────────

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

  // ── Quality helpers ─────────────────────────────────────────────────────

  const latestRun = testRuns[0] ?? null
  const coveragePct = latestRun?.coverage_pct ?? 0
  const gaugeColor = coveragePct >= 80 ? CHART_THEME.phosphor : coveragePct >= 60 ? CHART_THEME.warn : CHART_THEME.danger

  const runTests = async () => {
    setTestRunning(true)
    try {
      const res = await invoke<any>('devtime:run-tests')
      const record = res?.data ?? res
      setTestRuns(prev => [record, ...prev])
      addToast(`Tests complete: ${record.passed}/${record.total_tests} passed`, record.failed > 0 ? 'error' : 'success')
    } catch (e: any) {
      addToast(`Test run failed: ${e.message}`, 'error')
    } finally { setTestRunning(false) }
  }

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full bg-copernicus-bg font-mono text-zinc-300 overflow-hidden">

      {/* Header + tab bar */}
      <div className="px-6 pt-5 pb-0 border-b border-zinc-800 shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <BarChart2 className="text-copernicus-phosphor" size={18} />
            <h2 className="text-sm font-bold tracking-tighter uppercase">Capex_Intelligence</h2>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-[10px] uppercase text-zinc-500">Rate ($/hr)</label>
              <input
                type="number" value={rate}
                onChange={e => saveRate(Number(e.target.value))}
                className="bg-[#0A0A0A] border border-zinc-800 text-right w-16 px-2 py-1 text-xs focus:border-copernicus-phosphor focus:outline-none text-zinc-300"
              />
            </div>
          </div>
        </div>

        <div className="flex">
          {TABS.map(t => (
            <button key={t.id} onClick={() => activateTab(t.id)}
              className={`px-4 py-2 text-[10px] font-bold tracking-widest transition-colors ${
                activeTab === t.id
                  ? 'text-copernicus-phosphor border-b-2 border-copernicus-phosphor -mb-[2px]'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >{t.label}</button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">

        {/* ── FINANCIAL ─────────────────────────────────────────────────── */}
        {activeTab === 'financial' && (
          <>
            {finLoading
              ? <div className="text-copernicus-phosphor animate-pulse text-xs">LOADING...</div>
              : <>
                  <div className="grid grid-cols-4 gap-4">
                    <SummaryCard title="CAPEX Hours"     value={stats.capexHours.toFixed(1)} accent />
                    <SummaryCard title="OPEX Hours"      value={stats.opexHours.toFixed(1)} />
                    <SummaryCard title="Capitalizable %" value={`${capPct.toFixed(1)}%`} />
                    <SummaryCard title="Total Sessions"  value={stats.totalSessions.toString()} />
                  </div>

                  <div className="bg-[#0A0A0A] border border-zinc-800 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-[10px] uppercase text-zinc-500 tracking-wider">Weekly Hours Velocity</h3>
                    </div>
                    {weeklyVelocity.length === 0
                      ? <EmptyState msg="No session data recorded yet" />
                      : <ResponsiveContainer width="100%" height={160}>
                          <AreaChart data={weeklyVelocity} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                            <defs>
                              <linearGradient id="velGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%"  stopColor={CHART_THEME.phosphor} stopOpacity={0.3} />
                                <stop offset="95%" stopColor={CHART_THEME.phosphor} stopOpacity={0.02} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid stroke={CHART_THEME.grid} strokeDasharray="3 3" />
                            <XAxis dataKey="week" tick={{ fill: CHART_THEME.text, fontSize: 9 }} />
                            <YAxis tick={{ fill: CHART_THEME.text, fontSize: 9 }} />
                            <Tooltip {...tooltipStyle} />
                            <Area type="monotone" dataKey="hours" name="Hours"
                              stroke={CHART_THEME.phosphor} fill="url(#velGrad)" strokeWidth={2} />
                          </AreaChart>
                        </ResponsiveContainer>
                    }
                  </div>

                  <div className="bg-[#0A0A0A] border border-zinc-800 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-[10px] uppercase text-zinc-500 tracking-wider">Story Detail</h3>
                      <button onClick={() => exportToCsv(
                        `capex_${Date.now()}.csv`,
                        ['Story ID','Component','Hours','Cost','Category','Sessions','Last Active'],
                        report.map(r => [r.story_id, r.component, r.total_hours.toFixed(2), (r.total_hours * rate).toFixed(2), r.financial_category, String(r.session_count), r.end_date])
                      )} className="flex items-center gap-1.5 px-2 py-1 text-[9px] uppercase border border-zinc-700 text-zinc-500 hover:text-zinc-300 hover:border-zinc-500 transition-colors">
                        <Download size={10} /> Export
                      </button>
                    </div>
                    <div className="overflow-auto max-h-64">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="text-[9px] uppercase text-zinc-500 sticky top-0 bg-zinc-900">
                          <tr>
                            {['Story','Component','Hours','Est. Cost','Category','Sessions','Last Active'].map(h => (
                              <th key={h} className="p-2">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {report.length === 0
                            ? <tr><td colSpan={7} className="p-6 text-center text-zinc-600 italic">No session data</td></tr>
                            : report.map((r, i) => (
                              <tr key={i} className="border-b border-zinc-800/40 hover:bg-white/5">
                                <td className="p-2 text-copernicus-phosphor">{r.story_id || '—'}</td>
                                <td className="p-2">{r.component}</td>
                                <td className="p-2 text-right">{r.total_hours.toFixed(2)}</td>
                                <td className="p-2 text-right text-zinc-400">${(r.total_hours * rate).toFixed(2)}</td>
                                <td className="p-2">
                                  <span className={`px-1.5 py-0.5 text-[9px] rounded ${r.financial_category === 'CAPEX' ? 'bg-copernicus-phosphor/20 text-copernicus-phosphor' : 'bg-zinc-800 text-zinc-400'}`}>
                                    {r.financial_category}
                                  </span>
                                </td>
                                <td className="p-2 text-right text-zinc-500">{r.session_count}</td>
                                <td className="p-2 text-right text-zinc-500">{r.end_date}</td>
                              </tr>
                            ))
                          }
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
            }
          </>
        )}

        {/* ── QUALITY ───────────────────────────────────────────────────── */}
        {activeTab === 'quality' && (
          <>
            <div className="flex items-center gap-4">
              <button onClick={runTests} disabled={testRunning}
                className="flex items-center gap-2 px-4 py-2 text-[10px] uppercase font-bold border border-copernicus-phosphor/30 text-copernicus-phosphor hover:bg-copernicus-phosphor/10 transition-colors disabled:opacity-50">
                {testRunning ? <RefreshCw size={12} className="animate-spin" /> : <Play size={12} />}
                {testRunning ? 'Running...' : 'Run Tests'}
              </button>
              {latestRun && <span className="text-[10px] text-zinc-500">Last run: {new Date(latestRun.run_at).toLocaleString()}</span>}
            </div>

            {/* Coverage gauge + stats */}
            <div className="bg-[#0A0A0A] border border-zinc-800 p-4">
              <h3 className="text-[10px] uppercase text-zinc-500 tracking-wider mb-4">Coverage</h3>
              {latestRun
                ? <div className="flex items-center gap-8">
                    <div className="relative w-32 h-32 flex-shrink-0">
                      <RadialBarChart width={128} height={128} cx={64} cy={64}
                        innerRadius={44} outerRadius={60}
                        data={[{ value: coveragePct, fill: gaugeColor }]}
                        startAngle={90} endAngle={-270}>
                        <RadialBar background={{ fill: CHART_THEME.muted }} dataKey="value" />
                      </RadialBarChart>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-xl font-bold" style={{ color: gaugeColor }}>{coveragePct.toFixed(1)}%</span>
                        <span className="text-[9px] text-zinc-600 uppercase">Coverage</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-6">
                      <MiniStat label="Total Tests" value={latestRun.total_tests} />
                      <MiniStat label="Passed" value={latestRun.passed} color={CHART_THEME.phosphor} />
                      <MiniStat label="Failed" value={latestRun.failed} color={latestRun.failed > 0 ? CHART_THEME.danger : CHART_THEME.text} />
                    </div>
                  </div>
                : <EmptyState msg="No test runs recorded — click Run Tests to start" />
              }
            </div>

            {/* Coverage trend */}
            {testRuns.length > 1 && (
              <div className="bg-[#0A0A0A] border border-zinc-800 p-4">
                <h3 className="text-[10px] uppercase text-zinc-500 tracking-wider mb-3">Coverage Trend</h3>
                <ResponsiveContainer width="100%" height={120}>
                  <LineChart data={[...testRuns].reverse()} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid stroke={CHART_THEME.grid} strokeDasharray="3 3" />
                    <XAxis dataKey="run_at" tickFormatter={v => new Date(v).toLocaleDateString()} tick={{ fill: CHART_THEME.text, fontSize: 8 }} />
                    <YAxis domain={[0, 100]} tick={{ fill: CHART_THEME.text, fontSize: 9 }} />
                    <Tooltip {...tooltipStyle} formatter={(v: number | undefined) => [`${(v ?? 0).toFixed(1)}%`, 'Coverage']} />
                    <Line type="monotone" dataKey="coverage_pct" name="Coverage"
                      stroke={CHART_THEME.phosphor} strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Bugs by assignee */}
            <div className="bg-[#0A0A0A] border border-zinc-800 p-4">
              <h3 className="text-[10px] uppercase text-zinc-500 tracking-wider mb-3">Bugs by Assignee</h3>
              {bugs.length === 0
                ? <EmptyState msg="No defect-tagged stories found" />
                : <ResponsiveContainer width="100%" height={Math.max(120, bugs.length * 36)}>
                    <BarChart data={bugs} layout="vertical" margin={{ left: 16, right: 24 }}>
                      <CartesianGrid stroke={CHART_THEME.grid} horizontal={false} />
                      <XAxis type="number" tick={{ fill: CHART_THEME.text, fontSize: 9 }} />
                      <YAxis type="category" dataKey="assignee" width={100} tick={{ fill: CHART_THEME.text, fontSize: 9 }} />
                      <Tooltip {...tooltipStyle} />
                      <Bar dataKey="bug_count" name="Bugs" fill={CHART_THEME.danger} radius={[0, 2, 2, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
              }
            </div>
          </>
        )}

        {/* ── LLM ───────────────────────────────────────────────────────── */}
        {activeTab === 'llm' && (
          <>
            <div className="grid grid-cols-3 gap-4">
              <SummaryCard title="Total LLM Cost" value={`$${totalCost.toFixed(6)}`} accent />
              <SummaryCard title="Models Used"    value={String(costByModel.length)} />
              <SummaryCard title="Total Calls"    value={String(costByModel.reduce((s, r) => s + r.call_count, 0))} />
            </div>

            <div className="bg-[#0A0A0A] border border-zinc-800 p-4">
              <h3 className="text-[10px] uppercase text-zinc-500 tracking-wider mb-3">Daily Cost Burn (30d)</h3>
              {dailyCosts.length === 0
                ? <EmptyState msg="No LLM calls recorded yet" />
                : <ResponsiveContainer width="100%" height={160}>
                    <AreaChart data={dailyCosts} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
                      <defs>
                        <linearGradient id="costGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor={CHART_THEME.phosphor} stopOpacity={0.3} />
                          <stop offset="95%" stopColor={CHART_THEME.phosphor} stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke={CHART_THEME.grid} strokeDasharray="3 3" />
                      <XAxis dataKey="day" tickFormatter={v => v.slice(5)} tick={{ fill: CHART_THEME.text, fontSize: 9 }} />
                      <YAxis tick={{ fill: CHART_THEME.text, fontSize: 9 }} tickFormatter={v => `$${v.toFixed(4)}`} />
                      <Tooltip {...tooltipStyle} formatter={(v: number | undefined) => [`$${(v ?? 0).toFixed(6)}`, 'Cost']} />
                      <Area type="monotone" dataKey="total_cost" name="Cost"
                        stroke={CHART_THEME.phosphor} fill="url(#costGrad)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
              }
            </div>

            <div className="bg-[#0A0A0A] border border-zinc-800 p-4">
              <h3 className="text-[10px] uppercase text-zinc-500 tracking-wider mb-3">Cost by Model</h3>
              {costByModel.length === 0
                ? <EmptyState msg="No model calls recorded" />
                : <ResponsiveContainer width="100%" height={Math.max(200, costByModel.length * 36)}>
                    <BarChart data={costByModel} layout="vertical" margin={{ left: 16, right: 48 }}>
                      <CartesianGrid stroke={CHART_THEME.grid} horizontal={false} />
                      <XAxis type="number" tick={{ fill: CHART_THEME.text, fontSize: 9 }} tickFormatter={v => `$${v.toFixed(4)}`} />
                      <YAxis type="category" dataKey="model_id" width={150} tick={{ fill: CHART_THEME.text, fontSize: 9 }} />
                      <Tooltip {...tooltipStyle} formatter={(v: number | undefined) => [`$${(v ?? 0).toFixed(6)}`, 'Cost']} />
                      <Bar dataKey="total_cost" name="Cost" radius={[0, 2, 2, 0]}>
                        {costByModel.map((row, i) => (
                          <Cell key={i}
                            fill={CHART_THEME.providers[row.provider as keyof typeof CHART_THEME.providers] ?? CHART_THEME.phosphor}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
              }
            </div>

            <div className="bg-[#0A0A0A] border border-zinc-800 p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[10px] uppercase text-zinc-500 tracking-wider">Cost by Context</h3>
                <button onClick={() => exportToCsv('llm_cost.csv',
                  ['Context','Calls','Tokens','Cost'],
                  costByStory.map(r => [r.story_id, String(r.call_count), String(r.total_tokens), r.total_cost.toFixed(6)])
                )} className="flex items-center gap-1.5 px-2 py-1 text-[9px] uppercase border border-zinc-700 text-zinc-500 hover:text-zinc-300 transition-colors">
                  <Download size={10} /> Export
                </button>
              </div>
              <div className="overflow-auto max-h-48">
                <table className="w-full text-xs border-collapse">
                  <thead className="text-[9px] uppercase text-zinc-500 sticky top-0 bg-zinc-900">
                    <tr>{['Context','Calls','Tokens','Cost'].map(h => <th key={h} className="p-2 text-left">{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {costByStory.length === 0
                      ? <tr><td colSpan={4} className="p-4 text-center text-zinc-600 italic">No story-context calls yet</td></tr>
                      : costByStory.map((r, i) => (
                        <tr key={i} className="border-b border-zinc-800/40 hover:bg-white/5">
                          <td className="p-2 text-copernicus-phosphor">{r.story_id}</td>
                          <td className="p-2 text-right">{r.call_count}</td>
                          <td className="p-2 text-right">{(r.total_tokens / 1000).toFixed(1)}k</td>
                          <td className="p-2 text-right text-zinc-400">${r.total_cost.toFixed(6)}</td>
                        </tr>
                      ))
                    }
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* ── VELOCITY ──────────────────────────────────────────────────── */}
        {activeTab === 'velocity' && (
          <>
            <div className="bg-[#0A0A0A] border border-zinc-800 p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[10px] uppercase text-zinc-500 tracking-wider">Stories Completed per Week</h3>
                <button onClick={() => exportToCsv('throughput.csv',
                  ['Week','Completed'],
                  throughput.map(r => [r.week, String(r.completed)])
                )} className="flex items-center gap-1.5 px-2 py-1 text-[9px] uppercase border border-zinc-700 text-zinc-500 hover:text-zinc-300 transition-colors">
                  <Download size={10} /> Export
                </button>
              </div>
              {throughput.length === 0
                ? <EmptyState msg="No completed stories yet" />
                : <ResponsiveContainer width="100%" height={160}>
                    <BarChart data={throughput} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                      <CartesianGrid stroke={CHART_THEME.grid} strokeDasharray="3 3" />
                      <XAxis dataKey="week" tick={{ fill: CHART_THEME.text, fontSize: 9 }} />
                      <YAxis tick={{ fill: CHART_THEME.text, fontSize: 9 }} />
                      <Tooltip {...tooltipStyle} />
                      <Bar dataKey="completed" name="Stories" fill={CHART_THEME.phosphor} radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
              }
            </div>

            <div className="bg-[#0A0A0A] border border-zinc-800 p-4">
              <h3 className="text-[10px] uppercase text-zinc-500 tracking-wider mb-3">Status Distribution</h3>
              {statusDist.length === 0
                ? <EmptyState msg="No story data" />
                : <ResponsiveContainer width="100%" height={Math.max(120, statusDist.length * 36)}>
                    <BarChart data={statusDist} layout="vertical" margin={{ left: 16, right: 24 }}>
                      <CartesianGrid stroke={CHART_THEME.grid} horizontal={false} />
                      <XAxis type="number" tick={{ fill: CHART_THEME.text, fontSize: 9 }} />
                      <YAxis type="category" dataKey="status" width={120} tick={{ fill: CHART_THEME.text, fontSize: 9 }} />
                      <Tooltip {...tooltipStyle} />
                      <Bar dataKey="count" name="Stories" fill={CHART_THEME.axis} radius={[0, 2, 2, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
              }
            </div>
          </>
        )}

      </div>
    </div>
  )
}
