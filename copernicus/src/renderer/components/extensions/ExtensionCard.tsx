import React from 'react'
import { Download, Trash2, ShieldAlert } from 'lucide-react'

interface ExtensionCardProps {
  name: string
  displayName: string
  version: string
  description?: string
  publisher?: string
  isInstalled: boolean
  isActive?: boolean
  capabilities?: any
  onInstall?: () => void
  onUninstall?: () => void
  isBusy?: boolean
}

export const ExtensionCard: React.FC<ExtensionCardProps> = ({
  name,
  displayName,
  version,
  description,
  publisher,
  isInstalled,
  isActive,
  capabilities,
  onInstall,
  onUninstall,
  isBusy
}) => {
  const hasCapabilities = capabilities && Object.keys(capabilities).length > 0

  return (
    <div className="bg-[#050505] border border-copernicus-steel p-4 flex flex-col gap-3 rounded-sm hover:border-zinc-700 transition-colors">
      <div className="flex justify-between items-start gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-zinc-200 font-medium truncate" title={displayName}>{displayName}</h3>
            <span className="text-[11px] font-mono text-zinc-500 px-1.5 py-0.5 bg-zinc-900 rounded-sm">v{version}</span>
          </div>
          <div className="text-xs text-zinc-500 font-mono truncate mb-2">{publisher ? `${publisher} • ` : ''}{name}</div>
          <p className="text-sm text-zinc-400 line-clamp-2" title={description}>{description || 'No description provided'}</p>
        </div>

        <div className="flex-shrink-0 flex flex-col items-end gap-2">
          {isInstalled ? (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-2 py-1 bg-zinc-900 rounded-sm border border-zinc-800">
                <div className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' : 'bg-zinc-600'}`} />
                <span className="text-[11px] font-mono text-zinc-400 uppercase">{isActive ? 'Active' : 'Inactive'}</span>
              </div>
              <button
                onClick={onUninstall}
                disabled={isBusy}
                className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-400/10 rounded-sm transition-colors disabled:opacity-50"
                title="Uninstall Extension"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ) : (
            <button
              onClick={onInstall}
              disabled={isBusy}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-copernicus-phosphor text-[#050505] font-mono text-[11px] uppercase font-bold hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed rounded-none"
            >
              {isBusy ? (
                <span className="animate-pulse">Installing...</span>
              ) : (
                <>
                  <Download size={14} />
                  Install
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {hasCapabilities && (
        <div className="flex items-center gap-1.5 text-[11px] font-mono text-amber-500/80 mt-1">
          <ShieldAlert size={12} />
          <span>Requires permissions</span>
        </div>
      )}
    </div>
  )
}
