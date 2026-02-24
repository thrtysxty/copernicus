import React, { useEffect, useState } from 'react';
import { useCapexStore as useCapex } from '../store/capex';
import { FileTree } from './FileTree';
import { FileNode } from '../../main/files/file-manager';
import { Settings, Folder, Zap, Clock } from 'lucide-react';

interface SidebarProps {
  onSelectFile: (path: string) => void;
  selectedFile: string;
  onShowCapex: () => void;
  onShowSettings: () => void;
  activeView: 'main' | 'telemetry' | 'settings';
}

export const Sidebar: React.FC<SidebarProps> = ({ onSelectFile, selectedFile, onShowCapex, onShowSettings, activeView }) => {
  const { sessionActive } = useCapex();
  const [nodes, setNodes] = useState<FileNode[]>([]);

  const refreshFiles = () => {
    const root = '/Users/dadmin/Projects/agentic-platform';
    window.electron.ipcRenderer.invoke('files:list', root).then(res => {
      setNodes(res || []);
    });
  };

  useEffect(() => {
    refreshFiles();
  }, []);

  return (
    <div className="w-64 bg-gray-900 border-r border-gray-700 h-full flex flex-col overflow-hidden">
      <div className="p-2 text-xs uppercase text-gray-500 font-bold tracking-wider flex justify-between items-center border-b border-gray-800">
        <div className="flex items-center space-x-2">
          <Folder size={12} />
          <span>Explorer</span>
        </div>
        <button 
          onClick={refreshFiles}
          className="hover:text-white transition-colors p-1"
          title="Refresh Explorer"
        >
          ↻
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <FileTree 
          nodes={nodes} 
          onSelectFile={onSelectFile} 
          selectedPath={selectedFile}
        />
      </div>
      
      <div className="p-2 border-t border-gray-800 space-y-1">
        <button 
          onClick={onShowCapex}
          className={`w-full py-2 px-3 rounded text-xs font-bold transition flex items-center space-x-2 ${
            sessionActive 
              ? 'bg-red-900 bg-opacity-30 text-red-400 border border-red-900 border-opacity-50 hover:bg-opacity-50' 
              : 'bg-gray-800 text-gray-400 border border-transparent hover:bg-gray-750'
          }`}
        >
          <Clock size={14} className={sessionActive ? 'animate-pulse' : ''} />
          <span>{sessionActive ? 'Session Active' : 'Start CapEx Log'}</span>
        </button>

        <button 
          onClick={onShowSettings}
          className={`w-full py-2 px-3 rounded text-xs font-bold transition flex items-center space-x-2 ${
            activeView === 'settings' 
              ? 'bg-blue-900 bg-opacity-30 text-blue-400 border border-blue-900 border-opacity-50' 
              : 'bg-transparent text-gray-500 hover:bg-gray-800 border border-transparent'
          }`}
        >
          <Settings size={14} />
          <span>Settings</span>
        </button>
      </div>
    </div>
  );
};
