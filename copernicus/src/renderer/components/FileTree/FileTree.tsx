import React, { useEffect, useState } from 'react'
import { ChevronRight, ChevronDown, FileText, Folder, FolderOpen,
         Image as ImageIcon, Database } from 'lucide-react'
import { useIpcError } from '../../hooks/useIpcError'
import { useLayoutStore } from '../../store/layout'
import log from '../../utils/logger'

const IMAGE_EXTENSIONS = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'ico', 'tiff', 'avif',
])

const BINARY_EXTENSIONS = new Set([
  'db', 'db-shm', 'db-wal', 'sqlite', 'sqlite3',
  'dmg', 'pkg', 'exe', 'dll', 'so', 'dylib',
  'wasm', 'zip', 'tar', 'gz', 'bz2', 'xz', '7z', 'rar',
  'pdf', 'bin', 'a', 'o', 'class', 'pyc',
  'mp4', 'mp3', 'wav', 'mov', 'avi', 'mkv',
])

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

function classifyFile(filePath: string): 'code' | 'image' | 'binary' | 'svg' {
  const ext = filePath.split('.').pop()?.toLowerCase() ?? ''
  if (ext === 'svg') return 'svg'
  if (IMAGE_EXTENSIONS.has(ext)) return 'image'
  if (BINARY_EXTENSIONS.has(ext)) return 'binary'
  return 'code'
}

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
        const result = await invoke<{ ok: boolean; data?: FileNode[]; error?: string }>('fs:list-dir', node.path)
        const data = (result as any).data || result
        if (Array.isArray(data)) setChildren(data)
      }
      setExpanded(prev => !prev)
      return
    }
    setActiveFilePath(node.path)

    if (classification === 'image' || classification === 'svg') {
      setCenterMode('image')
      setActiveFileContent('')
      setActiveFileLanguage(classification === 'svg' ? 'xml' : 'image')
    } else if (classification === 'binary') {
      setCenterMode('binary')
      setActiveFileContent('')
      setActiveFileLanguage('binary')
    } else {
      setCenterMode('code')
      try {
        const content = await invoke<string>('fs:read-file', node.path)
        const finalContent = typeof content === 'string' ? content : ''
        
        if (finalContent.length > MAX_EDITOR_BYTES) {
          setActiveFileContent(finalContent.slice(0, MAX_EDITOR_BYTES))
          log.warn(`[FileTree] File truncated at ${MAX_EDITOR_BYTES} bytes: ${node.path}`)
        } else {
          setActiveFileContent(finalContent)
        }
        
        setActiveFileLanguage(getLanguage(node.path))
      } catch (err) {
        log.error('[FileTree] Failed to read file content:', err)
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
          <>
            {expanded
              ? <ChevronDown size={10} className="text-zinc-500 shrink-0" />
              : <ChevronRight size={10} className="text-zinc-500 shrink-0" />
            }
            {expanded
              ? <FolderOpen size={11} className="text-copernicus-phosphor/70 shrink-0" />
              : <Folder size={11} className="text-copernicus-phosphor/70 shrink-0" />
            }
          </>
        ) : (
          <>
            <span className="w-[10px] shrink-0" />
            {classification === 'image' || classification === 'svg'
              ? <ImageIcon size={11} className="text-blue-400/70 shrink-0" />
              : classification === 'binary'
              ? <Database size={11} className="text-red-400/50 shrink-0" />
              : <FileText size={11} className="text-zinc-500 shrink-0" />
            }
          </>
        )}
        <span className="text-zinc-400 truncate">{node.name}</span>
      </div>
      {node.isDir && expanded && children.map(child => (
        <FileTreeNode
          key={child.path}
          node={child}
          depth={depth + 1}
        />
      ))}
    </div>
  )
}

interface FileTreeProps {
  rootPath: string
}

export const FileTree: React.FC<FileTreeProps> = ({ rootPath }) => {
  const invoke = useIpcError()
  const [rootChildren, setRootChildren] = useState<FileNode[]>([])

  useEffect(() => {
    if (!rootPath) return
    invoke<FileNode[]>('fs:list-dir', rootPath).then((result) => {
      const data = (result as any).data || result
      if (Array.isArray(data)) {
        setRootChildren(data)
      }
    }).catch(log.error)
  }, [rootPath, invoke])

  if (!rootPath) {
    return <div className="text-zinc-600 text-xs p-2 italic">Loading...</div>
  }

  return (
    <div className="flex-1 overflow-y-auto py-1 scrollbar-thin scrollbar-thumb-copernicus-steel">
      {rootChildren.map(node => (
        <FileTreeNode
          key={node.path}
          node={node}
          depth={0}
        />
      ))}
    </div>
  )
}
