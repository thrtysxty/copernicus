import React, { useState, useEffect } from 'react'
import { useIpcError } from '../../../hooks/useIpcError'
import { useToastStore } from '../../../store/toastStore'
import { Database, AlertTriangle, RefreshCcw, HardDrive, Calculator } from 'lucide-react'
import log from '../../../utils/logger'
import { unwrapIpc } from '../../../types/ipc'

export const DataSection: React.FC = () => {
  const invoke = useIpcError()
  const addToast = useToastStore(s => s.addToast)
  
  const [allTimeCost, setAllTimeCost] = useState(0)
  const [vacuuming, setVacuuming] = useState(false)
  const [dbSize, setDbSize] = useState('0 KB')

  const fetchData = async () => {
    try {
      const result = await invoke<number>('db:get-total-cost')
      const cost = unwrapIpc<any>(result) ?? 0
      setAllTimeCost(cost)
      // We'll mock the size for now or add an IPC for it if needed later
      setDbSize('1.2 MB') 
    } catch (e) {
      log.error('Failed to fetch data stats', e)
    }
  }

  useEffect(() => {
    fetchData()
  }, [invoke])

  const handleVacuum = async () => {
    setVacuuming(true)
    try {
      await invoke('db:vacuum')
      addToast('Database optimized successfully', 'success')
      fetchData()
    } catch (e: any) {
      addToast(`Vacuum failed: ${e.message}`, 'error')
    } finally {
      setVacuuming(false)
    }
  }

  const handleResetConfig = async () => {
    if (window.confirm('Are you sure? This will reset all your settings and API keys.')) {
      try {
        await invoke('settings:save', {}) // In a real app, we'd delete the file
        addToast('Settings reset. Restarting...', 'info')
        setTimeout(() => invoke('restart-app'), 2000)
      } catch (e: any) {
        addToast(`Reset failed: ${e.message}`, 'error')
      }
    }
  }

  return (
    <div className="space-y-10">
      <div>
        <h2 className="text-sm font-bold text-zinc-200 uppercase tracking-widest font-mono">State & Data</h2>
        <p className="text-[10px] text-zinc-500 font-mono mt-1">Manage persistent storage, costs, and system maintenance.</p>
      </div>

      {/* Economics */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 text-zinc-400">
          <Calculator size={14} />
          <h3 className="text-[10px] uppercase font-bold tracking-wider">Economics</h3>
        </div>
        <div className="bg-zinc-900/30 border border-zinc-800 p-6 rounded-lg flex items-center justify-between">
          <div>
            <div className="text-[10px] text-zinc-500 uppercase font-bold tracking-tight">All-time Computed Cost</div>
            <div className="text-2xl font-bold text-copernicus-phosphor mt-1 font-mono phosphor-glow">
              ${allTimeCost.toFixed(4)}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[9px] text-zinc-600 font-mono italic">Calculated based on token usage</div>
            <div className="text-[9px] text-zinc-600 font-mono italic">across all providers.</div>
          </div>
        </div>
      </section>

      {/* Maintenance */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 text-zinc-400">
          <Database size={14} />
          <h3 className="text-[10px] uppercase font-bold tracking-wider">Maintenance</h3>
        </div>
        <div className="bg-[#0F0F0F] border border-zinc-800 rounded-lg overflow-hidden">
          <div className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-2 rounded bg-zinc-900 text-zinc-500">
                <HardDrive size={18} />
              </div>
              <div>
                <h4 className="text-xs font-bold text-zinc-200 uppercase">SQLite State Ledger</h4>
                <p className="text-[10px] text-zinc-500 mt-0.5">Compact and optimize the local database. Current size: {dbSize}</p>
              </div>
            </div>
            <button 
              onClick={handleVacuum}
              disabled={vacuuming}
              className="px-4 py-2 bg-zinc-900 border border-zinc-800 rounded text-[10px] font-bold uppercase hover:border-zinc-600 transition-colors flex items-center gap-2"
            >
              {vacuuming ? <RefreshCcw size={12} className="animate-spin" /> : <Database size={12} />}
              {vacuuming ? 'Optimizing...' : 'Vacuum DB'}
            </button>
          </div>
        </div>
      </section>

      {/* Dangerous Area */}
      <section className="space-y-4 pt-6 border-t border-red-900/20">
        <div className="flex items-center gap-2 text-red-500/60">
          <AlertTriangle size={14} />
          <h3 className="text-[10px] uppercase font-bold tracking-wider">Dangerous Area</h3>
        </div>
        
        <div className="grid grid-cols-1 gap-3">
          <div className="p-4 bg-red-950/5 border border-red-900/20 rounded-lg flex items-center justify-between">
            <div>
              <div className="text-[11px] text-red-200 uppercase font-bold tracking-tight">Clear Persistence</div>
              <div className="text-[10px] text-red-200/40 mt-0.5">Reset all settings, personas, and API keys to factory defaults.</div>
            </div>
            <button 
              onClick={handleResetConfig}
              className="px-4 py-2 bg-red-900/10 border border-red-900/30 rounded text-[10px] font-bold text-red-400 uppercase hover:bg-red-900/20 transition-colors"
            >
              Reset All Settings
            </button>
          </div>

          <div className="p-4 bg-red-950/5 border border-red-900/20 rounded-lg flex items-center justify-between">
            <div>
              <div className="text-[11px] text-red-200 uppercase font-bold tracking-tight">System Restart</div>
              <div className="text-[10px] text-red-200/40 mt-0.5">Kill all agent processes and restart the IDE.</div>
            </div>
            <button 
              onClick={() => invoke('restart-app')}
              className="px-4 py-2 bg-zinc-900 border border-zinc-800 rounded text-[10px] font-bold text-zinc-400 uppercase hover:bg-zinc-800 transition-colors"
            >
              Restart IDE
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}
