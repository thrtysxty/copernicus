import React, { useState, useEffect } from 'react'
import { useIpcError } from '../../../hooks/useIpcError'
import { useToastStore } from '../../../store/toastStore'
import { Github, Settings, HardDrive } from 'lucide-react'
import { SettingsLoadResponse } from '../../../types/ipc'

interface GitDefaults {
  defaultBranch: string
  gitignoreTemplate: string
  commitTemplate: string
  authorName: string
  authorEmail: string
}

export const GitSection: React.FC = () => {
  const invoke = useIpcError()
  const addToast = useToastStore(s => s.addToast)
  
  const [githubStatus, setGithubStatus] = useState<{ ok: boolean; login: string; avatar_url: string } | null>(null)
  const [githubToken, setGithubToken] = useState('')
  
  const [defaults, setDefaults] = useState<GitDefaults>({
    defaultBranch: 'main',
    gitignoreTemplate: 'Node',
    commitTemplate: '{type}: {description}',
    authorName: '',
    authorEmail: ''
  })

  const refreshGithubStatus = async () => {
    try {
      const result = await invoke<{ ok: boolean; login: string; avatar_url: string }>('github:test-connection')
      if (result.ok) {
        setGithubStatus(result)
      } else {
        setGithubStatus(null)
      }
    } catch {
      setGithubStatus(null)
    }
  }

  useEffect(() => {
    refreshGithubStatus()
    invoke<SettingsLoadResponse>('settings:load').then(result => {
      if (result?.gitDefaults) setDefaults(result.gitDefaults as GitDefaults)
    }).catch(() => {})
  }, [invoke])

  const handleConnect = async () => {
    if (!githubToken) return
    try {
      await invoke('auth:store-api-key', 'github', githubToken.trim())
      setGithubToken('')
      refreshGithubStatus()
      addToast('GitHub token saved', 'success')
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      addToast(`Save failed: ${message}`, 'error')
    }
  }

  const handleDisconnect = async () => {
    try {
      await invoke('auth:revoke', 'github')
      setGithubStatus(null)
      addToast('GitHub disconnected', 'success')
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      addToast(`Revoke failed: ${message}`, 'error')
    }
  }

  const handleSaveDefaults = async (patch: Partial<GitDefaults>) => {
    const newDefaults = { ...defaults, ...patch }
    setDefaults(newDefaults)
    try {
      await invoke('settings:save', { gitDefaults: newDefaults })
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      addToast(`Save failed: ${message}`, 'error')
    }
  }

  const handleInitWorkspace = async () => {
    try {
      const result = await invoke<{ ok: boolean; message?: string; error?: string }>('git:init-workspace', defaults)
      if (result.ok) {
        addToast(result.message || 'Workspace initialized', 'success')
      } else {
        addToast(`Init failed: ${result.error || 'Unknown error'}`, 'error')
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      addToast(`Command failed: ${message}`, 'error')
    }
  }

  return (
    <div className="space-y-10">
      <div>
        <h2 className="text-sm font-bold text-zinc-200 uppercase tracking-widest font-mono">Git & GitHub</h2>
        <p className="text-[11px] text-zinc-500 font-mono mt-1">Configure version control integration and repository defaults.</p>
      </div>

      {/* GitHub Connection */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 text-zinc-400">
          <Github size={14} />
          <h3 className="text-[11px] uppercase font-bold tracking-wider">GitHub Connection</h3>
        </div>
        
        <div className="bg-zinc-900/30 border border-zinc-800 rounded-lg overflow-hidden">
          {githubStatus ? (
            <div className="p-4 flex items-center justify-between animate-in fade-in">
              <div className="flex items-center gap-4">
                <img src={githubStatus.avatar_url} className="w-10 h-10 rounded-full border border-zinc-700" alt="Avatar" />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-zinc-200 uppercase font-mono">{githubStatus.login}</span>
                    <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20 font-bold uppercase">
                      Connected
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-500 font-mono mt-0.5 tracking-tighter">Authenticated via Personal Access Token</p>
                </div>
              </div>
              <button 
                onClick={handleDisconnect}
                className="px-3 py-1.5 bg-red-900/10 border border-red-900/30 rounded text-[11px] font-bold text-red-400 uppercase hover:bg-red-900/20 transition-colors font-mono"
              >
                Disconnect
              </button>
            </div>
          ) : (
            <div className="p-4 space-y-4">
              <div className="space-y-1.5">
                <label className="text-[11px] text-zinc-500 uppercase font-bold">Personal Access Token</label>
                <div className="flex gap-2">
                  <input 
                    type="password" 
                    value={githubToken}
                    onChange={e => setGithubToken(e.target.value)}
                    placeholder="ghp_..."
                    className="flex-1 bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-xs font-mono focus:border-copernicus-phosphor focus:outline-none"
                  />
                  <button 
                    onClick={handleConnect}
                    className="px-4 py-2 bg-copernicus-phosphor text-black rounded text-[11px] font-bold uppercase hover:bg-green-400 transition-colors font-mono"
                  >
                    Connect
                  </button>
                </div>
                <p className="text-[11px] text-zinc-600 italic">Required for repository creation and codebase integration.</p>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Default Boilerplate */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 text-zinc-400">
          <Settings size={14} />
          <h3 className="text-[11px] uppercase font-bold tracking-wider">Repository Boilerplate</h3>
        </div>

        <div className="grid grid-cols-2 gap-6 bg-zinc-900/30 border border-zinc-800 p-6 rounded-lg">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[11px] text-zinc-500 uppercase font-bold">Default Branch</label>
              <input 
                type="text" 
                value={defaults.defaultBranch}
                onChange={e => handleSaveDefaults({ defaultBranch: e.target.value })}
                className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-xs font-mono focus:border-copernicus-phosphor focus:outline-none"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] text-zinc-500 uppercase font-bold">.gitignore Template</label>
              <select 
                value={defaults.gitignoreTemplate}
                onChange={e => handleSaveDefaults({ gitignoreTemplate: e.target.value })}
                className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-xs font-mono focus:border-copernicus-phosphor focus:outline-none"
              >
                {['None', 'Node', 'Python', 'Rust', 'Go', 'Custom'].map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[11px] text-zinc-500 uppercase font-bold">Author Name</label>
              <input 
                type="text" 
                value={defaults.authorName}
                onChange={e => handleSaveDefaults({ authorName: e.target.value })}
                placeholder="Global Git Config"
                className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-xs font-mono focus:border-copernicus-phosphor focus:outline-none"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] text-zinc-500 uppercase font-bold">Author Email</label>
              <input 
                type="email" 
                value={defaults.authorEmail}
                onChange={e => handleSaveDefaults({ authorEmail: e.target.value })}
                placeholder="Global Git Config"
                className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-xs font-mono focus:border-copernicus-phosphor focus:outline-none"
              />
            </div>
          </div>

          <div className="col-span-2 space-y-1.5">
            <label className="text-[11px] text-zinc-500 uppercase font-bold">Commit Message Template</label>
            <textarea 
              value={defaults.commitTemplate}
              onChange={e => handleSaveDefaults({ commitTemplate: e.target.value })}
              rows={2}
              className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-xs font-mono focus:border-copernicus-phosphor focus:outline-none resize-none"
            />
          </div>

          <button 
            onClick={handleInitWorkspace}
            className="col-span-2 flex items-center justify-center gap-2 py-2.5 bg-zinc-800 border border-zinc-700 rounded text-[11px] font-bold uppercase hover:border-copernicus-phosphor hover:text-copernicus-phosphor transition-all font-mono"
          >
            <HardDrive size={14} /> Apply to Current Workspace
          </button>
        </div>
      </section>
    </div>
  )
}
