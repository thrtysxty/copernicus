import React from 'react';
import { Maximize2, Minimize2, RotateCcw } from 'lucide-react';
import { useLayoutStore } from '../../store/useLayoutStore';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

interface PanelProps {
  id: string;
  className?: string;
  children: React.ReactNode;
  back?: React.ReactNode;
  title: string;
}

export const Panel: React.FC<PanelProps> = ({ id, className, children, back, title }) => {
  const { panels, toggleFlip, toggleSpotlight, registerPanel } = useLayoutStore();
  const state = panels[id] || { flipped: false, spotlight: false };

  React.useEffect(() => {
    registerPanel(id);
  }, [id, registerPanel]);

  const handleFlip = () => toggleFlip(id);
  const handleSpotlight = () => toggleSpotlight(id);

  const containerClass = twMerge(
    'relative bg-copernicus-bg border border-copernicus-steel transition-all duration-300 flex flex-col',
    state.spotlight ? 'fixed inset-4 z-50 shadow-2xl border-copernicus-phosphor' : className
  );

  return (
    <div className={containerClass}>
      {/* Header */}
      <div className="h-header flex items-center justify-between px-2 bg-copernicus-steel/20 border-b border-copernicus-steel select-none group">
        <span className="text-[10px] uppercase tracking-wider text-zinc-400 group-hover:text-copernicus-phosphor transition-colors">
          {state.flipped && back ? `${title} (Back)` : title}
        </span>
        <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {back && (
            <button onClick={handleFlip} className="p-0.5 hover:text-copernicus-phosphor">
              <RotateCcw size={10} />
            </button>
          )}
          <button onClick={handleSpotlight} className="p-0.5 hover:text-copernicus-phosphor">
            {state.spotlight ? <Minimize2 size={10} /> : <Maximize2 size={10} />}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-grow relative overflow-hidden">
        {state.flipped && back ? back : children}
      </div>
    </div>
  );
};
