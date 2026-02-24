import React, { useState, useEffect } from 'react';

interface CapExModalProps {
  type: 'start' | 'end';
  onClose: () => void;
  onSuccess: () => void;
}

export const CapExModal: React.FC<CapExModalProps> = ({ type, onClose, onSuccess }) => {
  const [entity, setEntity] = useState<'PIMS' | 'HPH'>('HPH');
  const [component, setComponent] = useState('core');
  const [phase, setPhase] = useState('APPLICATION_DEVELOPMENT');
  const [storyId, setStoryId] = useState('');
  const [description, setDescription] = useState('');
  const [commits, setCommits] = useState('');

  const handleStart = async () => {
    const res = await window.electron.ipcRenderer.invoke('devtime:start-session', {
      entity,
      component,
      phase,
      story_id: storyId
    });
    if (res.success) {
      onSuccess();
      onClose();
    }
  };

  const handleEnd = async () => {
    const res = await window.electron.ipcRenderer.invoke('devtime:end-session', {
      description,
      commits
    });
    if (res.success) {
      onSuccess();
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[100] p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-lg shadow-2xl w-full max-w-md overflow-hidden">
        <div className="p-4 border-b border-gray-700 bg-blue-900 bg-opacity-20 flex justify-between items-center">
          <h2 className="text-lg font-bold text-white">
            {type === 'start' ? '🚀 Start Dev Session' : '🏁 Close Dev Session'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl">×</button>
        </div>
        
        <div className="p-4 space-y-4">
          {type === 'start' ? (
            <>
              <div className="flex flex-col space-y-1">
                <label className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Entity</label>
                <div className="flex space-x-2">
                  {['PIMS', 'HPH'].map(e => (
                    <button
                      key={e}
                      onClick={() => setEntity(e as any)}
                      className={`flex-1 py-2 rounded text-sm font-bold border transition ${
                        entity === e ? 'bg-blue-600 border-blue-500 text-white' : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700'
                      }`}
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col space-y-1">
                <label className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Component</label>
                <input 
                  value={component}
                  onChange={e => setComponent(e.target.value)}
                  className="bg-gray-800 border border-gray-700 rounded p-2 text-sm text-white focus:outline-none focus:border-blue-500"
                  placeholder="e.g. eol_webhook"
                />
              </div>

              <div className="flex flex-col space-y-1">
                <label className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Story ID</label>
                <input 
                  value={storyId}
                  onChange={e => setStoryId(e.target.value)}
                  className="bg-gray-800 border border-gray-700 rounded p-2 text-sm text-white focus:outline-none focus:border-blue-500"
                  placeholder="e.g. story_117"
                />
              </div>
            </>
          ) : (
            <>
              <div className="flex flex-col space-y-1">
                <label className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Work Description</label>
                <textarea 
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  className="bg-gray-800 border border-gray-700 rounded p-2 text-sm text-white focus:outline-none focus:border-blue-500 min-h-[100px]"
                  placeholder="What did you implement today?"
                />
              </div>

              <div className="flex flex-col space-y-1">
                <label className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Recent Commits</label>
                <input 
                  value={commits}
                  onChange={e => setCommits(e.target.value)}
                  className="bg-gray-800 border border-gray-700 rounded p-2 text-sm text-white focus:outline-none focus:border-blue-500"
                  placeholder="a3f92bc, d819f01"
                />
              </div>
            </>
          )}
        </div>

        <div className="p-4 bg-gray-800 bg-opacity-50 flex space-x-3">
          <button 
            onClick={type === 'start' ? handleStart : handleEnd}
            className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 rounded shadow-lg transition"
          >
            {type === 'start' ? 'Start Session' : 'Save & Close'}
          </button>
          <button 
            onClick={onClose}
            className="px-4 bg-gray-700 hover:bg-gray-600 text-gray-300 py-2 rounded transition"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
