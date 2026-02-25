import React from 'react';
import { GitBranch, Folder, Ticket } from 'lucide-react';

export const StatusBar: React.FC = () => {
  return (
    <div className="h-6 w-full bg-copernicus-bg border-t border-copernicus-steel flex items-center px-4 text-xs font-mono text-copernicus-phosphor select-none">
      <div className="flex items-center space-x-2 mr-6">
        <Folder size={12} />
        <span>~/copernicus</span>
      </div>
      <div className="flex items-center space-x-2 mr-6">
        <GitBranch size={12} />
        <span>main</span>
      </div>
      <div className="flex items-center space-x-2">
        <Ticket size={12} />
        <span>#077: COPERNICUS Foundation</span>
      </div>
      <div className="flex-grow" />
      <div className="text-zinc-500">
        Ready
      </div>
    </div>
  );
};
