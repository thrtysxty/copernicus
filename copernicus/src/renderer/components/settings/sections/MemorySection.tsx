import React, { useState, useEffect } from 'react'
import { useIpcError } from '../../../hooks/useIpcError'
import { useToastStore } from '../../../store/toastStore'
import { Brain, Shield } from 'lucide-react'
import { SettingsLoadResponse } from '../../../types/ipc'
import log from '../../../utils/logger'

interface MemorySettings {
  sprintGate: boolean
}

export const MemorySection: React.FC = () => {
  const invoke = useIpcError()
  const addToast = useToastStore(s => s.addToast)
  
  const [settings, setMemorySettings] = useState<MemorySettings>({
    sprintGate: false
  })

  useEffect(() => {
    const init = async () => {
      try {
        const s = await invoke<SettingsLoadResponse>('settings:load')
        if (s && s.retro) {
          setMemorySettings({
            sprintGate: (s.retro as any).sprintGate ?? false
          })
        }
      } catch (e) {
        log.error('Failed to load memory settings', e)
      }
    }
    init()
  }, [invoke])

  const handleSave = async (patch: Partial<MemorySettings>) => {
    const newSettings = { ...settings, ...patch }
    setMemorySettings(newSettings)
    try {
      const s = await invoke<SettingsLoadResponse>('settings:load')
      await invoke('settings:save', { ...s, retro: { ...(s?.retro as any || {}), sprintGate: newSettings.sprintGate } })
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      addToast(`Save failed: ${message}`, 'error')
    }
  }

  return (
    <div className="space-y-10">
      <div>
        <h2 className="text-sm font-bold text-zinc-200 uppercase tracking-widest font-mono flex items-center gap-2">
          <Brain size={16} className="text-copernicus-phosphor" />
          Memory & Retrospective
        </h2>
        <p className="text-[10px] text-zinc-500 font-mono mt-1">Configure project memory and sprint retrospective behaviour.</p>
      </div>

      <div className="space-y-6">
        <MemoryToggle 
          label="Block new In Progress stories while a retro is pending review"
          description="Requires the team to resolve retrospective insights before starting new sprint work."
          icon={Shield}
          enabled={settings.sprintGate}
          onToggle={(v: boolean) => handleSave({ sprintGate: v })}
        />
      </div>
    </div>
  )
}

const MemoryToggle = ({ label, description, icon: Icon, enabled, onToggle }: {
  label: string;
  description: string;
  icon: React.ElementType;
  enabled: boolean;
  onToggle: (v: boolean) => void;
}) => (
  <div className="flex items-center justify-between gap-6 p-4 bg-[#0F0F0F] border border-zinc-800 rounded-lg group hover:border-zinc-700 transition-all">
    <div className="flex items-center gap-4">
      <div className={`p-2 rounded bg-zinc-900 ${enabled ? 'text-copernicus-phosphor' : 'text-zinc-500'}`}>
        <Icon size={16} />
      </div>
      <div>
        <div className="text-[11px] text-zinc-200 uppercase font-bold tracking-tight">{label}</div>
        <div className="text-[10px] text-zinc-500 mt-0.5">{description}</div>
      </div>
    </div>
    <button
      onClick={() => onToggle(!enabled)}
      className={`w-10 h-5 rounded-full transition-colors relative flex-shrink-0 ${
        enabled ? 'bg-copernicus-phosphor' : 'bg-zinc-700'
      }`}
    >
      <div
        className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all duration-200 ${
          enabled ? 'left-6' : 'left-1'
        }`}
      />
    </button>
  </div>
)
