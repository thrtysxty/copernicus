import React, { useEffect, useState } from 'react'
import Editor from '@monaco-editor/react'
import { useOrchestratorStore } from '../../store/orchestrator'
import { ORCHESTRATOR_TILES } from './tiles'
import { useIpcError } from '../../hooks/useIpcError'
import { unwrapIpc } from '../../types/ipc'
import { useWorkspaceStore } from '../../store/layout'
import { 
  GitBranch, 
  Search, 
  CheckCircle, 
  Box, 
  Monitor,
  X,
  Code,
  Variable,
  Database
} from 'lucide-react'

const ICON_MAP: Record<string, any> = {
  'GitBranch': GitBranch,
  'MagnifyingGlass': Search,
  'CheckCircle': CheckCircle,
  'Cube': Box,
  'Browser': Monitor,
}

export const TileInspector: React.FC = () => {
  const { selectedNodeId, canvasNodes, updateNode, setSelectedNodeId } = useOrchestratorStore()
  const workingDir = useWorkspaceStore(s => s.workingDir)
  const invoke = useIpcError()
  
  const [repos, setRepos] = useState<string[]>([])

  const node = canvasNodes.find(n => n.id === selectedNodeId)
  const tile = node ? ORCHESTRATOR_TILES.find(t => t.id === node.tileId) : null

  useEffect(() => {
    if (node && (tile?.category === 'vcs' || tile?.category === 'container')) { // Only fetch if a relevant tile is selected
      invoke<string[]>('fs:list-dir', workingDir)
        .then(res => {
          const data = unwrapIpc<string[]>(res)
          if (Array.isArray(data)) {
            // Filter out hidden directories and only keep directories
            setRepos(data.filter(name => !name.startsWith('.')))
          }
        })
        .catch(() => {})
    } else {
        setRepos([]); // Clear repos if no relevant tile is selected
    }
  }, [node, tile?.category, workingDir, invoke])


  const handleConfigChange = (key: string, value: string) => {
    updateNode(node!.id, { config: { ...node!.config, [key]: value } })
  }

  const handleVariableInsert = (variable: string) => {
    const currentCommand = node!.config.command || ''
    handleConfigChange('command', currentCommand + variable)
  }

  const showScriptEditor = node && tile && ['git', 'search', 'docker', 'playwright'].includes(tile.id)
  const scriptLanguage = node && tile && tile.id === 'search' ? 'plaintext' : 'shell'
  const Icon = node && tile && ICON_MAP[tile.icon] || Box

  return (
    <aside className="w-[240px] flex-shrink-0 bg-[#050505] border-l border-copernicus-steel flex flex-col h-full overflow-hidden select-none">
      {/* Always visible header bar */}
      <div className="h-9 flex items-center justify-between px-3 border-b border-copernicus-steel bg-[#080808] shrink-0">
        {node && tile ? (
          <>
            <Icon size={14} className="text-copernicus-phosphor" />
            <span className="text-[10px] font-mono uppercase tracking-[0.2em] font-black text-copernicus-phosphor flex-1 truncate ml-2">
              {tile.label}
            </span>
          </>
        ) : (
          <span className="text-[10px] font-mono uppercase tracking-[0.2em] font-black text-copernicus-phosphor flex-1">
            TILE INSPECTOR
          </span>
        )}
        {node && ( // Only show close button if a node is selected
          <button 
            onClick={() => setSelectedNodeId(null)}
            className="text-zinc-500 hover:text-white transition-colors p-1"
            title="Close Inspector"
          >
            <X size={12} />
          </button>
        )}
      </div>

      {!node || !tile ? (
        // Empty state when no node is selected
        <div className="flex-1 flex items-center justify-center">
          <span className="text-zinc-600 font-mono text-[11px]">Select a tile to inspect</span>
        </div>
      ) : (
        // Existing content when a node is selected
        <>
          <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-6">
            {/* Repo Selector for VCS/Container */}
            {(tile.category === 'vcs' || tile.category === 'container') && (
              <div className="space-y-2">
                <label className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                  <Database size={10} /> Workspace Repo
                </label>
                <select
                  value={node.config.repo || ''}
                  onChange={(e) => handleConfigChange('repo', e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 text-[10px] font-mono text-zinc-300 p-1.5 outline-none focus:border-copernicus-phosphor/50"
                >
                  <option value="">Select repo...</option>
                  {repos.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            )}

            {/* Dynamic Config Fields */}
            {tile.configSchema.map(field => (
              <div key={field.key} className="space-y-2">
                <label className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest">
                  {field.label}
                </label>
                {field.type === 'select' ? (
                  <select
                    value={node.config[field.key] || ''}
                    onChange={(e) => handleConfigChange(field.key, e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 text-[10px] font-mono text-zinc-300 p-1.5 outline-none focus:border-copernicus-phosphor/50"
                  >
                    {field.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={node.config[field.key] || ''}
                    onChange={(e) => handleConfigChange(field.key, e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 text-[10px] font-mono text-zinc-300 p-1.5 outline-none focus:border-copernicus-phosphor/50"
                  />
                )}
              </div>
            ))}

            {/* Script Editor */}
            {showScriptEditor && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                    <Code size={10} /> Script Command
                  </label>
                  <div className="flex items-center gap-1">
                    <Variable size={10} className="text-zinc-600" />
                    <select
                      onChange={(e) => {
                        if (e.target.value) {
                          handleVariableInsert(e.target.value)
                          e.target.value = ''
                        }
                      }}
                      className="bg-transparent border-none text-[8px] font-mono text-zinc-500 uppercase outline-none cursor-pointer hover:text-copernicus-phosphor"
                    >
                      <option value="">Insert variable</option>
                      <option value="{{storyId}}">storyId</option>
                      <option value="{{storyTitle}}">storyTitle</option>
                      <option value="{{branch}}">branch</option>
                      <option value="{{repoUrl}}">repoUrl</option>
                      <option value="{{lastOutput}}">lastOutput</option>
                    </select>
                  </div>
                </div>
                <div className="border border-zinc-800 rounded overflow-hidden">
                  <Editor
                    height="120px"
                    theme="vs-dark"
                    language={scriptLanguage}
                    value={node.config.command || ''}
                    onChange={(val) => handleConfigChange('command', val || '')}
                    options={{
                      minimap: { enabled: false },
                      fontSize: 10,
                      fontFamily: 'monospace',
                      lineNumbers: 'off',
                      scrollBeyondLastLine: false,
                      glyphMargin: false,
                      folding: false,
                      lineDecorationsWidth: 0,
                      lineNumbersMinChars: 0,
                      padding: { top: 8, bottom: 8 },
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="p-4 border-t border-zinc-800 bg-[#080808]/50 mt-auto">
            <p className="text-[9px] font-mono text-zinc-600 leading-relaxed uppercase tracking-wider">
              Node ID: <span className="text-zinc-500">{node.id}</span>
            </p>
          </div>
        </>
      )}
    </aside>
  )
}
