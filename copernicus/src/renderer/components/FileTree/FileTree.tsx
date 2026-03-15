import React, { useEffect, useState, useRef } from 'react'
import { ChevronRight, ChevronDown, FileText, Folder, FolderOpen,
         Image as ImageIcon, Database, Maximize2, Minimize2, RotateCcw, ChevronLeft } from 'lucide-react'
import { useIpcError } from '../../hooks/useIpcError'
import { useLayoutStore } from '../../store/layout'
import { classifyFile } from '../../utils/fileUtils'
import { unwrapIpc } from '../../types/ipc'
import { FileTreeContextMenu, ContextMenuProps } from './FileTreeContextMenu'

const LANGUAGE_MAP: Record<string, string> = {
  ts: 'typescript', tsx: 'typescript',
  js: 'javascript', jsx: 'javascript',
  py: 'python', md: 'markdown', json: 'json',
  css: 'css', scss: 'css', less: 'css',
  html: 'html', htm: 'html',
  sh: 'shell', bash: 'shell', zsh: 'shell',
  sql: 'sql', yaml: 'yaml', yml: 'yaml',
  toml: 'plaintext', env: 'plaintext',
  graphql: 'graphql', gql: 'graphql',
  rs: 'rust', go: 'go', java: 'java',
  c: 'c', cpp: 'cpp', h: 'cpp',
  rb: 'ruby', php: 'php', swift: 'swift',
  kt: 'kotlin', dart: 'dart', lua: 'lua',
  xml: 'xml', svg: 'xml',
  dockerfile: 'dockerfile', makefile: 'makefile',
  lock: 'plaintext', patch: 'plaintext', diff: 'plaintext',
  log: 'plaintext', txt: 'plaintext', csv: 'plaintext',
}

function getLanguage(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() ?? ''
  return LANGUAGE_MAP[ext] ?? 'plaintext'
}

const MAX_EDITOR_BYTES = 512_000 // 500 KB

interface FileNode {
  name: string
  path: string
  isDir: boolean
}

interface FileTreeNodeProps {
  node: FileNode
  depth: number
  onContextMenu: (e: React.MouseEvent, node: FileNode) => void
  onRefreshNeeded: () => void
}

