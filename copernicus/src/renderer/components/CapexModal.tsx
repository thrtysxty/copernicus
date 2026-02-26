import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useIpcError } from '../hooks/useIpcError';

interface CapexModalProps {
  type: 'start' | 'close';
  isOpen: boolean;
  onClose: () => void;
  session?: any;
}

export function CapexModal({ type, isOpen, onClose, session }: CapexModalProps) {
  const invoke = useIpcError();
  const [formData, setFormData] = useState({
    financial_category: 'CAPEX',
    component: 'platform_core',
    phase: 'DEVELOPMENT',
    story: '',
    description: '',
    capitalizable: true,
  });
  const [stories, setStories] = useState<string[]>([]);
  const [durationStr, setDurationStr] = useState('');
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (isOpen) {
      if (type === 'start') {
        invoke('devtime:defaults').then((defaults: any) => {
          setFormData(prev => ({
            ...prev,
            financial_category: defaults.financial_category || 'CAPEX',
            component: defaults.component || 'platform_core',
            phase: defaults.phase || 'DEVELOPMENT',
            story: defaults.stories[0] || '',
          }));
          setStories(defaults.stories);
        });
      } else if (type === 'close' && session) {
        const durHours = (session.duration_seconds / 3600);
        setDurationStr(`${durHours.toFixed(2)}h`);
        setValue(durHours * 65);
        setFormData(prev => ({
            ...prev,
            capitalizable: true,
            description: '',
        }));
      }
    }
  }, [isOpen, type, session, invoke]);

  const handleSubmit = async () => {
    if (type === 'start') {
      await invoke('devtime:start', {
        financial_category: formData.financial_category,
        component: formData.component,
        phase: formData.phase,
        story: formData.story,
      });
      onClose();
    } else {
      await invoke('devtime:close', {
        description: formData.description,
        capitalizable: formData.capitalizable,
      });
      await invoke('app:quit');
    }
  };

  const handleSkip = async () => {
    if (type === 'close') {
      await invoke('app:quit');
    } else {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100]">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-copernicus-bg border border-copernicus-steel w-[480px] shadow-2xl relative overflow-hidden font-mono"
        >
          <div className="h-8 bg-copernicus-bg border-b border-copernicus-steel flex items-center justify-between px-3">
            <span className="text-xs uppercase tracking-widest text-copernicus-phosphor font-bold">
              {type === 'start' ? 'Start Dev Session' : 'Close Dev Session'}
            </span>
          </div>

          <div className="p-6">
            {type === 'start' ? (
              <div className="space-y-4 text-zinc-300">
                 <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-[10px] uppercase text-zinc-500 mb-1">Financial Type</label>
                        <select 
                            className="w-full bg-[#080808] border border-zinc-800 text-zinc-300 p-2 text-xs focus:border-copernicus-phosphor focus:outline-none"
                            value={formData.financial_category}
                            onChange={e => setFormData({...formData, financial_category: e.target.value})}
                        >
                            <option value="CAPEX">CAPEX</option>
                            <option value="OPEX">OPEX</option>
                            <option value="NONE">NONE</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-[10px] uppercase text-zinc-500 mb-1">Component</label>
                         <input 
                            className="w-full bg-[#080808] border border-zinc-800 text-zinc-300 p-2 text-xs focus:border-copernicus-phosphor focus:outline-none"
                            value={formData.component}
                            onChange={e => setFormData({...formData, component: e.target.value})}
                        />
                    </div>
                 </div>
                 
                 <div>
                    <label className="block text-[10px] uppercase text-zinc-500 mb-1">Phase</label>
                    <select 
                        className="w-full bg-[#080808] border border-zinc-800 text-zinc-300 p-2 text-xs focus:border-copernicus-phosphor focus:outline-none"
                        value={formData.phase}
                        onChange={e => setFormData({...formData, phase: e.target.value})}
                    >
                        <option value="DEVELOPMENT">DEVELOPMENT</option>
                        <option value="PRELIMINARY">PRELIMINARY</option>
                        <option value="POST_IMPLEMENTATION">POST_IMPLEMENTATION</option>
                    </select>
                 </div>

                 <div>
                    <label className="block text-[10px] uppercase text-zinc-500 mb-1">Story</label>
                    <select 
                        className="w-full bg-[#080808] border border-zinc-800 text-zinc-300 p-2 text-xs focus:border-copernicus-phosphor focus:outline-none"
                        value={formData.story}
                        onChange={e => setFormData({...formData, story: e.target.value})}
                    >
                        {stories.length > 0 ? (
                            stories.map(s => <option key={s} value={s}>{s}</option>)
                        ) : (
                            <option value="">No stories found</option>
                        )}
                    </select>
                 </div>
              </div>
            ) : (
              <div className="space-y-4">
                 <div className="flex justify-between items-center text-sm p-3 bg-[#080808] border border-zinc-800">
                    <span className="text-zinc-500">Duration</span>
                    <span className="text-white font-mono">{durationStr}</span>
                 </div>
                 <div className="flex justify-between items-center text-sm p-3 bg-[#080808] border border-zinc-800">
                    <span className="text-zinc-500">Capitalizable Value</span>
                    <span className="text-copernicus-phosphor font-mono">${value.toFixed(2)}</span>
                 </div>

                 <div className="flex items-center gap-2 py-2">
                    <input 
                        type="checkbox" 
                        id="cap-check"
                        className="accent-copernicus-phosphor"
                        checked={formData.capitalizable}
                        onChange={e => setFormData({...formData, capitalizable: e.target.checked})}
                    />
                    <label htmlFor="cap-check" className="text-xs text-zinc-400 select-none cursor-pointer font-bold">MARK AS CAPITALIZABLE ✅</label>
                 </div>

                 <div>
                    <label className="block text-[10px] uppercase text-zinc-500 mb-1">Description</label>
                    <textarea 
                        className="w-full bg-[#080808] border border-zinc-800 text-zinc-300 p-2 text-xs focus:border-copernicus-phosphor focus:outline-none h-20 resize-none"
                        value={formData.description}
                        onChange={e => setFormData({...formData, description: e.target.value})}
                        placeholder="Brief description of work..."
                        autoFocus
                    />
                 </div>
              </div>
            )}

            <div className="flex justify-end gap-3 mt-8">
                <button 
                    onClick={handleSkip}
                    className="px-4 py-2 text-[10px] uppercase tracking-wider text-zinc-500 hover:text-white transition-colors"
                >
                    {type === 'start' ? 'Skip Tracking' : 'Quit Without Saving'}
                </button>
                <button 
                    onClick={handleSubmit}
                    className="px-6 py-2 text-[10px] uppercase tracking-wider font-bold bg-copernicus-phosphor text-black hover:bg-copernicus-phosphor/90 transition-colors"
                >
                    {type === 'start' ? 'Start Session' : 'Save & Quit'}
                </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
