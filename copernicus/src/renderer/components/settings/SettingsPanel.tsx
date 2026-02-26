import React, { useState } from 'react'
import { useLayoutStore, PHOSPHOR_PRESETS, PhosphorColor } from '../../store/layout'
import { useToastStore } from '../../store/toastStore'
import { X } from 'lucide-react'

const ipcRenderer = (window as any).ipcRenderer

// Use the canonical presets from the store — keys are 'green' | 'amber' | 'white' | 'blue'
const PRESET_ENTRIES = Object.entries(PHOSPHOR_PRESETS) as [PhosphorColor, { label: string; hex: string }][]

interface SettingsPanelProps {
  onClose: () => void
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({ onClose }) => {
  const { phosphorColor, setPhosphorColor } = useLayoutStore()
  const addToast = useToastStore(s => s.addToast)

  const [anthropicKey, setAnthropicKey] = useState('')
  const [openRouterKey, setOpenRouterKey] = useState('')
  const [googleKey, setGoogleKey] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSaveKeys = async () => {
    setSaving(true)
    try {
      const entries: [string, string][] = [
        ['anthropic', anthropicKey],
        ['openrouter', openRouterKey],
        ['google', googleKey],
      ].filter(([, k]) => k.trim()) as [string, string][]

      await Promise.all(
        entries.map(([provider, key]) =>
          ipcRenderer.invoke('auth:store-api-key', { provider, key: key.trim() })
        )
      )
      addToast('API keys saved', 'success')
      setAnthropicKey('')
      setOpenRouterKey('')
      setGoogleKey('')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      addToast(`Failed to save keys: ${msg}`, 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed right-0 top-0 h-full w-72 bg-[#0D0D0D] border-l border-copernicus-steel z-[150] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-copernicus-steel">
        <span className="text-xs font-mono uppercase tracking-widest text-copernicus-phosphor">
          Settings
        </span>
        <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300">
          <X size={14} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Appearance */}
        <section>
          <h3 className="text-[10px] uppercase tracking-widest text-zinc-500 mb-3">Appearance</h3>
          <div className="space-y-2">
            <div className="text-[11px] text-zinc-400 mb-2">Phosphor Color</div>
            <div className="flex gap-2">
              {PRESET_ENTRIES.map(([key, preset]) => (
                <button
                  key={key}
                  title={preset.label}
                  onClick={() => setPhosphorColor(key)}  // key is 'green' | 'amber' | 'white' | 'blue'
                  className="w-8 h-8 rounded border-2 transition-all"
                  style={{
                    backgroundColor: preset.hex,
                    borderColor: phosphorColor === key ? preset.hex : 'transparent',
                    boxShadow: phosphorColor === key ? `0 0 8px ${preset.hex}` : 'none',
                  }}
                />
              ))}
            </div>
          </div>
        </section>

        {/* API Keys */}
        <section>
          <h3 className="text-[10px] uppercase tracking-widest text-zinc-500 mb-3">API Keys</h3>
          <div className="space-y-3">
            <div>
              <label className="text-[10px] text-zinc-500 block mb-1">Anthropic API Key</label>
              <input
                type="password"
                value={anthropicKey}
                onChange={e => setAnthropicKey(e.target.value)}
                placeholder="sk-ant-..."
                className="w-full bg-[#111] border border-copernicus-steel rounded px-2 py-1.5 text-xs font-mono text-zinc-300 focus:outline-none focus:border-copernicus-phosphor/50 placeholder:text-zinc-600"
              />
            </div>
            <div>
              <label className="text-[10px] text-zinc-500 block mb-1">OpenRouter API Key</label>
              <input
                type="password"
                value={openRouterKey}
                onChange={e => setOpenRouterKey(e.target.value)}
                placeholder="sk-or-..."
                className="w-full bg-[#111] border border-copernicus-steel rounded px-2 py-1.5 text-xs font-mono text-zinc-300 focus:outline-none focus:border-copernicus-phosphor/50 placeholder:text-zinc-600"
              />
            </div>
            <div>
              <label className="text-[10px] text-zinc-500 block mb-1">Google API Key</label>
              <input
                type="password"
                value={googleKey}
                onChange={e => setGoogleKey(e.target.value)}
                placeholder="AIza..."
                className="w-full bg-[#111] border border-copernicus-steel rounded px-2 py-1.5 text-xs font-mono text-zinc-300 focus:outline-none focus:border-copernicus-phosphor/50 placeholder:text-zinc-600"
              />
              <div className="text-[9px] text-zinc-600 mt-1">
                Or place OAuth creds at ~/.gemini/oauth_creds.json
              </div>
            </div>
            <button
              onClick={handleSaveKeys}
              disabled={saving || (!anthropicKey.trim() && !openRouterKey.trim())}
              className="w-full py-1.5 text-xs font-mono uppercase tracking-wider rounded bg-copernicus-phosphor/10 text-copernicus-phosphor border border-copernicus-phosphor/30 hover:bg-copernicus-phosphor/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? 'Saving...' : 'Save Keys'}
            </button>
          </div>
        </section>
      </div>
    </div>
  )
}
