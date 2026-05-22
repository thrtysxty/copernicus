import React, { useState } from 'react'
import { Globe, Database } from 'lucide-react'

type SubTab = 'browser' | 'database'

export const ToolsSection: React.FC = () => {
  const [subTab, setSubTab] = useState<SubTab>('browser')

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-zinc-100">Tools</h2>
        <p className="text-xs text-zinc-500 mt-1">Browser automation and database query tools</p>
      </div>

      <div className="flex gap-2 border-b border-zinc-800 pb-1">
        <SubTabButton id="browser" label="Browser" icon={<Globe size={12} />} active={subTab} onClick={setSubTab} />
        <SubTabButton id="database" label="Database" icon={<Database size={12} />} active={subTab} onClick={setSubTab} />
      </div>

      {subTab === 'browser' ? <BrowserInfo /> : <DatabaseInfo />}
    </div>
  )
}

const SubTabButton: React.FC<{ id: SubTab, label: string, icon: any, active: SubTab, onClick: (id: SubTab) => void }> = ({ id, label, icon, active, onClick }) => {
  const isActive = active === id
  return (
    <button
      onClick={() => onClick(id)}
      className={`flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest transition-colors ${isActive ? 'text-copernicus-phosphor bg-copernicus-phosphor/10' : 'text-zinc-500 hover:text-zinc-300'}`}
    >
      {icon} {label}
    </button>
  )
}

const BrowserInfo: React.FC = () => (
  <div className="space-y-4">
    <div className="bg-zinc-900/50 border border-zinc-800 rounded p-4">
      <h3 className="text-xs font-bold text-zinc-200 mb-2">Browser Automation</h3>
      <p className="text-[10px] text-zinc-500 leading-relaxed">
        The browser panel provides a web view for navigating URLs, taking accessibility snapshots, and capturing screenshots. 
        It connects to the built-in browser automation engine for agent-driven testing workflows.
      </p>
      <div className="mt-3 text-[9px] text-zinc-600 font-mono">
        IPC: browser:navigate, browser:snapshot, browser:screenshot
      </div>
    </div>
    <div className="text-[10px] text-zinc-500">
      Open the Browser panel from the command palette (⌘⇧P → "Browser") or use it in agent workflows.
    </div>
  </div>
)

const DatabaseInfo: React.FC = () => (
  <div className="space-y-4">
    <div className="bg-zinc-900/50 border border-zinc-800 rounded p-4">
      <h3 className="text-xs font-bold text-zinc-200 mb-2">Database Query</h3>
      <p className="text-[10px] text-zinc-500 leading-relaxed">
        The database panel provides a SQL query interface for running ad-hoc queries against the project database.
        Supports SELECT queries and table listing. Results are displayed in a data table.
      </p>
      <div className="mt-3 text-[9px] text-zinc-600 font-mono">
        IPC: db:query, db:list-tables
      </div>
    </div>
    <div className="text-[10px] text-zinc-500">
      Open the Database panel from the command palette (⌘⇧P → "Database") or use it in agent workflows.
    </div>
  </div>
)
