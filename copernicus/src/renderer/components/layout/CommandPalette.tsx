import React, { useEffect, useState, useMemo, useRef } from 'react'
import { motion } from 'framer-motion'
import { useIpcError } from '../../hooks/useIpcError'
import { commandRegistry, CommandContext } from '../../commands/registry'
import { useToastStore } from '../../store/toastStore'
import { File, Hash, Terminal, Command as CmdIcon, ArrowRight } from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────────────

interface CommandPaletteProps {
  mode: 'all' | 'commands'
  onClose: () => void
  onFileOpen: (filePath: string, content: string, language: string) => void
  rootPath: string
}

type ResultType = 'file' | 'story' | 'command' | 'agent'

interface SearchResult {
  id: string
  type: ResultType
  label: string
  description?: string
  hotkey?: string
  score: number
  payload: any
}

// ── Constants ──────────────────────────────────────────────────────────────

const AGENTS = [
  { id: 'sentinel', name: 'Sentinel', description: 'Security Audit Agent' },
  { id: 'claude', name: 'Claude', description: 'Primary Coding Agent' },
  { id: 'gemini', name: 'Gemini', description: 'Secondary Reasoning Agent' },
  { id: 'jules', name: 'Jules', description: 'Engineering Agent' },
]

// ── Scoring Logic ──────────────────────────────────────────────────────────

function calculateScore(query: string, text: string): number {
  if (!query) return 1
  const lowerQuery = query.toLowerCase()
  const lowerText = text.toLowerCase()
  
  let score = 0
  let queryIdx = 0
  let prevMatchIdx = -1

  for (let i = 0; i < lowerText.length; i++) {
    if (queryIdx < lowerQuery.length && lowerText[i] === lowerQuery[queryIdx]) {
      score += 10
      // Bonus for consecutive matches
      if (prevMatchIdx !== -1 && i === prevMatchIdx + 1) {
        score += 5
      }
      // Bonus for match at start or after separator
      if (i === 0 || /[/\-_ ]/.test(lowerText[i - 1])) {
        score += 5
      }
      prevMatchIdx = i
      queryIdx++
    } else {
      score -= 1 // Small penalty for gaps
    }
  }

  // If we didn't match the full query, return -1
  if (queryIdx < lowerQuery.length) return -1
  
  // Prefer shorter matches (exact matches rank higher)
  score -= (lowerText.length - lowerQuery.length) * 0.5
  
  return score
}

// ── Component ──────────────────────────────────────────────────────────────

