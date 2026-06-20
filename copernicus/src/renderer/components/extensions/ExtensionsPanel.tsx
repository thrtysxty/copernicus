import React, { useState, useEffect } from 'react'
import { Puzzle, Search, Loader2 } from 'lucide-react'
import { useIpcError } from '../../hooks/useIpcError'
import { unwrapIpc } from '../../types/ipc'
import { ExtensionCard } from './ExtensionCard'

interface InstalledExtension {
  name: string
  displayName: string
  version: string
  active: boolean
  manifest: any
  error?: string
}

interface RemoteExtension {
  name: string
  version: string
  description?: string
  publisher?: { username: string }
}

export const ExtensionsPanel: React.FC = () => {
  const invoke = useIpcError()
  const [installed, setInstalled] = useState<InstalledExtension[]>([])
  const [searchResults, setSearchResults] = useState<RemoteExtension[]>([])
  const [query, setQuery] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [busyExtensions, setBusyExtensions] = useState<Set<string>>(new Set())
  const [activeTab, setActiveTab] = useState<'installed' | 'marketplace'>('installed')

  const loadInstalled = async () => {
    const res = await invoke<any>('extension:list')
    if (res.ok && res.data) {
      const data = unwrapIpc<{ installed: InstalledExtension[] }>(res)
      if (data) {
        setInstalled(data.installed)
      }
    }
  }

  useEffect(() => {
    loadInstalled()
  }, [])

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim()) return

    setIsSearching(true)
    setActiveTab('marketplace')

    try {
      const res = await invoke<any>('extension:search', query)
      if (res.ok && res.data) {
        const data = unwrapIpc<RemoteExtension[]>(res)
        if (data) {
          setSearchResults(data)
        }
      }
    } finally {
      setIsSearching(false)
    }
  }

  const handleInstall = async (packageName: string) => {
    setBusyExtensions(prev => new Set(prev).add(packageName))
    try {
      const res = await invoke<any>('extension:install', packageName)
      if (res.ok && res.data) {
        const data = unwrapIpc<{ installed: InstalledExtension[] }>(res)
        if (data) {
          setInstalled(data.installed)
          // Switch back to installed tab after successful install
          setActiveTab('installed')
        }
      }
    } finally {
      setBusyExtensions(prev => {
        const next = new Set(prev)
        next.delete(packageName)
        return next
      })
    }
  }

  const handleUninstall = async (packageName: string) => {
    setBusyExtensions(prev => new Set(prev).add(packageName))
    try {
      const res = await invoke<any>('extension:uninstall', packageName)
      if (res.ok && res.data) {
        const data = unwrapIpc<{ installed: InstalledExtension[] }>(res)
        if (data) {
          setInstalled(data.installed)
        }
      }
    } finally {
      setBusyExtensions(prev => {
        const next = new Set(prev)
        next.delete(packageName)
        return next
      })
    }
  }

  const isInstalledCache = new Set(installed.map(e => e.name))

  return (
    <div data-testid="panel-extensions" className="flex flex-col h-full bg-[#080808] text-zinc-300">
      <div className="h-10 px-4 border-b border-copernicus-steel flex items-center gap-3 shrink-0 bg-[#050505]">
        <Puzzle size={16} className="text-zinc-500" />
        <h2 className="text-xs font-mono uppercase tracking-widest text-zinc-400">Extensions</h2>
      </div>

      <div className="p-4 border-b border-copernicus-steel bg-[#050505] shrink-0">
        <form onSubmit={handleSearch} className="relative flex items-center">
          <Search size={14} className="absolute left-3 text-zinc-500" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search extensions in npm (copernicus-extension keyword)..."
            className="w-full bg-[#080808] border border-copernicus-steel rounded-sm pl-9 pr-4 py-2 text-sm text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:border-copernicus-phosphor transition-colors font-mono"
          />
          {isSearching && (
            <Loader2 size={14} className="absolute right-3 text-zinc-500 animate-spin" />
          )}
        </form>

        <div className="flex items-center gap-4 mt-4 text-[11px] font-mono uppercase tracking-widest">
          <button
            onClick={() => setActiveTab('installed')}
            className={`px-2 py-1.5 transition-colors ${activeTab === 'installed' ? 'bg-copernicus-phosphor/10 text-zinc-200' : 'text-zinc-500 hover:text-zinc-400'}`}
          >
            Installed ({installed.length})
          </button>
          <button
            onClick={() => setActiveTab('marketplace')}
            className={`px-2 py-1.5 transition-colors ${activeTab === 'marketplace' ? 'bg-copernicus-phosphor/10 text-zinc-200' : 'text-zinc-500 hover:text-zinc-400'}`}
          >
            Marketplace {searchResults.length > 0 ? `(${searchResults.length})` : ''}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'installed' && (
          <div className="flex flex-col gap-3">
            {installed.length === 0 ? (
              <div className="text-center py-12 text-zinc-600 font-mono text-xs">
                No extensions installed
              </div>
            ) : (
              installed.map(ext => (
                <ExtensionCard
                  key={ext.name}
                  name={ext.name}
                  displayName={ext.displayName || ext.manifest?.displayName || ext.name}
                  version={ext.version}
                  description={ext.manifest?.description}
                  isInstalled={true}
                  isActive={ext.active}
                  capabilities={ext.manifest?.capabilities}
                  onUninstall={() => handleUninstall(ext.name)}
                  isBusy={busyExtensions.has(ext.name)}
                />
              ))
            )}
          </div>
        )}

        {activeTab === 'marketplace' && (
          <div className="flex flex-col gap-3">
            {searchResults.length === 0 ? (
              <div className="text-center py-12 text-zinc-600 font-mono text-xs">
                {query ? 'No results found' : 'Search to find extensions'}
              </div>
            ) : (
              searchResults.map(ext => (
                <ExtensionCard
                  key={ext.name}
                  name={ext.name}
                  displayName={ext.name}
                  version={ext.version}
                  description={ext.description}
                  publisher={ext.publisher?.username}
                  isInstalled={isInstalledCache.has(ext.name)}
                  isActive={installed.find(i => i.name === ext.name)?.active}
                  onInstall={() => handleInstall(ext.name)}
                  onUninstall={() => handleUninstall(ext.name)}
                  isBusy={busyExtensions.has(ext.name)}
                />
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}
