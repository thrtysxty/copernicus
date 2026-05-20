import React, { useState } from 'react';
import { useIpcError } from '../../hooks/useIpcError';
import { unwrapIpc } from '../../types/ipc';

export const BrowserPanel: React.FC = () => {
  const [url, setUrl] = useState('http://localhost:3000');
  const [snapshot, setSnapshot] = useState<any>(null);
  const [screenshotData, setScreenshotData] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const invoke = useIpcError();

  const handleNavigate = async () => {
    setIsLoading(true);
    setScreenshotData(null);
    setSnapshot(null);
    const result = await invoke<any>('browser:navigate', url);
    if (result && result.ok) {
      // Assuming result contains state or success indication
      // Now fetch snapshot
      handleSnapshot();
    }
    setIsLoading(false);
  };

  const handleSnapshot = async () => {
    setIsLoading(true);
    const result = await invoke<any>('browser:snapshot');
    if (result && result.ok) {
      setSnapshot(unwrapIpc(result));
    }
    setIsLoading(false);
  };

  const handleScreenshot = async () => {
    setIsLoading(true);
    const result = await invoke<any>('browser:screenshot', { full: true });
    if (result && result.ok) {
      // The result.data might be a base64 string or file path depending on agent-browser JSON output
      const data = unwrapIpc<any>(result);
      if (data && data.screenshot) {
         setScreenshotData(data.screenshot); // Assuming it returns a base64 or path
      }
    }
    setIsLoading(false);
  };

  const truncatedSnapshot = snapshot ? JSON.stringify(snapshot, null, 2).substring(0, 10000) + (JSON.stringify(snapshot).length > 10000 ? '\n... (truncated)' : '') : null;

  return (
    <div data-testid="panel-browser" className="flex flex-col h-full bg-zinc-900 text-zinc-300 p-4 font-mono text-sm">
      <div className="flex items-center space-x-2 mb-4">
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="flex-1 bg-zinc-800 border border-zinc-700 p-2 focus:outline-none focus:border-zinc-500"
          placeholder="Enter URL..."
        />
        <button
          onClick={handleNavigate}
          disabled={isLoading}
          className="bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 px-4 py-2 disabled:opacity-50"
        >
          Navigate
        </button>
        <button
          onClick={handleSnapshot}
          disabled={isLoading}
          className="bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 px-4 py-2 disabled:opacity-50"
        >
          Snapshot
        </button>
        <button
          onClick={handleScreenshot}
          disabled={isLoading}
          className="bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 px-4 py-2 disabled:opacity-50"
        >
          Screenshot
        </button>
      </div>

      <div className="flex-1 flex overflow-hidden space-x-4">
        <div className="flex-1 flex flex-col bg-zinc-950 p-2 overflow-auto border border-zinc-800">
          <h3 className="text-zinc-500 mb-2 font-bold uppercase text-xs">A11y Tree Snapshot</h3>
          {truncatedSnapshot ? (
             <pre className="text-xs text-zinc-400 whitespace-pre-wrap">{truncatedSnapshot}</pre>
          ) : (
             <div className="text-zinc-600 text-center mt-10">No snapshot available</div>
          )}
        </div>
        <div className="flex-1 flex flex-col bg-zinc-950 p-2 overflow-auto border border-zinc-800">
          <h3 className="text-zinc-500 mb-2 font-bold uppercase text-xs">Screenshot</h3>
          {screenshotData ? (
             <img src={`data:image/png;base64,${screenshotData}`} alt="Browser Screenshot" className="max-w-full h-auto object-contain" />
          ) : (
             <div className="text-zinc-600 text-center mt-10">No screenshot available</div>
          )}
        </div>
      </div>
    </div>
  );
};
