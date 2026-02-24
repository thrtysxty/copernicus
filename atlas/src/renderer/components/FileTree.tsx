import React, { useState } from 'react';
import { FileNode } from '../../main/files/file-manager';
import { ChevronRight, ChevronDown, File, Folder } from 'lucide-react';

interface FileTreeProps {
  nodes: FileNode[];
  onSelectFile: (path: string) => void;
  selectedPath?: string;
  depth?: number;
}

export const FileTree: React.FC<FileTreeProps> = ({ nodes, onSelectFile, selectedPath, depth = 0 }) => {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const toggleExpand = (path: string) => {
    setExpanded(prev => ({ ...prev, [path]: !prev[path] }));
  };

  return (
    <div className="flex flex-col">
      {nodes.map((node) => (
        <div key={node.path} className="flex flex-col">
          <div 
            className={`flex items-center py-1 px-2 cursor-pointer hover:bg-gray-800 text-sm ${
              selectedPath === node.path ? 'bg-gray-800 text-blue-400' : 'text-gray-300'
            }`}
            style={{ paddingLeft: `${(depth * 12) + 8}px` }}
            onClick={() => {
              if (node.type === 'directory') {
                toggleExpand(node.path);
              } else {
                onSelectFile(node.path);
              }
            }}
          >
            <span className="mr-1">
              {node.type === 'directory' ? (
                expanded[node.path] ? <ChevronDown size={14} /> : <ChevronRight size={14} />
              ) : (
                <File size={14} className="opacity-50" />
              )}
            </span>
            <span className="truncate">{node.name}</span>
          </div>
          
          {node.type === 'directory' && expanded[node.path] && node.children && (
            <FileTree 
              nodes={node.children} 
              onSelectFile={onSelectFile} 
              selectedPath={selectedPath}
              depth={depth + 1}
            />
          )}
        </div>
      ))}
    </div>
  );
};
