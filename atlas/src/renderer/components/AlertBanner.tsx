import React, { useState, useEffect } from 'react';

export interface Alert {
  ts: string;
  agent: string;
  patternId: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM';
  label: string;
  detail: string;
  context: string;
}

export const AlertBanner: React.FC = () => {
  const [alerts, setAlerts] = useState<Alert[]>([]);

  useEffect(() => {
    const cleanup = window.electron.ipcRenderer.on('security:alert', (message: any) => {
      // message is { id, alerts }
      setAlerts((prev) => [...message.alerts, ...prev].slice(0, 5));
    });

    return cleanup;
  }, []);

  if (alerts.length === 0) return null;

  return (
    <div className="absolute top-0 left-0 right-0 z-50 flex flex-col pointer-events-none">
      {alerts.map((alert, i) => (
        <div 
          key={alert.ts + i}
          className={`p-2 m-1 rounded shadow-lg flex justify-between items-center pointer-events-auto border-l-4 ${
            alert.severity === 'CRITICAL' ? 'bg-red-900 border-red-500 text-red-100' :
            alert.severity === 'HIGH' ? 'bg-orange-900 border-orange-500 text-orange-100' :
            'bg-yellow-900 border-yellow-500 text-yellow-100'
          }`}
        >
          <div className="flex-1">
            <div className="flex items-center space-x-2">
              <span className="font-bold uppercase text-xs">[{alert.severity}]</span>
              <span className="font-bold">{alert.label}</span>
            </div>
            <p className="text-xs opacity-90">{alert.detail}</p>
            <code className="text-[10px] block mt-1 bg-black bg-opacity-30 p-1 rounded truncate">
              {alert.context}
            </code>
          </div>
          <button 
            onClick={() => setAlerts(prev => prev.filter((_, idx) => idx !== i))}
            className="ml-4 hover:bg-white hover:bg-opacity-10 rounded px-2 self-start"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
};
