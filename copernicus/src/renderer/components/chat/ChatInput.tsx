import React from 'react'
import { Send, Paperclip, FileText } from 'lucide-react'
import { ContextChip } from './ContextChip'
import { Command } from '../../commands/registry'
import { useIpcError } from '../../hooks/useIpcError'
import { unwrapIpc } from '../../types/ipc'

// ── Types ──────────────────────────────────────────────────────────────────

interface ContextItem {
  type: 'file' | 'story' | 'help'
  label: string
  content: string
}

type PickerMode = 'none' | 'file' | 'story' | 'codebase'

interface ChatInputProps {
  input: string
  setInput: (v: string) => void
  context: ContextItem[]
  setContext: React.Dispatch<React.SetStateAction<ContextItem[]>>
  isStreaming: boolean
  handleSendMessage: () => void
  handleFileAttach: () => void
  triggerPicker: (mode: PickerMode) => void
  handlePickerSelect: (item: { label: string; value: string; payload: string }) => void
  slashSuggestions: Command[]
  showSuggestions: boolean
  setShowSuggestions: (v: boolean) => void
  setSlashSuggestions: (v: Command[]) => void
  pickerMode: PickerMode
  setPickerMode: (v: PickerMode) => void
  pickerResults: Array<{ label: string; value: string; payload: string }>
  setPickerResults: (v: Array<{ label: string; value: string; payload: string }>) => void
  rootPath: string
  commandRegistry: any
}

