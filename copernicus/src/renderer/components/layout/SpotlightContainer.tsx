import React from 'react'
import { motion } from 'framer-motion'
import { useLayoutStore } from '../../store/layout'
import { Sidebar, Terminal, Layout } from 'lucide-react'

interface SpotlightContainerProps {
  sidebar: React.ReactNode
  center: React.ReactNode
  right: React.ReactNode
}

export const SpotlightContainer: React.FC<SpotlightContainerProps> = ({ sidebar, center, right }) => {
  const { spotlightPane, setSpotlight } = useLayoutStore()

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && spotlightPane) {
        setSpotlight(null)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [spotlightPane, setSpotlight])

  return (
    <div className="flex-1 flex flex-row overflow-hidden w-full h-full bg-[#050505]">
      {/* Sidebar */}
      <motion.div
        layout
        initial={false}
        animate={{
          width: spotlightPane === 'explorer' ? '100%' : (spotlightPane ? 40 : 256),
          flexGrow: spotlightPane === 'explorer' ? 1 : 0,
          minWidth: spotlightPane && spotlightPane !== 'explorer' ? 40 : undefined
        }}
        transition={{ duration: 0.4, ease: 'easeInOut' }}
        className="flex flex-col border-r border-copernicus-steel bg-copernicus-bg overflow-hidden relative"
      >
        {spotlightPane && spotlightPane !== 'explorer' ? (
           <CollapsedPaneIcon icon={<Sidebar size={16} />} label="NAV" onClick={() => setSpotlight('explorer')} />
        ) : (
           <div className="w-full h-full flex flex-col min-w-[256px]">
             {sidebar}
           </div>
        )}
      </motion.div>

      {/* Center */}
      <motion.div
        layout
        initial={false}
        animate={{
          flexGrow: 1, 
          width: spotlightPane === 'editor' ? '100%' : (spotlightPane ? 40 : 'auto'),
          maxWidth: spotlightPane && spotlightPane !== 'editor' ? 40 : '100%'
        }}
        transition={{ duration: 0.4, ease: 'easeInOut' }}
        className="flex flex-col bg-copernicus-bg overflow-hidden relative"
      >
        {spotlightPane && spotlightPane !== 'editor' ? (
            <CollapsedPaneIcon icon={<Layout size={16} />} label="EDIT" onClick={() => setSpotlight('editor')} />
        ) : (
            <div className="w-full h-full flex flex-col min-w-[300px]">
              {center}
            </div>
        )}
      </motion.div>

      {/* Right */}
      <motion.div
        layout
        initial={false}
        animate={{
          width: spotlightPane === 'telemetry' ? '100%' : (spotlightPane ? 40 : 320),
          flexGrow: spotlightPane === 'telemetry' ? 1 : 0,
           minWidth: spotlightPane && spotlightPane !== 'telemetry' ? 40 : undefined
        }}
        transition={{ duration: 0.4, ease: 'easeInOut' }}
        className="flex flex-col border-l border-copernicus-steel bg-copernicus-bg overflow-hidden relative"
      >
        {spotlightPane && spotlightPane !== 'telemetry' ? (
             <CollapsedPaneIcon icon={<Terminal size={16} />} label="TERM" onClick={() => setSpotlight('telemetry')} />
        ) : (
             <div className="w-full h-full flex flex-col min-w-[320px]">
               {right}
             </div>
        )}
      </motion.div>
    </div>
  )
}

const CollapsedPaneIcon = ({ icon, label, onClick }: { icon: React.ReactNode, label: string, onClick: () => void }) => (
  <div 
    className="h-full w-full flex flex-col items-center pt-4 cursor-pointer hover:bg-zinc-800 transition-colors"
    onClick={onClick}
    title={`Expand ${label}`}
  >
    <div className="text-copernicus-phosphor mb-2">{icon}</div>
    <div 
      className="text-[10px] text-zinc-500 uppercase tracking-widest whitespace-nowrap"
      style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
    >
      {label}
    </div>
  </div>
)
