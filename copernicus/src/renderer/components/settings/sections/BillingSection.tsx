import React, { useEffect, useState } from 'react'
import { DollarSign } from 'lucide-react'
import { useIpcError } from '../../../hooks/useIpcError'
import { useToastStore } from '../../../store/toastStore'
import { unwrapIpc } from '../../../types/ipc'

interface ProjectRecord {
  id: string
  path: string
  billing_mode: 'CAPEX' | 'OPEX' | 'NONE'
  billing_details?: string
}

export const BillingSection: React.FC = () => {
  const invoke = useIpcError()
  const addToast = useToastStore(s => s.addToast)

  const [rootPath, setRootPath] = useState<string | null>(null)
  const [record, setRecord] = useState<ProjectRecord | null>(null)

  const [billingMode, setBillingMode] = useState<'CAPEX' | 'OPEX' | 'NONE'>('NONE')
  const [hourlyRate, setHourlyRate] = useState<string>('0')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let active = true

    const load = async () => {
      try {
        const pathRes = await invoke<{ path: string } | string | null>('app:get-root-path')
        // We know invoke returns the envelope { ok, data } because of useIpcError wrapper
        if (!(pathRes as any).ok) return

        let currentPath = unwrapIpc<any>(pathRes)
        if (!currentPath) return

        if (typeof currentPath === 'object' && currentPath.path) {
          currentPath = currentPath.path
        }

        if (typeof currentPath === 'string') {
          if (active) setRootPath(currentPath)

          const billingRes = await invoke<ProjectRecord | null>('project:get-billing', currentPath)
          if ((billingRes as any).ok) {
            const data = unwrapIpc<ProjectRecord | null>(billingRes)
            if (active) {
              setRecord(data)
              if (data) {
                setBillingMode(data.billing_mode || 'NONE')
                try {
                  const details = data.billing_details ? JSON.parse(data.billing_details) : {}
                  setHourlyRate(details.hourly_rate?.toString() || '0')
                } catch (e) {
                  setHourlyRate('0')
                }
              } else {
                setBillingMode('NONE')
                setHourlyRate('0')
              }
            }
          }
        }
      } catch (e) {

      }
    }

    load()
    return () => { active = false }
  }, [invoke])

  const handleSave = async () => {
    if (!rootPath) return
    setSaving(true)
    try {
      const res = await invoke<any>('project:save-billing', {
        id: record?.id ?? `local/${rootPath.split('/').pop() || 'project'}`,
        path: rootPath,
        billing_mode: billingMode,
        billing_details: JSON.stringify({ hourly_rate: parseFloat(hourlyRate || '0') })
      })
      if (res.ok) {
        addToast('Billing settings saved successfully', 'success')
      } else {
        addToast(`Failed to save billing settings: ${res.error}`, 'error')
      }
    } catch (e: any) {
      addToast(`Error saving billing: ${e.message}`, 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-sm font-bold text-zinc-200 uppercase tracking-widest">Workspace Billing</h2>
        <p className="text-[10px] text-zinc-500 font-mono mt-1">Configure CapEx/OpEx billing designation and hourly rate for the current workspace.</p>
      </div>

      <div className="bg-black/40 border border-zinc-800/50 rounded-2xl p-6 space-y-6">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-zinc-400">
              <DollarSign size={14} />
              <span className="text-[10px] uppercase font-bold tracking-wider">Billing Mode</span>
            </div>
            <div className="flex gap-2">
              {(['CAPEX', 'OPEX', 'NONE'] as const).map(mode => (
                <button
                  key={mode}
                  onClick={() => setBillingMode(mode)}
                  className={`px-3 py-1 rounded text-[9px] font-black uppercase tracking-widest transition-all border ${
                    billingMode === mode
                      ? 'border-copernicus-phosphor bg-copernicus-phosphor text-[#050505] rounded-none'
                      : 'border-zinc-800 text-zinc-500 hover:border-zinc-700'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>

          {(billingMode === 'CAPEX' || billingMode === 'OPEX') && (
            <div className="flex items-center justify-between border-t border-zinc-800/50 pt-4">
              <div className="flex items-center gap-2 text-zinc-400">
                <span className="text-[10px] uppercase font-bold tracking-wider">Hourly Rate</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-zinc-500 text-lg font-extralight">$</span>
                <input
                  type="number"
                  value={hourlyRate}
                  onChange={e => setHourlyRate(e.target.value)}
                  className="bg-transparent text-xl font-black text-white w-20 outline-none text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none hover:text-copernicus-phosphor transition-colors focus:text-copernicus-phosphor"
                  placeholder="0"
                />
                <span className="text-zinc-500 text-xs font-mono">/HR</span>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-end pt-4">
        <button
          onClick={handleSave}
          disabled={saving || !rootPath}
          className="bg-copernicus-phosphor text-[#050505] hover:bg-green-400 px-6 py-2 rounded text-[10px] font-black uppercase tracking-widest transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </div>
  )
}
