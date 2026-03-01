import React from 'react';
import { useLayoutStore } from './store/useLayoutStore';
import { Panel } from './components/Layout/Panel';
import { MonacoEditor } from './components/Editor/MonacoEditor';
import { TerminalTabs } from './components/Terminal/TerminalTabs';
import { StatusBar } from './components/StatusBar/StatusBar';
import { LayoutDashboard, PenTool, Database } from 'lucide-react';

const App: React.FC = () => {
  const { activeStoryboard, setStoryboard } = useLayoutStore();

  return (
    <div className="h-screen w-screen bg-copernicus-bg text-gray-300 flex flex-col overflow-hidden select-none">
      {/* Top Bar / Storyboard Switcher */}
      <div className="h-10 bg-copernicus-bg border-b border-copernicus-steel flex items-center px-4 justify-between drag-region">
        <div className="flex space-x-4 no-drag">
          <button
            onClick={() => setStoryboard('Blueprint')}
            className={`flex items-center space-x-2 text-xs font-mono hover:text-copernicus-phosphor transition-colors ${activeStoryboard === 'Blueprint' ? 'text-copernicus-phosphor' : 'text-zinc-500'}`}
          >
            <LayoutDashboard size={14} />
            <span>BLUEPRINT</span>
          </button>
          <button
            onClick={() => setStoryboard('Studio')}
            className={`flex items-center space-x-2 text-xs font-mono hover:text-copernicus-phosphor transition-colors ${activeStoryboard === 'Studio' ? 'text-copernicus-phosphor' : 'text-zinc-500'}`}
          >
            <PenTool size={14} />
            <span>STUDIO</span>
          </button>
          <button
            onClick={() => setStoryboard('EngineRoom')}
            className={`flex items-center space-x-2 text-xs font-mono hover:text-copernicus-phosphor transition-colors ${activeStoryboard === 'EngineRoom' ? 'text-copernicus-phosphor' : 'text-zinc-500'}`}
          >
            <Database size={14} />
            <span>ENGINE ROOM</span>
          </button>
        </div>
        <div className="text-xs text-zinc-600 font-mono">COPERNICUS v0.1.0</div>
      </div>

      {/* Main Layout Area */}
      <div className="flex-grow flex overflow-hidden relative">
        {/* Left Sidebar - Flippable */}
        <Panel
          id="sidebar"
          title="Explorer"
          className="w-64 border-r border-copernicus-steel flex-shrink-0"
          back={
            <div className="h-full w-full bg-zinc-900 p-4 font-mono text-xs">
              <h3 className="text-copernicus-phosphor mb-2">COMMAND DECK</h3>
              <ul className="space-y-2">
                <li>▶ Run Build</li>
                <li>▶ Deploy Agent</li>
                <li>▶ Scan Security</li>
              </ul>
            </div>
          }
        >
          <div className="p-4 font-mono text-xs text-zinc-400">
            <div>📂 src</div>
            <div className="pl-4">📄 App.tsx</div>
            <div className="pl-4">📄 main.tsx</div>
            <div>📂 components</div>
          </div>
        </Panel>

        {/* Center Stage */}
        <div className="flex-grow flex flex-col min-w-0">
          <Panel id="editor" title="Editor" className="flex-grow border-b border-copernicus-steel h-2/3">
             <MonacoEditor />
          </Panel>
          <Panel id="terminals" title="Terminals" className="h-1/3 flex-shrink-0">
             <TerminalTabs />
          </Panel>
        </div>

        {/* Right Sidebar - Flippable */}
        <Panel
          id="chat"
          title="Agent Chat"
          className="w-80 border-l border-copernicus-steel flex-shrink-0"
          back={
            <div className="h-full w-full bg-zinc-900 p-4 font-mono text-xs">
              <h3 className="text-copernicus-phosphor mb-2">KANBAN BOARD</h3>
              <div className="space-y-4">
                <div className="bg-zinc-800 p-2 rounded border border-zinc-700">
                  <span className="bg-blue-900 text-blue-200 px-1 rounded text-[10px]">TODO</span>
                  <p className="mt-1">Implement Story #077</p>
                </div>
                <div className="bg-zinc-800 p-2 rounded border border-zinc-700">
                  <span className="bg-yellow-900 text-yellow-200 px-1 rounded text-[10px]">IN PROGRESS</span>
                  <p className="mt-1">Integrate Node-PTY</p>
                </div>
              </div>
            </div>
          }
        >
          <div className="p-4 font-mono text-xs space-y-4">
            <div className="flex space-x-2">
              <div className="w-6 h-6 rounded-full bg-copernicus-phosphor flex items-center justify-center text-black font-bold">J</div>
              <div className="bg-zinc-800 p-2 rounded text-zinc-300 max-w-[80%]">
                Ready to assist, Architect.
              </div>
            </div>
          </div>
        </Panel>
      </div>

      {/* Status Bar */}
      <StatusBar />
    </div>
  );
};

export default App;
