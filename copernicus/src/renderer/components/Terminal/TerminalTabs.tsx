import React, { useState } from 'react';
import { Terminal } from './Terminal';

const TABS = [
  { id: 'terminal-claude', label: 'Claude' },
  { id: 'terminal-gemini', label: 'Gemini' },
  { id: 'terminal-jules', label: 'Jules' },
];

export const TerminalTabs: React.FC = () => {
  const [activeTab, setActiveTab] = useState(TABS[0].id);

  return (
    <div className="flex flex-col h-full bg-copernicus-bg">
      <div className="flex border-b border-copernicus-steel h-6">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`
              px-4 text-[10px] font-mono border-r border-copernicus-steel hover:bg-copernicus-steel/20 transition-colors uppercase
              ${activeTab === tab.id ? 'text-copernicus-phosphor bg-copernicus-steel/10' : 'text-zinc-500'}
            `}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="flex-grow relative overflow-hidden">
        {TABS.map((tab) => (
          <div
            key={tab.id}
            className={`absolute inset-0 ${activeTab === tab.id ? 'z-10 visible' : 'z-0 invisible'}`}
          >
            <Terminal id={tab.id} active={activeTab === tab.id} />
          </div>
        ))}
      </div>
    </div>
  );
};
