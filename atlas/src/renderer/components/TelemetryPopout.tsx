import React, { useState } from 'react';

export const TelemetryPopout: React.FC = () => {
  const [minimized, setMinimized] = useState(false);

  if (minimized) {
      return (
          <div 
             className="absolute bottom-8 right-2 bg-gray-800 border border-gray-600 rounded-t px-2 py-1 text-xs cursor-pointer hover:bg-gray-700"
             onClick={() => setMinimized(false)}
          >
              Telemetry
          </div>
      );
  }

  return (
    <div className="absolute bottom-8 right-2 w-64 bg-gray-900 border border-gray-600 rounded shadow-lg text-xs text-gray-300 z-50">
      <div className="flex justify-between items-center bg-gray-800 p-1 px-2 border-b border-gray-600">
          <span className="font-bold">Telemetry</span>
          <button onClick={() => setMinimized(true)} className="hover:text-white">_</button>
      </div>
      <div className="p-2 space-y-1">
        <div className="flex justify-between"><span>CPU</span><span>12%</span></div>
        <div className="flex justify-between"><span>RAM</span><span>1.2GB</span></div>
        <div className="flex justify-between"><span>Tokens (Total)</span><span>1234</span></div>
        <div className="flex justify-between"><span>CapEx</span><span>$0.45</span></div>
      </div>
    </div>
  );
};
