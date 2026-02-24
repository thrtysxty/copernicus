import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { TabBar } from './components/TabBar';
import { TerminalPane } from './components/TerminalPane';
import { ChatPanel } from './components/ChatPanel';
import { StatusBar } from './components/StatusBar';
import { TelemetryPopout } from './components/TelemetryPopout';
import { AlertBanner } from './components/AlertBanner';
import { CapExModal } from './components/CapExModal';
import { AuthSettings } from './components/settings/AuthSettings';
import { useAgentStore, AgentId } from './store/agents';
import { useWorkspaceStore } from './store/workspace';
import { useCapexStore } from './store/capex';
import Editor from '@monaco-editor/react';
import { Settings, Code, Zap } from 'lucide-react';

const App: React.FC = () => {
  const { activeAgent, setActiveAgent } = useAgentStore();
  const { setCwd, setGitBranch } = useWorkspaceStore();
  const { sessionActive, startSession, endSession } = useCapexStore();
  const [selectedFile, setSelectedFile] = useState<string>('README.md');
  const [fileContent, setFileContent] = useState<string>('// Select a file to view');
  const [showCapexModal, setShowCapexModal] = useState<any>(null);
  const [view, setView] = useState<'main' | 'telemetry' | 'settings'>('main');

  useEffect(() => {
    // Handle routing via hash
    const handleHash = () => {
      if (window.location.hash === '#telemetry') {
        setView('telemetry');
      } else if (window.location.hash === '#settings') {
        setView('settings');
      } else {
        setView('main');
      }
    };
    window.addEventListener('hashchange', handleHash);
    handleHash();

    // Populate dummy git info
    setCwd('/home/jules/atlas');
    setGitBranch('feature/atlas-scaffold');

    // Check session status on load
    window.electron.ipcRenderer.invoke('devtime:get-status').then(res => {
      if (res.active) {
        startSession();
      } else if (window.location.hash !== '#telemetry' && window.location.hash !== '#settings') {
        setShowCapexModal('start');
      }
    });
    
    return () => window.removeEventListener('hashchange', handleHash);
  }, [setCwd, setGitBranch, startSession]);

  const handleFileSelect = (path: string) => {
    setSelectedFile(path);
    window.electron.ipcRenderer.invoke('files:read', path).then(res => {
      if (res.success) {
        setFileContent(res.content);
      } else {
        setFileContent(`// Error reading file: ${res.error}`);
      }
    });
  };

  if (view === 'telemetry') {
    const [tasks, setTasks] = useState<any[]>([]);

    useEffect(() => {
      const cleanup = window.electron.ipcRenderer.on('telemetry:update', (task: any) => {
        setTasks(prev => [task, ...prev].slice(0, 20));
      });
      return cleanup;
    }, []);

    return (
      <div className="h-screen w-screen bg-gray-900 text-white overflow-y-auto p-4 custom-scrollbar">
        <h1 className="text-xl font-bold border-b border-gray-700 pb-2 mb-4 uppercase tracking-tighter text-blue-400 flex justify-between items-center">
          <span>Agent Telemetry</span>
          <span className="text-[10px] bg-blue-900 px-2 py-1 rounded text-blue-200 animate-pulse">Live</span>
        </h1>
        <div className="space-y-4">
          {tasks.length === 0 && (
            <div className="text-center py-10 text-gray-600 italic">
              Waiting for agent activity...
            </div>
          )}
          {tasks.map((task, i) => (
            <div key={task.id + i} className={`p-3 rounded border border-gray-700 bg-gray-800 shadow-md ${
              task.type === 'teleport' ? 'border-purple-500 bg-purple-900 bg-opacity-10' : ''
            }`}>
              <div className="flex justify-between items-center mb-1">
                <span className={`text-[10px] font-bold uppercase px-1 rounded ${
                  task.agentId === 'claude' ? 'bg-orange-900 text-orange-200' :
                  task.agentId === 'jules' ? 'bg-blue-900 text-blue-200' : 'bg-gray-700'
                }`}>
                  {task.agentId}
                </span>
                <span className="text-[9px] text-gray-500 font-mono">{new Date(task.ts).toLocaleTimeString()}</span>
              </div>
              <div className="flex items-center space-x-2">
                {task.type === 'teleport' ? (
                  <span className="text-purple-400 font-bold">✨ TELEPORT</span>
                ) : (
                  <span className="text-blue-400">●</span>
                )}
                <span className="text-sm font-medium">{task.label}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen w-screen bg-gray-900 text-white overflow-hidden relative font-sans">
      <AlertBanner />
      
      {showCapexModal && (
        <CapExModal 
          type={showCapexModal} 
          onClose={() => setShowCapexModal(null)}
          onSuccess={() => {
            if (showCapexModal === 'start') startSession();
            else endSession();
          }}
        />
      )}
      
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <Sidebar 
          onSelectFile={handleFileSelect} 
          selectedFile={selectedFile} 
          onShowCapex={() => setShowCapexModal(sessionActive ? 'end' : 'start')}
          onShowSettings={() => setView(view === 'settings' ? 'main' : 'settings')}
          activeView={view}
        />

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 border-r border-gray-700 relative">
          {view === 'settings' ? (
            <AuthSettings />
          ) : (
            <>
              {/* Editor Area (Top 70% or split) */}
              <div className="flex-1 bg-gray-900 relative">
                 <Editor
                   height="100%"
                   defaultLanguage="typescript"
                   theme="vs-dark"
                   path={selectedFile}
                   value={fileContent}
                   options={{
                     minimap: { enabled: false },
                     fontSize: 14,
                     scrollBeyondLastLine: false,
                     automaticLayout: true,
                   }}
                 />
              </div>

              {/* Terminal Area (Bottom 30% or tabs) */}
              <div className="h-64 border-t border-gray-700 flex flex-col bg-black">
                <TabBar 
                  tabs={['claude', 'gemini', 'jules']} 
                  activeTab={activeAgent} 
                  onTabChange={(tab) => setActiveAgent(tab as AgentId)} 
                />
                <div className="flex-1 relative overflow-hidden p-1">
                  <TerminalPane id="claude" active={activeAgent === 'claude'} />
                  <TerminalPane id="gemini" active={activeAgent === 'gemini'} />
                  <TerminalPane id="jules" active={activeAgent === 'jules'} />
                </div>
              </div>
            </>
          )}
        </div>

        {/* Right Panel (Chat) */}
        <div className="w-80 hidden lg:flex flex-col bg-gray-900">
          <ChatPanel />
        </div>
      </div>

      {/* Status Bar */}
      <StatusBar />
      
      {/* Popout */}
      <div onClick={() => window.electron.ipcRenderer.send('telemetry:open')}>
        <TelemetryPopout />
      </div>
    </div>
  );
};

export default App;
