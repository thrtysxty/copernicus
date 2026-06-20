import React, { useState, useEffect } from 'react'
import { useIpcError } from '../../../hooks/useIpcError'
import { useToastStore } from '../../../store/toastStore'
import { ShieldAlert, GitBranch, Eye, Lock } from 'lucide-react'

export const SecuritySection: React.FC = () => {
  const invoke = useIpcError()
  const addToast = useToastStore(s => s.addToast)
  
  const [settings, setSettings] = useState({
    gitGuardEnabled: true,
    ptyAuditEnabled: true,
    autoApproveSafeCommands: false
  })

  useEffect(() => {
    invoke<any>('settings:load').then((s) => {
      if (s) {
        setSettings({
          gitGuardEnabled: s.gitGuardEnabled ?? true,
          ptyAuditEnabled: s.ptyAuditEnabled ?? true,
          autoApproveSafeCommands: s.autoApproveSafeCommands ?? false
        })
      }
    })
  }, [invoke])

  const handleToggle = async (key: keyof typeof settings, val: boolean) => {
    const newSettings = { ...settings, [key]: val }
    setSettings(newSettings)
    try {
      await invoke('settings:save', newSettings)
      addToast('Security policy updated', 'info')
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      addToast(`Save failed: ${message}`, 'error')
    }
  }

  return (
    <div className="space-y-10">
      <div>
        <h2 className="text-sm font-bold text-zinc-200 uppercase tracking-widest font-mono">Active Defense</h2>
        <p className="text-[11px] text-zinc-500 font-mono mt-1">Configure real-time safety gates and auditing systems.</p>
      </div>

      <div className="space-y-6">
        <SecurityToggle 
          label="GitGuard Protection"
          description="Intercept and require confirmation for sensitive Git operations (push, force, etc)."
          icon={GitBranch}
          enabled={settings.gitGuardEnabled}
          onToggle={(v: boolean) => handleToggle('gitGuardEnabled', v)}
        />

        <SecurityToggle 
          label="PTY Auditing"
          description="Log all terminal I/O to security-alerts.jsonl for forensic analysis."
          icon={Eye}
          enabled={settings.ptyAuditEnabled}
          onToggle={(v: boolean) => handleToggle('ptyAuditEnabled', v)}
        />

        <SecurityToggle 
          label="Auto-Approve Safe Commands"
          description="Do not prompt for read-only or low-risk CLI operations."
          icon={Lock}
          enabled={settings.autoApproveSafeCommands}
          onToggle={(v: boolean) => handleToggle('autoApproveSafeCommands', v)}
        />
      </div>

      <div className="p-6 bg-red-950/10 border border-red-900/20 rounded-xl space-y-4">
        <div className="flex items-center gap-3 text-red-500">
          <ShieldAlert size={20} />
          <h3 className="text-xs font-bold uppercase tracking-tight font-mono">Security Warning</h3>
        </div>
        <p className="text-[11px] text-red-200/60 leading-relaxed font-mono">
          Disabling active defense mechanisms significantly increases the risk of:
        </p>
        <ul className="space-y-2 text-[11px] text-red-200/40 font-mono list-disc ml-4">
          <li>Accidental credential exposure via Git push</li>
          <li>Unintended destructive CLI execution by autonomous agents</li>
          <li>Loss of forensic logs for security incident response</li>
        </ul>
        <div className="pt-2">
          <p className="text-[11px] text-zinc-500 italic">Recommended configuration: All safety gates ACTIVE.</p>
        </div>
      </div>
    </div>
  )
}

const SecurityToggle = ({ label, description, icon: Icon, enabled, onToggle }: {
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
        <div className="text-[11px] text-zinc-500 mt-0.5">{description}</div>
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
