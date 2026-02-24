import React, { useState, useEffect } from 'react';

const ipcRenderer = (window as any).ipcRenderer;

interface ModelConfig {
  id: string;
  name: string;
  provider: string;
  contextWindow: number;
}

export const ChatPanel: React.FC = () => {
  const [models, setModels] = useState<ModelConfig[]>([]);
  const [activeModel, setActiveModel] = useState<ModelConfig | null>(null);

  const fetchModels = async () => {
    try {
      const m = await ipcRenderer.invoke('models:list');
      setModels(m);
      const active = await ipcRenderer.invoke('models:active');
      setActiveModel(active);
    } catch (e) {
      console.error('Failed to fetch models', e);
    }
  };

  useEffect(() => {
    fetchModels();
  }, []);

  const handleModelChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const modelId = e.target.value;
    try {
      await ipcRenderer.invoke('models:set-active', modelId);
      const active = models.find(m => m.id === modelId);
      setActiveModel(active || null);
    } catch (err) {
      console.error('Failed to set active model', err);
    }
  };

  return (
    <div className="flex flex-col h-full bg-benway-bg text-zinc-300">
      <div className="h-8 flex items-center justify-between px-2 bg-benway-bg border-b border-hairline border-benway-steel">
        <span className="text-[10px] uppercase text-zinc-500">Universal Chat Bus</span>
        <select
          value={activeModel?.id || ''}
          onChange={handleModelChange}
          className="bg-zinc-900 text-xs border border-zinc-700 rounded px-1 py-0.5 text-white focus:outline-none focus:border-benway-phosphor"
        >
          {models.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name} ({m.provider})
            </option>
          ))}
        </select>
      </div>
      <div className="flex-1 p-4 font-mono text-sm text-zinc-400 overflow-y-auto">
        <div className="text-center mt-20 text-zinc-600">
          <p>Active Model: <span className="text-benway-phosphor">{activeModel?.name}</span></p>
          <p className="text-xs mt-2">Provider: {activeModel?.provider}</p>
          <p className="mt-4 text-[10px]">[Chat Interface Placeholder]</p>
          <p className="text-[10px]">Context Window: {activeModel?.contextWindow || 'Unknown'}</p>
        </div>
      </div>
      <div className="h-10 border-t border-hairline border-benway-steel p-2">
        <input 
            type="text" 
            placeholder="Type a message..." 
            className="w-full bg-zinc-900 border border-zinc-700 text-xs px-2 py-1 text-white focus:outline-none focus:border-benway-phosphor"
            disabled
        />
      </div>
    </div>
  );
};