export const ChatInput: React.FC<ChatInputProps> = ({
  input,
  setInput,
  context,
  setContext,
  isStreaming,
  handleSendMessage,
  handleFileAttach,
  triggerPicker,
  handlePickerSelect,
  slashSuggestions,
  showSuggestions,
  setShowSuggestions,
  setSlashSuggestions,
  pickerMode,
  setPickerMode,
  pickerResults,
  setPickerResults,
  rootPath,
  commandRegistry,
}) => {
  const invoke = useIpcError()

  return (
    <>
      {context.length > 0 && (
        <div className="px-2 py-1 flex flex-wrap gap-1 bg-zinc-900/50 border-t border-hairline border-copernicus-steel">
          {context.map(c => (
            <ContextChip 
              key={c.label} 
              label={c.label} 
              onRemove={() => setContext(prev => prev.filter(i => i.label !== c.label))} 
            />
          ))}
        </div>
      )}

      <div className="p-2 bg-copernicus-bg border-t border-hairline border-copernicus-steel">
        <div className="relative flex flex-col bg-zinc-900 border border-copernicus-steel focus-within:border-copernicus-phosphor transition-all rounded p-1.5 shadow-sm">
          
          {/* Suggestion Popover */}
          {showSuggestions && slashSuggestions.length > 0 && (
            <div className="absolute bottom-full left-0 right-0 mb-1 bg-[#111] border border-copernicus-steel rounded shadow-2xl z-50 py-1 overflow-hidden">
              {slashSuggestions.map(cmd => (
                <button
                  key={cmd.name}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-copernicus-phosphor/10 transition-colors flex items-center gap-3"
                  onClick={() => {
                    setInput(cmd.name + ' ')
                    setShowSuggestions(false)
                  }}
                >
                  <span className="text-copernicus-phosphor font-mono">{cmd.name}</span>
                  <span className="text-[10px] text-zinc-500 uppercase tracking-tighter">{cmd.description}</span>
                </button>
              ))}
            </div>
          )}

          {/* Context Picker Popover */}
          {pickerMode !== 'none' && pickerResults.length > 0 && (
            <div className="absolute bottom-full left-0 right-0 mb-1 bg-[#111] border border-copernicus-steel rounded shadow-2xl z-50 max-h-48 overflow-y-auto">
              <div className="px-3 py-1 text-[9px] text-zinc-500 uppercase tracking-widest border-b border-copernicus-steel bg-black/40">
                {pickerMode === 'file' ? '@ File Context' : pickerMode === 'codebase' ? '⌖ Semantic Results' : '# Story Context'}
              </div>
              {pickerResults.map(item => (
                <button
                  key={item.value}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-copernicus-phosphor/10 transition-colors flex flex-col"
                  onClick={() => handlePickerSelect(item)}
                >
                  <span className="text-zinc-300 font-bold">{item.label}</span>
                  <span className="text-[9px] text-zinc-600 truncate">{item.value}</span>
                </button>
              ))}
            </div>
          )}

          <textarea
            value={input}
            aria-label="Chat with Claude"
            data-chat-input
            data-testid="chat-input"
            onChange={(e) => {
              const newValue = e.target.value
              setInput(newValue)
              
              if (newValue.startsWith('/') && !newValue.includes(' ')) {
                setSlashSuggestions(commandRegistry.suggest(newValue))
                setShowSuggestions(true)
              } else {
                setShowSuggestions(false)
              }

              // Context Picker logic
              const atIndex = newValue.lastIndexOf('@')
              const hashIndex = newValue.lastIndexOf('#')

              const codebaseMatch = newValue.slice(atIndex).match(/^@codebase\s+(.+)$/)
              if (atIndex !== -1 && codebaseMatch) {
                const query = codebaseMatch[1]
                setPickerMode('codebase')
                invoke<any>('lsp:request', { method: 'workspace/symbol', params: { query } })
                  .then((raw: any) => {
                    const data = unwrapIpc<any[]>(raw)
                    const symbols: any[] = Array.isArray(data) ? data : []
                    setPickerResults(symbols.slice(0, 20).map((s: any) => ({
                      label: s.name ?? '',
                      value: (s.location?.uri ?? '').replace('file://', ''),
                      payload: `${s.containerName ? s.containerName + '.' : ''}${s.name}`,
                    })))
                  })
                  .catch(() => setPickerResults([]))
              } else if (atIndex !== -1 && atIndex >= hashIndex && !newValue.slice(atIndex).includes(' ')) {
                const query = newValue.slice(atIndex + 1)
                setPickerMode('file')
                invoke<any>('fs:list-dir', rootPath ?? '').then((result: any) => {
                  const data = unwrapIpc<any[]>(result)
                  if (Array.isArray(data)) {
                    const filtered = data.filter((n: any) => !n.isDir && n.name.toLowerCase().includes(query.toLowerCase()))
                    setPickerResults(filtered.map((n: any) => ({ label: n.name, value: n.path, payload: n.path })))
                  }
                }).catch(() => {})
              } else if (hashIndex !== -1 && hashIndex > atIndex && !newValue.slice(hashIndex).includes(' ')) {
                const query = newValue.slice(hashIndex + 1)
                setPickerMode('story')
                invoke<any[]>('stories:list').then((result: any) => {
                  const data = unwrapIpc<any[]>(result)
                  if (Array.isArray(data)) {
                    const filtered = data.filter((s: any) => (s.id?.toLowerCase().includes(query.toLowerCase()) || s.title?.toLowerCase().includes(query.toLowerCase())))
                    setPickerResults(filtered.map((s: any) => ({ label: s.title ?? s.id, value: s.id, payload: s.content ?? '' })))
                  }
                }).catch(() => {})
              } else {
                setPickerMode('none')
              }
            }}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSendMessage())}
            placeholder={isStreaming ? "Streaming..." : "Strategic intent... (@file, #story)"}
            disabled={isStreaming}
            className="w-full bg-transparent border-none focus:ring-0 text-xs text-zinc-300 resize-none min-h-[40px] max-h-[200px] disabled:opacity-50 font-mono"
          />
          <div className="flex items-center justify-between mt-1 pt-1 border-t border-copernicus-steel/20">
            <div className="flex gap-2 text-zinc-500">
              <button onClick={handleFileAttach} aria-label="Attach File" className="hover:text-copernicus-phosphor transition-colors focus-visible:ring-2 focus-visible:ring-copernicus-phosphor focus-visible:outline-none" title="Attach File"><Paperclip size={12} /></button>
              <button onClick={() => triggerPicker('story')} aria-label="Attach Story" className="hover:text-copernicus-phosphor transition-colors focus-visible:ring-2 focus-visible:ring-copernicus-phosphor focus-visible:outline-none" title="Attach Story"><FileText size={12} /></button>
            </div>
            <button 
              onClick={handleSendMessage} 
              aria-label="Send message" 
              data-testid="chat-send-button"
              disabled={isStreaming} 
              className="p-1 hover:text-copernicus-phosphor text-zinc-600 transition-colors disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-copernicus-phosphor focus-visible:outline-none"
            >
              <Send size={14} />
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
