import React, { useEffect, useState } from 'react'
import { ChevronRight, ChevronDown, FileText, Folder, FolderOpen,
         Image, Database } from 'lucide-react'
import { useIpcError } from '../../hooks/useIpcError'

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
  onFileOpen: (path: string, content: string, language: string) => void
}

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

const FileTreeNode: React.FC<FileTreeNodeProps> = ({ node, depth, onFileOpen }) => {
  const invoke = useIpcError()
  const [expanded, setExpanded] = useState(false)
  const [children, setChildren] = useState<FileNode[]>([])

  const handleClick = async () => {
    if (node.isDir) {
      if (!expanded) {
        const result = await invoke<{ ok: boolean; data?: FileNode[]; error?: string }>('fs:list-dir', node.path)
        if (result.ok && result.data) setChildren(result.data)
      }
      setExpanded(prev => !prev)
      return
    }

    const classification = classifyFile(node.path)

    if (classification === 'binary') {
      onFileOpen(node.path, '', 'binary')
      return
    }

    try {
      const result = await invoke<{ ok: boolean; data?: string; error?: string }>('fs:open-file', node.path)
      if (!result.ok || result.data === undefined) return

      if (result.data.length > MAX_EDITOR_BYTES) {
        onFileOpen(node.path, result.data.slice(0, MAX_EDITOR_BYTES), 'plaintext')
        console.warn(`[FileTree] File truncated at ${MAX_EDITOR_BYTES} bytes: ${node.path}`)
        return
      }

      const language = getLanguage(node.path)
      onFileOpen(node.path, result.data, classification === 'svg' ? 'svg' : language)
    } catch (err) {
      console.error('[FileTree] Failed to open file:', err)
    }
  }

  const classification = classifyFile(node.path)

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
              ? <Image size={11} className="text-blue-400/70 shrink-0" />
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
          onFileOpen={onFileOpen}
        />
      ))}
    </div>
  )
}

interface FileTreeProps {
  rootPath: string
  onFileOpen: (path: string, content: string, language: string) => void
}

export const FileTree: React.FC<FileTreeProps> = ({ rootPath, onFileOpen }) => {
  const invoke = useIpcError()
  const [rootChildren, setRootChildren] = useState<FileNode[]>([])

  useEffect(() => {
    if (!rootPath) return
    invoke<{ ok: boolean; data: FileNode[] }>('fs:list-dir', rootPath).then((result) => {
      if (result.ok) {
        setRootChildren(result.data)
      }
    }).catch(console.error)
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
          onFileOpen={onFileOpen}
        />
      ))}
    </div>
  )
}
