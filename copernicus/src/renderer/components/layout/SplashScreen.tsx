import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

// Mock ipcRenderer for development if not in Electron context
const ipcRenderer = (window as any).ipcRenderer || {
  on: () => {},
  off: () => {},
  send: () => {},
};

const SplashScreen: React.FC = () => {
  // Read the phosphor color passed from main process as a query param
  const params = new URLSearchParams(window.location.search)
  const phosphorHex = params.get('phosphor') ?? '#4ADE80'

  const [status, setStatus] = useState<string>('INITIALIZING SYSTEMS...');
  const [stage, setStage] = useState<'off' | 'igniting' | 'on'>('off');

  // Apply as CSS custom property so Tailwind arbitrary [var(--phosphor)] classes work
  // Also used for inline styles below
  useEffect(() => {
    document.documentElement.style.setProperty('--phosphor', phosphorHex)
  }, [phosphorHex])

  useEffect(() => {
    // Neon Ignite Sequence
    // 0s: Off
    // 0.5s: Click (Flash)
    // 1.0s: Click (Flash)
    // 1.5s: Click (Flash)
    // 2.0s: ON (Steady)
    
    const sequence = [
      { t: 500, s: 'igniting' },
      { t: 1000, s: 'off' },
      { t: 1500, s: 'igniting' },
      { t: 2000, s: 'off' },
      { t: 2500, s: 'igniting' },
      { t: 3000, s: 'on' },
    ];

    const timeouts: NodeJS.Timeout[] = [];

    sequence.forEach(({ t, s }) => {
      const timeout = setTimeout(() => {
        setStage(s as any);
      }, t);
      timeouts.push(timeout);
    });

    // Notify main process we are ready after sequence
    const readyTimeout = setTimeout(() => {
        ipcRenderer.send('splash-ready');
    }, 4500);
    timeouts.push(readyTimeout);

    // IPC Listener for status updates
    const handleStatus = (_event: any, message: string) => {
      setStatus(message);
    };

    ipcRenderer.on('splash-status', handleStatus);

    return () => {
      timeouts.forEach(clearTimeout);
      ipcRenderer.off('splash-status', handleStatus);
    };
  }, []);

  const containerVariants = {
    off: { opacity: 0.1, filter: 'brightness(0.2)' },
    igniting: { opacity: 0.8, filter: 'brightness(1.2)' },
    on: { opacity: 1, filter: 'brightness(1)', transition: { duration: 0.5 } }
  };

  return (
    <div className="h-screen w-screen bg-[#050505] font-mono overflow-hidden flex flex-col items-center justify-center relative select-none cursor-wait" style={{ color: phosphorHex }}>
      {/* Scanline Overlay */}
      <div className="absolute inset-0 z-50 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_4px,3px_100%] pointer-events-none"></div>
      
      <motion.div
        variants={containerVariants}
        initial="off"
        animate={stage}
        className="flex flex-col items-center"
      >
        {/* 3D Orbital Engine */}
        <div className="relative w-64 h-64 mb-12" style={{ perspective: '1000px' }}>
          <motion.div 
            className="w-full h-full relative"
            style={{ transformStyle: 'preserve-3d' }}
            animate={stage === 'on' ? { rotateY: 360, rotateX: 15 } : { rotateY: 0, rotateX: 0 }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          >
            {/* Central Core */}
            <div 
              className="absolute top-1/2 left-1/2 w-12 h-12 rounded-full blur-[2px] -translate-x-1/2 -translate-y-1/2"
              style={{ backgroundColor: phosphorHex, boxShadow: `0 0 40px ${phosphorHex}60` }}
            ></div>
            <div className="absolute top-1/2 left-1/2 w-8 h-8 bg-white rounded-full blur-[1px] -translate-x-1/2 -translate-y-1/2 mix-blend-overlay"></div>

            {/* Orbit Rings */}
            {[1, 2, 3].map((ring) => (
              <div 
                key={ring}
                className="absolute top-1/2 left-1/2 border rounded-full"
                style={{ 
                  width: `${ring * 80}px`, 
                  height: `${ring * 80}px`,
                  transform: `translate(-50%, -50%) rotateX(70deg)`, // Flat rings
                  borderWidth: '1px',
                  borderColor: phosphorHex + '4D'
                }}
              ></div>
            ))}

            {/* Planetary Agents (Particles) */}
            {[0, 120, 240].map((deg, i) => (
                <motion.div
                    key={i}
                    className="absolute top-1/2 left-1/2 w-3 h-3 rounded-full"
                    style={{
                        transform: `translate(-50%, -50%) rotateY(${deg}deg) translateZ(120px)`,
                        backgroundColor: phosphorHex,
                        boxShadow: `0 0 10px ${phosphorHex}`
                    }}
                />
            ))}
          </motion.div>
        </div>

        {/* Text & Status */}
        <div className="z-10 text-center">
          <h1 className="text-4xl font-bold tracking-[0.3em] mb-4 phosphor-glow">COPERNICUS</h1>
          <div className="h-px w-32 mx-auto mb-4" style={{ backgroundColor: phosphorHex + '80' }}></div>
          <div className="text-xs tracking-widest uppercase" style={{ color: phosphorHex }}>
            {status}
          </div>
        </div>
      </motion.div>

      {/* Footer Version */}
      <div className="absolute bottom-6 text-[9px] tracking-widest" style={{ color: phosphorHex + '4D' }}>
        SYSTEM READY :: v0.1.0
      </div>
    </div>
  );
};

export default SplashScreen;
