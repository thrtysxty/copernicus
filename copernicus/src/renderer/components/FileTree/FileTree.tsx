import React, { useEffect, useState } from 'react'
import { ChevronRight, ChevronDown, FileText, Folder, FolderOpen } from 'lucide-react'

const ipcRenderer = (window as any).ipcRenderer

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
  css: 'css', html: 'html', sh: 'shell',
  sql: 'sql', yaml: 'yaml', yml: 'yaml',
}

function getLanguage(filePath: string): string {
  const ext = filePath.split('.').pop() ?? ''
  return LANGUAGE_MAP[ext] ?? 'plaintext'
}

const FileTreeNode: React.FC<FileTreeNodeProps> = ({ node, depth, onFileOpen }) => {
  const [expanded, setExpanded] = useState(false)
  const [children, setChildren] = useState<FileNode[]>([])

  const handleClick = async () => {
    if (node.isDir) {
      if (!expanded) {
        const kids: FileNode[] = await ipcRenderer.invoke('fs:list-dir', node.path)
        setChildren(kids)
      }
      setExpanded(prev => !prev)
    } else {
      try {
        const content: string = await ipcRenderer.invoke('fs:open-file', node.path)
        const language = getLanguage(node.path)
        onFileOpen(node.path, content, language)
      } catch (err) {
        console.error('[FileTree] Failed to open file:', err)
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
            <FileText size={11} className="text-zinc-500 shrink-0" />
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
  const [rootChildren, setRootChildren] = useState<FileNode[]>([])

  useEffect(() => {
    if (!rootPath) return
    ipcRenderer.invoke('fs:list-dir', rootPath).then((nodes: FileNode[]) => {
      setRootChildren(nodes)
    }).catch(console.error)
  }, [rootPath])

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
