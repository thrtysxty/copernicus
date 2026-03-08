// env:scan populates toolchain (binary PATH checks) and ideDeps (npm package checks).
// env:get-versions returns static process-level versions without shelling out.
import React, { useState, useEffect } from 'react'
import { useIpcError } from '../../../hooks/useIpcError'
import { useToastStore } from '../../../store/toastStore'
import {
  Terminal, Package, RefreshCcw, CheckCircle2,
  XCircle, Play, Loader2, Cpu, Info
} from 'lucide-react'
import log from '../../../utils/logger'

interface ToolStatus {
  found: boolean
  version?: string
}

interface DepStatus {
  installed: boolean
  version?: string
}

interface ScanResult {
  toolchain: Record<string, ToolStatus>
  ideDeps: Record<string, DepStatus>
}

interface EnvVersions {
  node: string
  electron: string
  appVersion: string
  platform: string
}

export const EnvironmentSection: React.FC = () => {
  const invoke = useIpcError()
  const addToast = useToastStore(s => s.addToast)

  const [data, setData] = useState<ScanResult | null>(null)
  const [versions, setVersions] = useState<EnvVersions | null>(null)
  const [scanning, setScanning] = useState(true)
  const [installing, setInstalling] = useState<string | null>(null)

  const scan = async () => {
    setScanning(true)
    try {
      const result = await invoke<ScanResult>('env:scan')
      setData(result)
    } catch (e) {
      log.error('Scan failed', e)
    } finally {
      setScanning(false)
    }
  }

  useEffect(() => {
    scan()
    invoke<EnvVersions>('env:get-versions').then(v => {
      setVersions(v)
    }).catch(() => {})
    const remove = window.ipcRenderer.on('env:install-complete', () => {
      addToast('Installation complete', 'success')
      setInstalling(null)
      scan()
    })
    return () => remove()
  }, [])

  const handleInstall = async (id: string, label: string, command: string) => {
    setInstalling(id)
    try {
      await invoke('env:install', { id, label, command })
      addToast(`Starting installation: ${label}`, 'info')
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      addToast(`Installation failed: ${message}`, 'error')
      setInstalling(null)
    }
  }

  if (!data && scanning) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="animate-spin text-zinc-500" size={24} />
      </div>
    )
  }

  return (
    <div className="space-y-10">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-zinc-200 uppercase tracking-widest font-mono">Environment & Toolchain</h2>
          <p className="text-[10px] text-zinc-500 font-mono mt-1">Manage system binaries and IDE extensions.</p>
        </div>
        <button 
          onClick={scan}
          disabled={scanning}
          className="p-2 text-zinc-500 hover:text-copernicus-phosphor transition-colors disabled:opacity-50"
          title="Rescan Environment"
        >
          <RefreshCcw size={16} className={scanning ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Runtime versions */}
      {versions && (
        <section className="space-y-4">
          <div className="flex items-center gap-2 text-zinc-400">
            <Info size={14} />
            <h3 className="text-[10px] uppercase font-bold tracking-wider">Runtime Versions</h3>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'Node.js',  value: versions.node },
              { label: 'Electron', value: versions.electron },
              { label: 'App',      value: versions.appVersion },
              { label: 'Platform', value: versions.platform },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between p-3 bg-zinc-900/30 border border-zinc-800 rounded-lg">
                <span className="text-[10px] font-bold text-zinc-400 uppercase font-mono">{label}</span>
                <span className="text-[10px] font-mono text-copernicus-phosphor/80">{value || '—'}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Toolchain binaries */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 text-zinc-400">
          <Terminal size={14} />
          <h3 className="text-[10px] uppercase font-bold tracking-wider">Core Toolchain</h3>
        </div>
        <div className="grid grid-cols-1 gap-2">
          {data && Object.entries(data.toolchain).map(([bin, status]) => (
            <div key={bin} className="flex items-center justify-between p-3 bg-zinc-900/30 border border-zinc-800 rounded-lg">
              <div className="flex items-center gap-3">
                <div className={`p-1.5 rounded bg-zinc-950 ${status.found ? 'text-green-500' : 'text-red-500'}`}>
                  {status.found ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                </div>
                <div>
                  <div className="text-[11px] font-bold text-zinc-200 uppercase font-mono">{bin}</div>
                  <div className="text-[9px] text-zinc-500 font-mono">{status.version || 'Binary not found in PATH'}</div>
                </div>
              </div>
              {!status.found && (
                <button 
                  onClick={() => addToast(`Manual installation required for ${bin}`, 'info')}
                  className="px-2 py-1 text-[8px] font-bold uppercase border border-zinc-700 rounded text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  Manual Fix
                </button>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* IDE Optional Extensions */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 text-zinc-400">
          <Package size={14} />
          <h3 className="text-[10px] uppercase font-bold tracking-wider">IDE Capabilities</h3>
        </div>
        <div className="grid grid-cols-1 gap-3">
          <ExtensionCard 
            id="playwright"
            name="Browser Automation"
            description="Playwright drivers for web scraping and agent testing."
            status={data?.ideDeps['playwright-core']}
            installCmd="npx playwright install chromium"
            busy={installing === 'playwright'}
            onInstall={handleInstall}
          />
          <ExtensionCard 
            id="eslint"
            name="Linter Engine"
            description="ESLint support for automated code quality checks."
            status={data?.ideDeps['eslint']}
            installCmd="npm install -g eslint"
            busy={installing === 'eslint'}
            onInstall={handleInstall}
          />
          <ExtensionCard 
            id="vitest"
            name="Test Framework"
            description="Unit testing engine for autonomous verification."
            status={data?.ideDeps['vitest']}
            installCmd="npm install -g vitest"
            busy={installing === 'vitest'}
            onInstall={handleInstall}
          />
        </div>
      </section>
    </div>
  )
}

const ExtensionCard = ({ id, name, description, status, installCmd, busy, onInstall }: {
  id: string;
  name: string;
  description: string;
  status?: DepStatus;
  installCmd: string;
  busy: boolean;
  onInstall: (id: string, name: string, cmd: string) => void;
}) => (
  <div className="p-4 bg-[#0F0F0F] border border-zinc-800 rounded-lg flex items-center justify-between group hover:border-zinc-700 transition-all">
    <div className="flex items-center gap-4">
      <div className={`p-2 rounded bg-zinc-900 ${status?.installed ? 'text-copernicus-phosphor' : 'text-zinc-600'}`}>
        <Cpu size={18} />
      </div>
      <div>
        <div className="flex items-center gap-2">
          <h4 className="text-xs font-bold text-zinc-200 uppercase tracking-wider font-mono">{name}</h4>
          {status?.installed ? (
            <span className="text-[8px] px-1 py-0.5 rounded bg-green-500/10 text-green-400 border border-green-500/20 font-bold uppercase font-mono">Active</span>
          ) : (
            <span className="text-[8px] px-1 py-0.5 rounded bg-zinc-800 text-zinc-500 font-bold uppercase font-mono">Optional</span>
          )}
        </div>
        <p className="text-[10px] text-zinc-500 mt-0.5">{description}</p>
      </div>
    </div>
    
    <button
      onClick={() => onInstall(id, name, installCmd)}
      disabled={status?.installed || busy}
      className={`px-3 py-1.5 rounded text-[10px] font-bold uppercase transition-all flex items-center gap-2 ${
        status?.installed 
          ? 'bg-transparent text-zinc-600 cursor-default' 
          : 'bg-zinc-900 border border-zinc-800 text-zinc-300 hover:border-copernicus-phosphor hover:text-copernicus-phosphor font-mono'
      }`}
    >
      {busy ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
      {status?.installed ? 'Installed' : 'Enable'}
    </button>
  </div>
)