export const CommandPalette: React.FC<CommandPaletteProps> = ({ mode, onClose, onFileOpen, rootPath }) => {
  const invoke = useIpcError()
  const inputRef = useRef<HTMLInputElement>(null)
  
  const [query, setQuery] = useState('')
  const [rawFiles, setRawFiles] = useState<any[]>([])
  const [rawStories, setRawStories] = useState<any[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)

  // 1. Load Data on Mount
  useEffect(() => {
    inputRef.current?.focus()

    if (mode === 'all') {
      // Load Files (recursive list-dir if possible, or just top level for now)
      invoke<{ ok: boolean, data: any[] }>('fs:list-dir', rootPath)
        .then(res => {
          if (res.ok) setRawFiles(res.data.filter((f: any) => !f.isDir))
        })
        .catch(() => {}) // Error handled by useIpcError

      // Load Stories
      invoke<any[]>('stories:list')
        .then(res => setRawStories(res || []))
        .catch(() => {})
    }
  }, [mode, invoke, rootPath])

  // 2. Filter & Score Results
  const results = useMemo(() => {
    const list: SearchResult[] = []

    // A. Commands
    const commands = commandRegistry.list()
    commands.forEach(cmd => {
      const s = calculateScore(query, cmd.name + ' ' + cmd.description)
      if (s > -50) { // arbitrary threshold
        list.push({
          id: `cmd-${cmd.name}`,
          type: 'command',
          label: cmd.name,
          description: cmd.description,
          score: s + 50, // Commands prioritized in command mode? Or just generally high?
          payload: cmd
        })
      }
    })

    if (mode === 'all') {
      // B. Agents
      AGENTS.forEach(agent => {
        const s = calculateScore(query, agent.name + ' ' + agent.description)
        if (s > -50) {
          list.push({
            id: `agent-${agent.id}`,
            type: 'agent',
            label: agent.name,
            description: agent.description,
            score: s + 40,
            payload: agent
          })
        }
      })

      // C. Files
      rawFiles.forEach(file => {
        const s = calculateScore(query, file.name)
        if (s > -50) {
          list.push({
            id: `file-${file.path}`,
            type: 'file',
            label: file.name,
            description: file.path.replace(rootPath, ''),
            score: s, // Files usually rank lower unless exact match
            payload: file
          })
        }
      })

      // D. Stories
      rawStories.forEach(story => {
        const label = story.title || story.id
        const s = calculateScore(query, label)
        if (s > -50) {
          list.push({
            id: `story-${story.id}`,
            type: 'story',
            label: label,
            description: story.status,
            score: s + 10, // Stories slightly boosted
            payload: story
          })
        }
      })
    }

    // Sort by score descending
    return list.sort((a, b) => b.score - a.score).slice(0, 50) // Limit to 50 results
  }, [query, mode, rawFiles, rawStories])

  // Reset selection when results change
  useEffect(() => {
    setSelectedIndex(0)
  }, [results])

  // 3. Execution Logic
  const execute = (item: SearchResult) => {
    const ipcRenderer = (window as any).ipcRenderer

    switch (item.type) {
      case 'file': {
        // Open file
        invoke<{ ok: boolean, data?: string }>('fs:open-file', item.payload.path)
          .then(res => {
            if (res.ok && res.data !== undefined) {
              const ext = item.payload.name.split('.').pop() || 'txt'
              const langMap: Record<string, string> = {
                  ts: 'typescript', tsx: 'typescript', js: 'javascript',
                  jsx: 'javascript', py: 'python', md: 'markdown',
                  json: 'json', css: 'css', html: 'html', sh: 'shell',
              }
              onFileOpen(item.payload.path, res.data, langMap[ext] || 'plaintext')
            }
          })
        break
      }

      case 'story': {
        // Hydrate story (opens in editor per existing logic)
        invoke('stories:hydrate', item.payload.id)
        break
      }

      case 'agent': {
        // Spawn agent
        ipcRenderer.send('terminal:spawn-agent', { agentId: item.payload.id })
        break
      }

      case 'command': {
        // Execute command
        const cmdContext: CommandContext = {
          appendMessage: (role, content) => {
             useToastStore.getState().addToast(`[${role.toUpperCase()}] ${content}`, 'info')
          },
          clearMessages: () => {},
          setModel: () => {
             useToastStore.getState().addToast('Model switching not supported in palette', 'warn')
          },
          getCurrentModel: () => 'unknown'
        }
        commandRegistry.execute(item.label, cmdContext)
        break
      }
    }
    
    onClose()
  }

  // 4. Keyboard Handling
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex(prev => (prev + 1) % results.length)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex(prev => (prev - 1 + results.length) % results.length)
      } else if (e.key === 'Enter') {
        e.preventDefault()
        if (results[selectedIndex]) {
          execute(results[selectedIndex])
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [results, selectedIndex, onClose])

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[10vh] bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: -20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.15 }}
        className="w-[600px] max-w-[90vw] bg-[#0A0A0A] border border-copernicus-steel rounded-lg shadow-2xl flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Search Input */}
        <div className="flex items-center px-4 py-3 border-b border-copernicus-steel/50 bg-[#111]">
          <ArrowRight size={16} className="text-copernicus-phosphor mr-3" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={mode === 'commands' ? "Type a command..." : "Type to search files, stories, commands..."}
            className="flex-1 bg-transparent border-none outline-none text-zinc-200 text-sm font-mono placeholder-zinc-600"
            autoFocus
          />
          <div className="flex gap-2 text-[10px] text-zinc-500 uppercase tracking-wider">
            <span>Cmd+P</span>
            <span className="opacity-50">to nav</span>
          </div>
        </div>

        {/* Results List */}
        <div className="max-h-[400px] overflow-y-auto scrollbar-thin scrollbar-thumb-copernicus-steel">
          {results.length === 0 ? (
            <div className="p-8 text-center text-zinc-600 text-xs uppercase tracking-widest">
              No results found
            </div>
          ) : (
            results.map((item, idx) => (
              <div
                key={item.id}
                className={`flex items-center px-4 py-2 cursor-pointer border-l-2 transition-colors
                  ${idx === selectedIndex 
                    ? 'bg-copernicus-phosphor/10 border-copernicus-phosphor' 
                    : 'bg-transparent border-transparent hover:bg-zinc-900'
                  }`}
                onClick={() => execute(item)}
                onMouseEnter={() => setSelectedIndex(idx)}
              >
                <div className="mr-3 text-zinc-500">
                  {item.type === 'file' && <File size={14} />}
                  {item.type === 'story' && <Hash size={14} />}
                  {item.type === 'command' && <CmdIcon size={14} />}
                  {item.type === 'agent' && <Terminal size={14} />}
                </div>
                <div className="flex-1 overflow-hidden">
                  <div className={`text-sm truncate font-mono ${idx === selectedIndex ? 'text-copernicus-phosphor' : 'text-zinc-300'}`}>
                    {item.label}
                  </div>
                  {item.description && (
                    <div className="text-[10px] text-zinc-600 truncate">
                      {item.description}
                    </div>
                  )}
                </div>
                {item.type === 'command' && (
                  <div className="text-[9px] text-zinc-600 bg-zinc-900 px-1.5 py-0.5 rounded border border-zinc-800">
                    CMD
                  </div>
                )}
                {item.type === 'agent' && (
                    <div className="text-[9px] text-zinc-600 bg-zinc-900 px-1.5 py-0.5 rounded border border-zinc-800">
                        AGENT
                    </div>
                )}
              </div>
            ))
          )}
        </div>
        
        {/* Footer */}
        <div className="bg-[#050505] px-3 py-1 border-t border-copernicus-steel/30 flex justify-between items-center text-[9px] text-zinc-600 uppercase tracking-wider">
            <div>
                {results.length} results
            </div>
            <div className="flex gap-3">
                <span><b className="text-zinc-400">↑↓</b> Select</span>
                <span><b className="text-zinc-400">Enter</b> Open</span>
                <span><b className="text-zinc-400">Esc</b> Close</span>
            </div>
        </div>
      </motion.div>
    </div>
  )
}
