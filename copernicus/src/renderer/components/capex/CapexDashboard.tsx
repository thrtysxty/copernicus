import React, { useEffect, useState } from 'react'
import { useIpcError } from '../../hooks/useIpcError'
import { useToastStore } from '../../store/toastStore'
import { BarChart2, Download } from 'lucide-react'

interface CapexReportRow {
  story_id: string
  component: string
  financial_category: string
  total_hours: number
  session_count: number
  start_date: string
  end_date: string
}

export const CapexDashboard: React.FC = () => {
  const invoke = useIpcError()
  
  const [report, setReport] = useState<CapexReportRow[]>([])
  const [rate, setRate] = useState(150) // Default rate
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Load rate from settings if exists
    invoke<any>('settings:load').then(s => {
        if (s?.developerRate) setRate(s.developerRate)
    })

    // Fetch report
    invoke<{ ok: boolean; data: CapexReportRow[] }>('devtime:report')
      .then(res => {
        if (res.ok) setReport(res.data)
      })
      .finally(() => setLoading(false))
  }, [invoke])

  const saveRate = (newRate: number) => {
      setRate(newRate)
      invoke('settings:save', { developerRate: newRate })
  }

  const exportCSV = async () => {
      const headers = "Story ID,Component,Hours,Cost,Category,Sessions,Start,End\n"
      const rows = report.map(r => 
          `${r.story_id},${r.component},${r.total_hours},${(r.total_hours * rate).toFixed(2)},${r.financial_category},${r.session_count},${r.start_date},${r.end_date}`
      ).join("\n")
      
      const root = await invoke<string>('app:get-root-path')
      const filePath = `${root}/reports/capex_report_${Date.now()}.csv`
      
      const result = await invoke<{ ok: boolean; error?: string }>('fs:save-file', { filePath, content: headers + rows })
      if (result.ok) {
        useToastStore.getState().addToast('CSV exported successfully', 'success')
      } else {
        useToastStore.getState().addToast(`Export failed: ${result.error ?? 'unknown error'}`, 'error')
      }
  }

  const stats = report.reduce((acc, row) => {
      const hours = row.total_hours
      if (row.financial_category === 'CAPEX') acc.capexHours += hours
      else acc.opexHours += hours
      acc.totalSessions += row.session_count
      return acc
  }, { capexHours: 0, opexHours: 0, totalSessions: 0 })

  const totalHours = stats.capexHours + stats.opexHours
  const capitalizablePercent = totalHours > 0 ? (stats.capexHours / totalHours) * 100 : 0

  // Mock velocity data for SVG chart
  const velocityData = [4, 12, 8, 15, 22, 18, 25, 20] 

  if (loading) return <div className="p-8 text-copernicus-phosphor animate-pulse font-mono">CALCULATING_YIELD...</div>

  return (
    <div className="flex flex-col h-full bg-copernicus-bg p-6 font-mono text-zinc-300 overflow-hidden">
        <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
                <BarChart2 className="text-copernicus-phosphor" size={24} />
                <h2 className="text-xl font-bold tracking-tighter uppercase">Capex_Intelligence_Dashboard</h2>
            </div>
            <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                    <label className="text-[10px] uppercase text-zinc-500">Hourly Rate ($)</label>
                    <input 
                        type="number" 
                        value={rate} 
                        onChange={e => saveRate(Number(e.target.value))}
                        className="bg-[#0A0A0A] border border-zinc-800 text-right w-16 px-2 py-1 text-xs focus:border-copernicus-phosphor focus:outline-none text-zinc-300"
                    />
                </div>
                <button 
                    onClick={exportCSV}
                    className="flex items-center gap-2 px-3 py-1.5 bg-copernicus-phosphor/10 text-copernicus-phosphor border border-copernicus-phosphor/20 hover:bg-copernicus-phosphor/20 transition-colors text-xs uppercase font-bold"
                >
                    <Download size={12} />
                    Export Report
                </button>
            </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-4 gap-4 mb-8">
            <SummaryCard title="Total CAPEX Hours" value={stats.capexHours.toFixed(1)} />
            <SummaryCard title="Total OPEX Hours" value={stats.opexHours.toFixed(1)} />
            <SummaryCard title="Capitalizable %" value={`${capitalizablePercent.toFixed(1)}%`} />
            <SummaryCard title="Total Sessions" value={stats.totalSessions.toString()} />
        </div>

        {/* Velocity Chart */}
        <div className="mb-8 p-4 bg-[#0A0A0A] border border-zinc-800 relative">
            <h3 className="text-xs uppercase text-zinc-500 mb-4 tracking-wider">Velocity (Last 8 Weeks)</h3>
            <div className="h-32 w-full">
                <SimpleLineChart data={velocityData} />
            </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto border border-zinc-800 bg-[#0A0A0A]">
            <table className="w-full text-left border-collapse">
                <thead className="bg-zinc-900 text-[10px] uppercase text-zinc-500 font-bold sticky top-0">
                    <tr>
                        <th className="p-3">Story ID</th>
                        <th className="p-3">Component</th>
                        <th className="p-3 text-right">Hours</th>
                        <th className="p-3 text-right">Est. Cost</th>
                        <th className="p-3">Category</th>
                        <th className="p-3 text-right">Sessions</th>
                        <th className="p-3 text-right">Last Active</th>
                    </tr>
                </thead>
                <tbody className="text-xs font-mono">
                    {report.length === 0 ? (
                        <tr>
                            <td colSpan={7} className="p-8 text-center text-zinc-500 italic">No session data available.</td>
                        </tr>
                    ) : (
                        report.map((row, idx) => (
                            <tr key={idx} className="border-b border-zinc-800/50 hover:bg-white/5 transition-colors">
                                <td className="p-3 text-copernicus-phosphor">{row.story_id || '-'}</td>
                                <td className="p-3">{row.component}</td>
                                <td className="p-3 text-right">{row.total_hours.toFixed(2)}</td>
                                <td className="p-3 text-right text-zinc-400">${(row.total_hours * rate).toFixed(2)}</td>
                                <td className="p-3">
                                    <span className={`px-1.5 py-0.5 text-[9px] rounded ${
                                        row.financial_category === 'CAPEX' 
                                        ? 'bg-copernicus-phosphor/20 text-copernicus-phosphor' 
                                        : 'bg-zinc-800 text-zinc-400'
                                    }`}>
                                        {row.financial_category}
                                    </span>
                                </td>
                                <td className="p-3 text-right text-zinc-500">{row.session_count}</td>
                                <td className="p-3 text-right text-zinc-500">{row.end_date}</td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
     </div>
  )
}

function SummaryCard({ title, value }: { title: string, value: string }) {
    return (
        <div className="bg-[#0A0A0A] border border-zinc-800 p-4 flex flex-col gap-1">
            <span className="text-[10px] uppercase text-zinc-500 tracking-wider">{title}</span>
            <span className="text-2xl font-mono text-copernicus-phosphor phosphor-glow">{value}</span>
        </div>
    )
}

function SimpleLineChart({ data }: { data: number[] }) {
    if (data.length < 2 || data.every(d => d === 0)) {
        return <div className="text-zinc-600 text-xs flex items-center justify-center h-full">Not enough data to project velocity</div>
    }
    
    const max = Math.max(...data, 1)
    
    // Generate points string for polyline
    const points = data.map((val, idx) => {
        const x = (idx / (data.length - 1)) * 100
        const y = 100 - (val / max) * 100
        return `${x},${y}`
    }).join(' ')

    return (
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full overflow-visible">
            {/* Grid lines */}
            <line x1="0" y1="25" x2="100" y2="25" stroke="#333" strokeWidth="0.5" strokeDasharray="2" />
            <line x1="0" y1="50" x2="100" y2="50" stroke="#333" strokeWidth="0.5" strokeDasharray="2" />
            <line x1="0" y1="75" x2="100" y2="75" stroke="#333" strokeWidth="0.5" strokeDasharray="2" />
            
            <polyline
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="text-copernicus-phosphor"
                points={points}
                vectorEffect="non-scaling-stroke"
            />
            {data.map((val, idx) => (
                <circle
                    key={idx}
                    cx={(idx / (data.length - 1)) * 100}
                    cy={100 - (val / max) * 100}
                    r="3"
                    className="text-copernicus-phosphor fill-current"
                    vectorEffect="non-scaling-stroke"
                />
            ))}
        </svg>
    )
}
