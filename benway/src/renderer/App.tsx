
function App() {
  return (
    <div className="flex flex-col h-screen w-screen bg-benway-bg text-zinc-300 overflow-hidden">
      {/* Surgical Header */}
      <header className="h-[18px] w-full flex items-center justify-between px-2 bg-benway-bg/50 backdrop-blur-md border-b border-hairline border-benway-steel select-none draggable">
        <div className="text-[10px] font-bold text-benway-phosphor phosphor-glow tracking-widest uppercase">
          BENWAY // IDE
        </div>
        <div className="text-[9px] text-benway-steel">
          v0.1.0 :: SURGICAL_PHOSPHOR
        </div>
      </header>

      {/* Main Content Area - Zero Gap Tiling */}
      <div className="flex-1 flex flex-row overflow-hidden">
        {/* Sidebar Panel */}
        <div className="w-64 border-r border-hairline border-benway-steel flex flex-col">
           <div className="h-6 flex items-center px-2 bg-benway-bg border-b border-hairline border-benway-steel">
             <span className="text-[10px] uppercase text-zinc-500">Explorer</span>
           </div>
           <div className="flex-1 p-2 text-xs">
             <div className="text-benway-phosphor/80">src/</div>
             <div className="pl-4 text-zinc-500">renderer/</div>
             <div className="pl-8 text-zinc-400">App.tsx</div>
             <div className="pl-8 text-zinc-400">main.tsx</div>
           </div>
        </div>

        {/* Editor Panel */}
        <div className="flex-1 flex flex-col">
           <div className="h-6 flex items-center px-2 bg-benway-bg border-b border-hairline border-benway-steel">
             <span className="text-[10px] uppercase text-zinc-500">Editor - App.tsx</span>
           </div>
           <div className="flex-1 p-4 font-mono text-sm text-zinc-400 bg-[#080808]">
             <span className="text-purple-400">function</span> <span className="text-yellow-200">App</span>() {'{'}
             <br/>
             &nbsp;&nbsp;<span className="text-purple-400">return</span> (
             <br/>
             &nbsp;&nbsp;&nbsp;&nbsp;&lt;<span className="text-blue-400">div</span> <span className="text-green-400">className</span>=<span className="text-orange-300">"benway-interface"</span>&gt;
             <br/>
             &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;...
             <br/>
             &nbsp;&nbsp;&nbsp;&nbsp;&lt;/<span className="text-blue-400">div</span>&gt;
             <br/>
             &nbsp;&nbsp;)
             <br/>
             {'}'}
           </div>
        </div>

        {/* Terminal Panel (Right or Bottom - keeping simple for now) */}
        <div className="w-80 border-l border-hairline border-benway-steel flex flex-col">
           <div className="h-6 flex items-center px-2 bg-benway-bg border-b border-hairline border-benway-steel">
             <span className="text-[10px] uppercase text-zinc-500">Telemetry</span>
           </div>
           <div className="flex-1 p-2 font-mono text-[10px] text-zinc-500">
             <div>[10:42:01] <span className="text-benway-phosphor">INIT</span> System Ready</div>
             <div>[10:42:02] <span className="text-blue-400">INFO</span> Loading workspace...</div>
             <div>[10:42:05] <span className="text-benway-phosphor">OK</span> Modules loaded</div>
           </div>
        </div>
      </div>

      {/* Status Bar */}
      <footer className="h-5 w-full bg-benway-bg border-t border-hairline border-benway-steel flex items-center justify-between px-2 text-[10px] text-zinc-600">
         <div className="flex items-center gap-4">
           <span>main*</span>
           <span>0 errors</span>
         </div>
         <div className="flex items-center gap-2">
           <span className="text-benway-phosphor phosphor-glow">● ONLINE</span>
           <span>UTF-8</span>
           <span>TypeScript React</span>
         </div>
      </footer>
    </div>
  )
}

export default App