const FileTreeNode: React.FC<FileTreeNodeProps> = ({ node, depth, onContextMenu, onRefreshNeeded }) => {
  const invoke = useIpcError()
  const { setCenterMode, openFile, setActiveFileContent, setActiveFileLanguage } = useLayoutStore()
  const [expanded, setExpanded] = useState(false)
  const [children, setChildren] = useState<FileNode[]>([])
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(node.name)
  const inputRef = useRef<HTMLInputElement>(null)
  
  const classification = node.isDir ? 'code' : classifyFile(node.path)

  const loadChildren = async () => {
    const result = await invoke<any>('fs:list-dir', node.path)
    const data = unwrapIpc<FileNode[]>(result)
    if (Array.isArray(data)) setChildren(data)
  }

  useEffect(() => {
    if (expanded && node.isDir) {
      loadChildren()
    }
  }, [expanded, node.path])

  // Expose a way to re-fetch children if modified
  useEffect(() => {
    // We attach an event listener to the window so the parent can force refresh
    const handleRefresh = (e: any) => {
      if (e.detail?.path === node.path) {
        if (expanded) loadChildren()
      }
    }
    window.addEventListener('filetree-refresh', handleRefresh)
    return () => window.removeEventListener('filetree-refresh', handleRefresh)
  }, [expanded, node.path])

  const handleClick = async () => {
    if (isEditing) return;
    
    if (node.isDir) {
      setExpanded(prev => !prev)
      return
    }
    openFile(node.path)

    if (classification === 'canvas' || classification === 'svg') {
      const { setView } = useLayoutStore.getState()
      setView('designer')
      setCenterMode('canvas')
      setActiveFileContent('')
      setActiveFileLanguage(classification === 'svg' ? 'xml' : 'image')
    } else if (classification === 'binary') {
      setCenterMode('binary')
      setActiveFileContent('')
      setActiveFileLanguage('binary')
    } else {
      setCenterMode('code')
      try {
        const result = await invoke<any>('fs:read-file', node.path)
        const finalContent = unwrapIpc<string>(result) || ''

        if (finalContent.length > MAX_EDITOR_BYTES) {
          setActiveFileContent(finalContent.slice(0, MAX_EDITOR_BYTES))
          console.warn(`[FileTree] File truncated at ${MAX_EDITOR_BYTES} bytes: ${node.path}`)
        } else {
          setActiveFileContent(finalContent)
        }
        setActiveFileLanguage(getLanguage(node.path))
      } catch (err) {
        console.error('[FileTree] Failed to read file content:', err)
      }
    }
  }

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onContextMenu(e, node)
  }

  // Support for node internal editing (rename)
  useEffect(() => {
    const handleEditStart = (e: any) => {
      if (e.detail?.path === node.path && e.detail?.action === 'rename') {
        setIsEditing(true)
        setEditValue(node.name)
        setTimeout(() => inputRef.current?.focus(), 50)
      }
    }
    window.addEventListener('filetree-edit', handleEditStart)
    return () => window.removeEventListener('filetree-edit', handleEditStart)
  }, [node.path, node.name])

  const submitRename = async () => {
    if (!editValue || editValue === node.name) {
      setIsEditing(false)
      return
    }
    try {
      const newPath = node.path.substring(0, node.path.lastIndexOf('/') + 1) + editValue
      await invoke('fs:rename', { oldPath: node.path, newPath })
      setIsEditing(false)
      onRefreshNeeded()
      
      // If we just renamed an open file, we should update the openFilePath
      const layoutState = useLayoutStore.getState();
      if (layoutState.activeFilePath === node.path) {
         layoutState.openFile(newPath)
      }
    } catch (err) {
      console.error('Rename failed', err)
      setIsEditing(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') submitRename()
    if (e.key === 'Escape') setIsEditing(false)
  }

  return (
    <div>
      <div
        className="flex items-center gap-1 px-1 py-[2px] cursor-pointer hover:bg-copernicus-phosphor/10 rounded text-[11px] select-none"
        style={{ paddingLeft: `${4 + depth * 12}px` }}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
      >
        {node.isDir ? (
          expanded ? <ChevronDown size={14} className="text-zinc-500" /> : <ChevronRight size={14} className="text-zinc-500" />
        ) : (
          <div className="w-[14px]" />
        )}
        {node.isDir ? (
          expanded ? <FolderOpen size={14} className="text-copernicus-phosphor" /> : <Folder size={14} className="text-zinc-400" />
        ) : (
          classification === 'canvas' || classification === 'svg' ? <ImageIcon size={12} className="text-blue-400" /> :
          classification === 'binary' ? <Database size={12} className="text-amber-400" /> :
          <FileText size={12} className="text-zinc-500" />
        )}
        
        {isEditing ? (
          <input
            ref={inputRef}
            type="text"
            value={editValue}
            onChange={e => setEditValue(e.target.value)}
            onBlur={submitRename}
            onKeyDown={handleKeyDown}
            className="bg-black text-white px-1 outline-none border border-copernicus-phosphor text-[11px] h-[18px] w-full ml-1"
            onClick={e => e.stopPropagation()}
          />
        ) : (
          <span className={`${node.isDir ? 'font-semibold text-zinc-300' : 'text-zinc-400'} truncate`}>
            {node.name}
          </span>
        )}
      </div>
      {node.isDir && expanded && (
        <div className="ml-1">
          {children.map(child => (
            <FileTreeNode
              key={child.path}
              node={child}
              depth={depth + 1}
              onContextMenu={onContextMenu}
              onRefreshNeeded={() => window.dispatchEvent(new CustomEvent('filetree-refresh', { detail: { path: node.path } }))}
            />
          ))}
        </div>
      )}
    </div>
  )
}

interface FileTreeProps {
  rootPath: string
}

export const FileTree: React.FC<FileTreeProps> = ({ rootPath }) => {
  const invoke = useIpcError()
  const { spotlightPane, setSpotlight, toggleFlip, setSidebarOpen, openFile, setCenterMode, setActiveFileContent, setActiveFileLanguage } = useLayoutStore()
  const [rootChildren, setRootChildren] = useState<FileNode[]>([])
  const [lspRunning, setLspRunning] = useState(false)
  const [contextMenu, setContextMenu] = useState<ContextMenuProps | null>(null)
  
  const [creatingItem, setCreatingItem] = useState<{type: 'file' | 'folder', path: string} | null>(null)
  const [newItemName, setNewItemName] = useState('')
  const newItemInputRef = useRef<HTMLInputElement>(null)

  const loadRoot = async () => {
    if (!rootPath) return
    try {
      const result = await invoke<any>('fs:list-dir', rootPath)
      const data = unwrapIpc<FileNode[]>(result)
      if (Array.isArray(data)) {
        setRootChildren(data)
      }
    } catch (err) {
      console.error(err)
    }
  }

  useEffect(() => {
    loadRoot()

    invoke<any>('lsp:status').then((res: any) => {
      const data = unwrapIpc<any>(res)
      if (data) setLspRunning(data.running ?? false)
    }).catch(() => {})
  }, [rootPath, invoke])

  useEffect(() => {
    if (creatingItem) {
      setTimeout(() => newItemInputRef.current?.focus(), 50)
    }
  }, [creatingItem])

  const handleContextMenu = (e: React.MouseEvent, node?: FileNode) => {
    e.preventDefault()
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      nodeType: node ? (node.isDir ? 'folder' : 'file') : 'background',
      onClose: () => setContextMenu(null),
      onAction: async (action) => {
        const targetPath = node ? node.path : rootPath
        
        if (action === 'new-file') {
          setCreatingItem({ type: 'file', path: targetPath })
          setNewItemName('')
        } else if (action === 'new-folder') {
          setCreatingItem({ type: 'folder', path: targetPath })
          setNewItemName('')
        } else if (action === 'rename' && node) {
          window.dispatchEvent(new CustomEvent('filetree-edit', { detail: { path: node.path, action: 'rename' } }))
        } else if (action === 'delete' && node) {
          if (confirm(`Are you sure you want to delete ${node.name}?`)) {
            await invoke('fs:trash', node.path)
            // Trigger refresh
            if (node.path.lastIndexOf('/') > rootPath.length) {
              const parentPath = node.path.substring(0, node.path.lastIndexOf('/'))
              window.dispatchEvent(new CustomEvent('filetree-refresh', { detail: { path: parentPath } }))
            } else {
              loadRoot()
            }
          }
        } else if (action === 'copy-path' && node) {
          navigator.clipboard.writeText(node.path)
        } else if (action === 'reveal' && node) {
          await invoke('fs:reveal', node.path)
        } else if (action === 'open' && node && !node.isDir) {
           openFile(node.path)
           setCenterMode('code')
           try {
             const result = await invoke<any>('fs:read-file', node.path)
             const finalContent = unwrapIpc<string>(result) || ''
             setActiveFileContent(finalContent)
             setActiveFileLanguage(getLanguage(node.path))
           } catch (e) {}
        }
      }
    })
  }

  const submitNewItem = async () => {
    if (!creatingItem || !newItemName) {
      setCreatingItem(null)
      return
    }
    
    // Determine the base path. If target was a file, put it in the same dir.
    // If target was a folder or background, put it inside.
    let basePath = creatingItem.path
    
    // Try to stat if it's a file or dir
    // This is simple in our current logic: the 'targetPath' from the action 
    // is a folder if we used the background context menu, or the folder's context menu.
    // But let's safely append
    const newPath = basePath + '/' + newItemName
    
    try {
      if (creatingItem.type === 'file') {
        await invoke('fs:create-file', newPath)
        
        // Open the new file
        openFile(newPath)
        setCenterMode('code')
        setActiveFileContent('')
        setActiveFileLanguage(getLanguage(newPath))
      } else {
        await invoke('fs:create-dir', newPath)
      }
      
      setCreatingItem(null)
      // Trigger refresh
      if (basePath === rootPath) {
        loadRoot()
      } else {
        window.dispatchEvent(new CustomEvent('filetree-refresh', { detail: { path: basePath } }))
        // Also refresh root just in case
        loadRoot() 
      }
    } catch (err) {
      console.error('Failed to create item', err)
      setCreatingItem(null)
    }
  }

  const handleNewItemKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') submitNewItem()
    if (e.key === 'Escape') setCreatingItem(null)
  }

  if (!rootPath) {
    return <div className="text-zinc-600 text-xs p-2 italic">Loading...</div>
  }

  return (
    <div 
      className="flex flex-col h-full bg-copernicus-bg min-w-0 overflow-hidden relative"
      onContextMenu={(e) => handleContextMenu(e)}
    >
      <div className="h-8 flex items-center justify-between px-3 border-b border-white/5 bg-black/20 shrink-0 group/tree">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Explorer</span>
          <div 
            className={`w-1.5 h-1.5 rounded-full ${lspRunning ? 'bg-green-500 shadow-[0_0_4px_rgba(34,197,94,0.6)]' : 'bg-red-500'} transition-all duration-500`}
            title={lspRunning ? "LSP Online" : "LSP Offline"}
          />
        </div>
        
        <div className="flex items-center gap-1 opacity-60 group-hover/tree:opacity-100 transition-all">
          <button
            onClick={() => setSpotlight(spotlightPane === 'explorer' ? null : 'explorer')}
            className={`p-1 rounded hover:bg-white/5 ${spotlightPane === 'explorer' ? 'text-copernicus-phosphor' : 'text-zinc-600 hover:text-zinc-300'}`}
            title={spotlightPane === 'explorer' ? "Shrink Explorer" : "Spotlight Explorer"}
          >
            {spotlightPane === 'explorer' ? <Minimize2 size={10} /> : <Maximize2 size={10} />}
          </button>
          <button
            onClick={() => toggleFlip('sidebar')}
            className="p-1 text-zinc-600 hover:text-copernicus-phosphor transition-colors"
            title="Rotate Explorer Content"
          >
            <RotateCcw size={10} />
          </button>
          <button
            onClick={() => setSidebarOpen(false)}
            className="p-1 text-zinc-600 hover:text-red-400 transition-colors"
            title="Collapse Sidebar"
          >
            <ChevronLeft size={14} />
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto py-1 scrollbar-thin scrollbar-thumb-copernicus-steel">
        {creatingItem && creatingItem.path === rootPath && (
          <div className="flex items-center gap-1 px-1 py-[2px] ml-[4px]">
            {creatingItem.type === 'file' ? <FileText size={12} className="text-zinc-500" /> : <Folder size={14} className="text-zinc-400" />}
            <input
              ref={newItemInputRef}
              type="text"
              value={newItemName}
              onChange={e => setNewItemName(e.target.value)}
              onBlur={submitNewItem}
              onKeyDown={handleNewItemKeyDown}
              className="bg-black text-white px-1 outline-none border border-copernicus-phosphor text-[11px] h-[18px] w-full"
            />
          </div>
        )}
        
        {rootChildren.map(node => (
          <FileTreeNode
            key={node.path}
            node={node}
            depth={0}
            onContextMenu={handleContextMenu}
            onRefreshNeeded={loadRoot}
          />
        ))}
      </div>
      
      {contextMenu && (
        <FileTreeContextMenu {...contextMenu} />
      )}
    </div>
  )
}
