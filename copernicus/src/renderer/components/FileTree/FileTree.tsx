import React, { useEffect, useState } from 'react'
import { ChevronRight, ChevronDown, FileText, Folder, FolderOpen,
         Image as ImageIcon, Database, Maximize2, Minimize2, RotateCcw } from 'lucide-react'
import { useIpcError } from '../../hooks/useIpcError'
import { useLayoutStore } from '../../store/layout'
import { classifyFile } from '../../utils/fileUtils'
import { unwrapIpc } from '../../types/ipc'

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
}

const FileTreeNode: React.FC<FileTreeNodeProps> = ({ node, depth }) => {
  const invoke = useIpcError()
  const { setCenterMode, setActiveFilePath, setActiveFileContent, setActiveFileLanguage } = useLayoutStore()
  const [expanded, setExpanded] = useState(false)
  const [children, setChildren] = useState<FileNode[]>([])
  const classification = node.isDir ? 'code' : classifyFile(node.path)

  const handleClick = async () => {
    if (node.isDir) {
      if (!expanded) {
        const result = await invoke<any>('fs:list-dir', node.path)
        const data = unwrapIpc<FileNode[]>(result)
        if (Array.isArray(data)) setChildren(data)
      }
      setExpanded(prev => !prev)
      return
    }
    setActiveFilePath(node.path)

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

  return (
    <div>
      <div
        className="flex items-center gap-1 px-1 py-[2px] cursor-pointer hover:bg-copernicus-phosphor/10 rounded text-[11px] select-none"
        style={{ paddingLeft: `${4 + depth * 12}px` }}
        onClick={handleClick}
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
        <span className={`${node.isDir ? 'font-semibold text-zinc-300' : 'text-zinc-400'} truncate`}>
          {node.name}
        </span>
      </div>
      {node.isDir && expanded && (
        <div className="ml-1">
          {children.map(child => (
            <FileTreeNode
              key={child.path}
              node={child}
              depth={depth + 1}
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
  const { spotlightPane, setSpotlight, toggleFlip } = useLayoutStore()
  const [rootChildren, setRootChildren] = useState<FileNode[]>([])

  useEffect(() => {
    if (!rootPath) return
    invoke<FileNode[]>('fs:list-dir', rootPath).then((result) => {
      const data = (result as any).data || result
      if (Array.isArray(data)) {
        setRootChildren(data)
      }
    }).catch(console.error)
  }, [rootPath, invoke])

  if (!rootPath) {
    return <div className="text-zinc-600 text-xs p-2 italic">Loading...</div>
  }

  return (
    <div className="flex flex-col h-full bg-copernicus-bg">
      <div className="h-8 flex items-center justify-between px-3 border-b border-white/5 bg-black/20 shrink-0 group/tree">
        <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Explorer</span>
        
        <div className="flex items-center gap-1 opacity-0 group-hover/tree:opacity-100 transition-all">
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
        </div>
      </div>
      <div className="flex-1 overflow-y-auto py-1 scrollbar-thin scrollbar-thumb-copernicus-steel">
        {rootChildren.map(node => (
          <FileTreeNode
            key={node.path}
            node={node}
            depth={0}
          />
        ))}
      </div>
    </div>
  )
}
