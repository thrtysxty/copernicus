import React, { useState } from 'react';
import { ScheduleInput } from './ScheduleInput';

interface DispatchTask {
  id: string;
  name: string;
  scheduleNl: string;
  scheduleCron: string;
}

export const DispatchQueue: React.FC = () => {
  const [tasks, setTasks] = useState<DispatchTask[]>([
    { id: '1', name: 'Standard Sentinel Audit', scheduleNl: 'every weekday at 9am', scheduleCron: '0 9 * * 1-5' }
  ]);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newNl, setNewNl] = useState('');
  const [newCron, setNewCron] = useState('');

  const handleAdd = () => {
    if (!newName.trim() || !newCron) return;
    setTasks([...tasks, { id: Date.now().toString(), name: newName, scheduleNl: newNl, scheduleCron: newCron }]);
    setNewName('');
    setNewNl('');
    setNewCron('');
    setShowAdd(false);
  };

  return (
    <div className="flex flex-col h-full bg-[#050505] text-zinc-300 p-4 overflow-y-auto border-l border-copernicus-steel w-80">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xs font-mono font-bold uppercase tracking-[0.2em] text-copernicus-phosphor">Dispatch Queue</h2>
        <button 
          onClick={() => setShowAdd(!showAdd)}
          className="text-[10px] uppercase font-bold bg-zinc-800 hover:bg-zinc-700 px-2 py-1 rounded transition-colors"
        >
          {showAdd ? 'Cancel' : '+ Schedule'}
        </button>
      </div>

      {showAdd && (
        <div className="bg-zinc-900/50 border border-zinc-800 p-4 rounded mb-6 space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">Workflow Name</label>
            <input 
              type="text" 
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. nightly-build"
              className="w-full bg-zinc-900 border border-zinc-800 p-2 text-xs rounded outline-none focus:border-copernicus-phosphor/50 text-zinc-200"
            />
          </div>
          
          <ScheduleInput 
            value={newNl}
            onChange={(nl, cron) => {
              setNewNl(nl);
              setNewCron(cron);
            }}
          />

          <button 
            disabled={!newName.trim() || !newCron}
            onClick={handleAdd}
            className="w-full py-2 bg-copernicus-phosphor text-[#050505] text-[10px] font-bold uppercase tracking-wider rounded disabled:opacity-50 transition-all hover:scale-[1.02]"
          >
            Confirm Schedule
          </button>
        </div>
      )}

      <div className="space-y-3">
        {tasks.map(task => (
          <div key={task.id} className="bg-zinc-900/30 border border-zinc-800 p-3 rounded group hover:border-copernicus-phosphor/30 transition-colors">
            <div className="flex justify-between items-start mb-1">
              <span className="text-xs font-bold text-zinc-200 truncate">{task.name}</span>
              <button className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-red-400 text-[10px] transition-opacity">✕</button>
            </div>
            <div className="text-[10px] text-zinc-500 font-mono mb-1">{task.scheduleNl}</div>
            <div className="text-[9px] text-copernicus-phosphor font-mono bg-copernicus-phosphor/5 px-1.5 py-0.5 rounded inline-block">
              {task.scheduleCron}
            </div>
          </div>
        ))}
        {tasks.length === 0 && !showAdd && (
          <div className="text-center py-12 text-zinc-600 italic text-[10px]">
            No scheduled dispatches.
          </div>
        )}
      </div>
    </div>
  );
};
