import React, { useState, useEffect } from 'react'
import { useIpcError } from '../../../hooks/useIpcError'
import { TouchBarConfig, DEFAULT_TOUCH_BAR_CONFIG } from '../../../types/touch-bar'
import { SettingsLoadResponse } from '../../../types/ipc'
import log from '../../../utils/logger'
import { TelemetryStatusTile } from '../TelemetryStatusTile'

const ALLOWED_TARGETS = ['dev','test','build','lint','backlog','deploy','commit','agent','dashboard']

export const HardwareSection: React.FC = () => {
  const invoke = useIpcError()
  const [config, setConfig] = useState<TouchBarConfig>(DEFAULT_TOUCH_BAR_CONFIG)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    invoke<IpcResult<SettingsLoadResponse>>('settings:load').then(res => {
      const result = unwrapIpc<SettingsLoadResponse>(res)
      if (result?.touchBar) setConfig({ ...DEFAULT_TOUCH_BAR_CONFIG, ...(result.touchBar as TouchBarConfig) })
    }).catch(err => log.error('Failed to load settings', err))
  }, [invoke])

  const save = async () => {
    setSaving(true)
    try {
      await invoke('settings:save', { touchBar: config })
      await invoke('touchbar:rebuild', config)
    } finally {
      setSaving(false)
    }
  }

  const updateCommand = (slot: number, patch: Partial<{ target: string; label: string }>) => {
    setConfig(prev => {
      const commands = [...prev.commands] as TouchBarConfig['commands']
      const existing = commands[slot]
      if (existing) {
        commands[slot] = { ...existing, ...patch }
      }
      return { ...prev, commands }
    })
  }

  return (
    <div className="space-y-6 font-mono text-xs text-zinc-300">
      <div>
        <h3 className="text-[11px] uppercase text-zinc-500 tracking-widest mb-4">Touch Bar</h3>

        {/* Enable toggle */}
        <label className="flex items-center gap-3 mb-6 cursor-pointer group">
          <div
            onClick={() => setConfig(p => ({ ...p, enabled: !p.enabled }))}
            className={`w-8 h-4 rounded-full transition-colors relative ${config.enabled ? 'bg-copernicus-phosphor' : 'bg-zinc-700'}`}
          >
            <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${config.enabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
          </div>
          <span className="text-[11px] group-hover:text-white transition-colors">Enable Touch Bar</span>
        </label>

        {/* Telemetry mode */}
        <div className="mb-6">
          <span className="text-[11px] uppercase text-zinc-500 tracking-widest block mb-2">Telemetry Display</span>
          <div className="flex gap-2">
            {(['story-timer', 'branch-cost'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => setConfig(p => ({ ...p, telemetryMode: mode }))}
                className={`px-3 py-1 text-[11px] uppercase border transition-colors ${
                  config.telemetryMode === mode
                    ? 'border-copernicus-phosphor text-black bg-copernicus-phosphor'
                    : 'border-zinc-700 text-zinc-500 hover:border-zinc-500'
                }`}
              >
                {mode === 'story-timer' ? 'Story + Timer' : 'Branch + Cost'}
              </button>
            ))}
          </div>
        </div>

        {/* Command tray */}
        <div className="mb-6">
          <span className="text-[11px] uppercase text-zinc-500 tracking-widest block mb-2">Command Tray (3 slots)</span>
          <div className="space-y-2 overflow-y-auto max-h-[180px] min-h-[40px]">
            {config.commands.map((cmd, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-zinc-600 w-4">{i + 1}.</span>
                <select
                  value={cmd.target}
                  onChange={e => updateCommand(i, { target: e.target.value })}
                  className="bg-zinc-950 border border-zinc-700 text-zinc-300 px-2 py-1 text-[11px] focus:border-copernicus-phosphor focus:outline-none rounded"
                >
                  {ALLOWED_TARGETS.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
                <input
                  value={cmd.label}
                  onChange={e => updateCommand(i, { label: e.target.value.toUpperCase().slice(0, 8) })}
                  maxLength={8}
                  placeholder="LABEL"
                  className="bg-zinc-950 border border-zinc-700 text-zinc-300 px-2 py-1 text-[11px] w-20 focus:border-copernicus-phosphor focus:outline-none rounded uppercase"
                />
                <span className="text-zinc-600 text-[11px] italic">→ make {cmd.target}</span>
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={save}
          disabled={saving}
          className="px-4 py-1.5 bg-copernicus-phosphor text-black font-bold uppercase hover:bg-white transition-colors text-[11px] disabled:opacity-50 rounded"
        >
          {saving ? 'Applying…' : 'Apply to Touch Bar'}
        </button>
      </div>

      <div className="pt-6 border-t border-zinc-800">
        <h3 className="text-[11px] uppercase text-zinc-500 tracking-widest mb-4">Telemetry Integration</h3>
        <TelemetryStatusTile />
      </div>
    </div>
  )
}
