import React, { useState, useEffect } from 'react'
import { Cpu, Activity, Download, Trash2, RefreshCcw, AlertTriangle, Zap } from 'lucide-react'
import { useIpcError } from '../../hooks/useIpcError'
import { unwrapIpc } from '../../types/ipc'
import { useToastStore } from '../../store/toastStore'

// ── Types ─────────────────────────────────────────────────────────────────────

interface MlxStatus {
  available: boolean
  isRunning: boolean
  currentModel: string | null
  prereqInstalled: boolean | null
}

interface MlxPerf {
  tokensPerSec: string | null
}

interface MlxInstalledModel {
  id: string
  size: number // bytes
}

// ── Component ─────────────────────────────────────────────────────────────────

export const MLXProviderPanel: React.FC = () => {
  const invoke = useIpcError()
  const addToast = useToastStore(s => s.addToast)

  const [status, setStatus] = useState<MlxStatus | null>(null)
  const [perf, setPerf] = useState<MlxPerf | null>(null)
  const [installedModels, setInstalledModels] = useState<MlxInstalledModel[]>([])
  const [downloadInput, setDownloadInput] = useState('')
  const [downloadOutput, setDownloadOutput] = useState('')
  const [isDownloading, setIsDownloading] = useState(false)
  const [selectedModel, setSelectedModel] = useState('')

  // ── Data fetching ──────────────────────────────────────────────────────────

  const fetchStatus = async () => {
    try {
      const result = await invoke<MlxStatus>('mlx:get-status')
      const data = unwrapIpc<MlxStatus>(result)
      if (data) setStatus(data)
    } catch { /* useIpcError already toasts */ }
  }

  const fetchPerf = async () => {
    try {
      const result = await invoke<MlxPerf>('mlx:get-perf')
      const data = unwrapIpc<MlxPerf>(result)
      if (data) setPerf(data)
    } catch { /* non-critical */ }
  }

  const fetchInstalled = async () => {
    try {
      const result = await invoke<{ models: MlxInstalledModel[] }>('mlx:list-installed')
      const data = unwrapIpc<{ models: MlxInstalledModel[] }>(result)
      if (data) {
        setInstalledModels(data.models)
        if (!selectedModel && data.models.length > 0) {
          setSelectedModel(data.models[0]?.id ?? '')
        }
      }
    } catch { /* ignore */ }
  }

  useEffect(() => {
    fetchStatus()
    fetchPerf()
    fetchInstalled()
    const interval = setInterval(() => {
      fetchStatus()
      fetchPerf()
    }, 5000)
    return () => clearInterval(interval)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Download progress listener ─────────────────────────────────────────────

  useEffect(() => {
    const handler = (_: unknown, data: { output: string }) => {
      setDownloadOutput(prev => prev + data.output)
    }
    const unsubscribe = window.ipcRenderer.on('mlx:download-progress', handler)
    return unsubscribe
  }, [])

  // ── Non-Apple Silicon gate ─────────────────────────────────────────────────

  // Render nothing while status is loading — avoids flash on non-Apple Silicon machines
  if (status === null) return null
  if (!status.available) return null

  // ── Derived state ──────────────────────────────────────────────────────────

  const isRunning = status.isRunning
  const prereqInstalled = status.prereqInstalled
  const currentModel = status.currentModel
  const tokensPerSec = perf?.tokensPerSec ?? null

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleDownload = async () => {
    if (!downloadInput.trim() || isDownloading) return
    setIsDownloading(true)
    setDownloadOutput('')
    try {
      await invoke('mlx:download-model', { modelId: downloadInput.trim() })
      addToast('Download started', 'info')
      await fetchInstalled()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      addToast(`Download failed: ${msg}`, 'error')
    } finally {
      setIsDownloading(false)
    }
  }

  const handleDelete = async (modelId: string) => {
    try {
      await invoke('mlx:delete-model', { modelId })
      addToast(`Deleted ${modelId}`, 'success')
      setInstalledModels(prev => prev.filter(m => m.id !== modelId))
      if (selectedModel === modelId) {
        const remaining = installedModels.filter(m => m.id !== modelId)
        setSelectedModel(remaining[0]?.id ?? '')
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      addToast(`Delete failed: ${msg}`, 'error')
    }
  }

  const handleSwitch = async () => {
    if (!selectedModel || prereqInstalled === false) return
    try {
      await invoke('mlx:switch-model', { modelId: selectedModel })
      addToast(`Switched to ${selectedModel}`, 'success')
      await fetchStatus()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      addToast(`Switch failed: ${msg}`, 'error')
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4 pt-2">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Cpu size={15} className="text-copernicus-phosphor shrink-0" />
          <div>
            <h3 className="text-[11px] font-bold text-zinc-200 uppercase tracking-widest font-mono">
              MLX Native Inference
            </h3>
            <p className="text-[11px] font-mono text-zinc-500 uppercase tracking-widest mt-0.5">
              Apple Silicon Neural Engine — $0/token
            </p>
          </div>
        </div>

        <span className={`text-[11px] px-2 py-0.5 rounded font-bold font-mono uppercase tracking-widest flex items-center gap-1.5 ${
          isRunning
            ? 'bg-green-900/30 text-green-400'
            : 'bg-zinc-900/40 text-zinc-500'
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
            isRunning ? 'bg-green-400 animate-pulse' : 'bg-zinc-600'
          }`} />
          {isRunning ? 'Running' : 'Stopped'}
        </span>
      </div>

      {/* Status Card */}
      <div className="bg-black/30 border border-zinc-800/50 rounded-xl p-4">
        {isRunning && currentModel ? (
          <div className="flex items-center justify-around gap-4">
            <div className="min-w-0">
              <span className="text-[11px] font-mono text-zinc-500 uppercase tracking-widest block mb-1">
                Current Model
              </span>
              <div className="text-xs font-mono font-bold text-white truncate">{currentModel}</div>
            </div>
            <div className="h-8 w-px bg-zinc-800 shrink-0" />
            <div className="shrink-0">
              <span className="text-[11px] font-mono text-zinc-500 uppercase tracking-widest block mb-1">
                Performance
              </span>
              <div className="text-xs font-mono font-bold text-white">
                {tokensPerSec
                  ? <>{tokensPerSec} <span className="text-[11px] text-zinc-500 font-normal">tok/s</span></>
                  : <span className="text-zinc-600">—</span>
                }
              </div>
              <div className="text-[11px] font-mono text-copernicus-phosphor/60 uppercase tracking-widest mt-0.5">
                Neural Engine
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-4">
            <div>
              <span className="text-[11px] font-mono text-zinc-500 uppercase tracking-widest block mb-1">
                Current Model
              </span>
              <div className="text-xs font-mono text-zinc-600">No model loaded</div>
            </div>
            <button
              disabled={prereqInstalled === false}
              className="px-4 py-2 bg-copernicus-phosphor text-black text-[11px] font-bold font-mono uppercase tracking-widest rounded hover:shadow-[0_0_15px_rgba(163,255,18,0.3)] transition-all disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
            >
              Start Server
            </button>
          </div>
        )}
      </div>

      {/* Prerequisites Warning */}
      {prereqInstalled === false && (
        <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-2">
            <AlertTriangle size={11} className="text-red-400 shrink-0" />
            <span className="text-[11px] font-mono text-red-400 uppercase tracking-widest font-bold">
              MLX LM Not Installed
            </span>
          </div>
          <code className="block bg-black/40 px-3 py-2 rounded font-mono text-[11px] text-zinc-400 border border-zinc-800/50">
            pip install mlx-lm
          </code>
          <button
            onClick={() =>
              navigator.clipboard
                .writeText('pip install mlx-lm')
                .then(() => addToast('Copied!', 'success'))
            }
            className="text-[11px] font-mono text-zinc-500 uppercase tracking-widest hover:text-copernicus-phosphor transition-colors"
          >
            Copy Command
          </button>
        </div>
      )}

      {/* Installed Models */}
      <div className="bg-black/30 border border-zinc-800/50 rounded-xl p-4 space-y-3">
        <span className="text-[11px] font-mono text-zinc-500 uppercase tracking-widest block">
          Local Model Assets
        </span>
        {installedModels.length === 0 ? (
          <p className="text-[11px] font-mono text-zinc-600">No models downloaded yet</p>
        ) : (
          <div className="space-y-1">
            {installedModels.map(model => (
              <div
                key={model.id}
                className="flex items-center justify-between p-3 bg-zinc-900/30 hover:bg-zinc-900/60 border border-zinc-800/30 rounded transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Zap
                    size={13}
                    className={`shrink-0 ${model.id === currentModel ? 'text-copernicus-phosphor' : 'text-zinc-600'}`}
                  />
                  <div className="min-w-0">
                    <div className="font-mono text-xs text-zinc-300 truncate">{model.id}</div>
                    <div className="text-[11px] font-mono text-zinc-600 uppercase">
                      {model.size > 0 ? `${(model.size / 1e9).toFixed(1)} GB` : 'Unknown size'}
                      {model.id === currentModel && ' • Active'}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(model.id)}
                  className="text-zinc-600 hover:text-red-400 transition-colors shrink-0 ml-3"
                  title={`Delete ${model.id}`}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Download New Model */}
      <div className="bg-black/30 border border-zinc-800/50 rounded-xl p-4 space-y-3">
        <span className="text-[11px] font-mono text-zinc-500 uppercase tracking-widest block">
          Download from MLX-Community
        </span>
        <div className="flex gap-2">
          <input
            type="text"
            value={downloadInput}
            onChange={e => setDownloadInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleDownload() }}
            placeholder="mlx-community/model-id"
            disabled={isDownloading || prereqInstalled === false}
            className="flex-1 bg-black/40 border border-zinc-800 focus:border-copernicus-phosphor/50 focus:ring-0 text-[11px] font-mono text-white placeholder:text-zinc-700 px-3 py-2 outline-none rounded disabled:opacity-40 transition-colors"
          />
          <button
            onClick={handleDownload}
            disabled={isDownloading || !downloadInput.trim() || prereqInstalled === false}
            className="px-4 py-2 bg-copernicus-phosphor text-black font-mono text-[11px] font-bold uppercase tracking-widest rounded hover:shadow-[0_0_15px_rgba(163,255,18,0.3)] transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 shrink-0"
          >
            {isDownloading
              ? <Activity size={10} className="animate-spin" />
              : <Download size={10} />
            }
            {isDownloading ? 'Downloading…' : 'Download'}
          </button>
        </div>
        {downloadOutput && (
          <pre className="bg-black/40 border border-zinc-800/50 rounded p-3 font-mono text-[11px] text-zinc-500 overflow-x-auto max-h-32 overflow-y-auto whitespace-pre-wrap">
            {downloadOutput}
          </pre>
        )}
      </div>

      {/* Switch Active Model */}
      <div className="bg-black/30 border border-zinc-800/50 rounded-xl p-4 space-y-3">
        <span className="text-[11px] font-mono text-zinc-500 uppercase tracking-widest block">
          Switch Active Model
        </span>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <select
              value={selectedModel}
              onChange={e => setSelectedModel(e.target.value)}
              disabled={installedModels.length === 0 || prereqInstalled === false}
              className="w-full bg-black/40 border border-zinc-800 rounded py-2 pl-3 pr-8 text-[11px] font-mono text-zinc-300 appearance-none focus:outline-none focus:border-copernicus-phosphor/50 disabled:opacity-40 cursor-pointer transition-colors"
            >
              {installedModels.length === 0
                ? <option value="">No models installed</option>
                : installedModels.map(m => <option key={m.id} value={m.id}>{m.id}</option>)
              }
            </select>
            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-600 text-xs">▾</span>
          </div>
          <button
            onClick={handleSwitch}
            disabled={!selectedModel || installedModels.length === 0 || prereqInstalled === false}
            className="px-4 py-2 bg-zinc-900 border border-zinc-800 text-zinc-300 font-mono text-[11px] uppercase tracking-widest rounded hover:text-copernicus-phosphor hover:border-copernicus-phosphor/40 transition-all flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
          >
            <RefreshCcw size={10} />
            Switch
          </button>
        </div>
      </div>

    </div>
  )
}
