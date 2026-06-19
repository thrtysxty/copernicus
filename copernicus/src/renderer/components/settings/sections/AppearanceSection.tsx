import React from 'react'
import { useWorkspaceStore, PHOSPHOR_PRESETS, PhosphorColor } from '../../../store/layout'
import { Palette, Maximize, Type, Zap, Monitor } from 'lucide-react'

const PRESET_ENTRIES = Object.entries(PHOSPHOR_PRESETS) as [PhosphorColor, { label: string; hex: string }][]

export const AppearanceSection: React.FC = () => {
  const { 
    uiDensity, fontSize, animationsEnabled, crtMode,
    setAppearance
  } = useWorkspaceStore()

  const phosphorColor = useWorkspaceStore(s => s.phosphorColor)
  const setPhosphorColor = useWorkspaceStore(s => s.setPhosphorColor)

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-sm font-bold text-zinc-200 uppercase tracking-widest">Appearance</h2>
        <p className="text-[10px] text-zinc-500 font-mono mt-1">Customise the visual interface and ergonomics of the IDE.</p>
      </div>

      <fieldset className="space-y-4 border-none p-0 m-0">
        <legend className="flex items-center gap-2 text-zinc-400">
          <Palette size={14} />
          <h3 className="text-[10px] uppercase font-bold tracking-wider">System Phosphor</h3>
        </legend>
        <div className="grid grid-cols-4 gap-3 bg-zinc-900/30 p-4 rounded-lg border border-zinc-800/50">
          {PRESET_ENTRIES.map(([key, preset]) => (
            <button
              key={key}
              aria-label={`Set phosphor color to ${preset.label}`}
              aria-pressed={phosphorColor === key}
              onClick={() => setPhosphorColor(key)}
              className={`flex flex-col items-center gap-2 p-2 rounded border transition-all focus-visible:ring-2 focus-visible:ring-copernicus-phosphor focus-visible:outline-none ${
                phosphorColor === key 
                  ? 'border-white bg-white/5 shadow-[0_0_15px_-3px_rgba(255,255,255,0.2)]' 
                  : 'border-zinc-800 hover:border-zinc-700 bg-black/20'
              }`}
            >
              <div 
                className="w-8 h-8 rounded-full border border-white/20"
                style={{ 
                  backgroundColor: preset.hex,
                  boxShadow: phosphorColor === key ? `0 0 12px ${preset.hex}` : 'none'
                }}
              />
              <span className={`text-[9px] font-bold uppercase ${phosphorColor === key ? 'text-white' : 'text-zinc-500'}`}>
                {preset.label}
              </span>
            </button>
          ))}
        </div>
      </fieldset>

      <div className="grid grid-cols-1 gap-6">
        <fieldset className="space-y-4 border-none p-0 m-0">
          <legend className="flex items-center gap-2 text-zinc-400">
            <Maximize size={14} />
            <h3 className="text-[10px] uppercase font-bold tracking-wider">UI Density</h3>
          </legend>
          <div className="flex bg-zinc-900/50 p-1 rounded-md border border-zinc-800">
            {(['compact', 'normal', 'comfortable'] as const).map((d) => (
              <button
                key={d}
                aria-pressed={uiDensity === d}
                onClick={() => setAppearance({ uiDensity: d })}
                className={`flex-1 py-1.5 text-[9px] font-bold uppercase rounded transition-all focus-visible:ring-2 focus-visible:ring-copernicus-phosphor focus-visible:outline-none ${
                  uiDensity === d 
                    ? 'bg-zinc-800 text-copernicus-phosphor shadow-inner' 
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="space-y-4 border-none p-0 m-0">
          <legend className="flex items-center gap-2 text-zinc-400">
            <Type size={14} />
            <h3 className="text-[10px] uppercase font-bold tracking-wider">Editor Font Size</h3>
          </legend>
          <div className="flex items-center gap-4 bg-zinc-900/30 p-4 rounded-lg border border-zinc-800/50">
            <input 
              id="font-size-slider"
              type="range" 
              min="10" 
              max="18" 
              step="1"
              value={fontSize}
              onChange={(e) => setAppearance({ fontSize: parseInt(e.target.value) })}
              aria-label="Editor Font Size"
              className="flex-1 accent-copernicus-phosphor h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
            />
            <label htmlFor="font-size-slider" className="min-w-[32px] text-xs font-mono text-copernicus-phosphor text-center">
              {fontSize}px
            </label>
          </div>
        </fieldset>

        <section className="flex items-center justify-between p-4 bg-zinc-900/30 rounded-lg border border-zinc-800/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded bg-zinc-900 text-zinc-400">
              <Zap size={14} />
            </div>
            <div>
              <div className="text-[10px] text-zinc-200 uppercase font-bold tracking-wider">Interface Animations</div>
              <div className="text-[9px] text-zinc-500 font-mono">Enable smooth transitions and glow effects</div>
            </div>
          </div>
          <button
            onClick={() => setAppearance({ animationsEnabled: !animationsEnabled })}
            aria-label="Toggle interface animations"
            aria-pressed={animationsEnabled}
            className={`w-10 h-5 rounded-full transition-colors relative focus-visible:ring-2 focus-visible:ring-copernicus-phosphor focus-visible:outline-none ${
              animationsEnabled ? 'bg-copernicus-phosphor' : 'bg-zinc-700'
            }`}
          >
            <div
              className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all duration-200 ${
                animationsEnabled ? 'left-6' : 'left-1'
              }`}
            />
          </button>
        </section>

        <section className="flex items-center justify-between p-4 bg-zinc-900/30 rounded-lg border border-zinc-800/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded bg-zinc-900 text-zinc-400">
              <Monitor size={14} />
            </div>
            <div>
              <div className="text-[10px] text-zinc-200 uppercase font-bold tracking-wider">CRT Pulse Shaders</div>
              <div className="text-[9px] text-zinc-500 font-mono">Enable scanlines and retro phosphor effects</div>
            </div>
          </div>
          <button
            onClick={() => setAppearance({ crtMode: !crtMode })}
            aria-label="Toggle CRT Mode"
            aria-pressed={crtMode}
            className={`w-10 h-5 rounded-full transition-colors relative focus-visible:ring-2 focus-visible:ring-copernicus-phosphor focus-visible:outline-none ${
              crtMode ? 'bg-copernicus-phosphor' : 'bg-zinc-700'
            }`}
          >
            <div
              className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all duration-200 ${
                crtMode ? 'left-6' : 'left-1'
              }`}
            />
          </button>
        </section>
      </div>
    </div>
  )
}
