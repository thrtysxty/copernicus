import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import splashImg from '../../assets/splash.png';

// Mock ipcRenderer for development if not in Electron context
const ipcRenderer = (window as any).ipcRenderer || {
  on: () => {},
  off: () => {},
  send: () => {},
};

interface SplashScreenProps {
  onComplete?: () => void;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ onComplete }) => {
  // Read the phosphor color passed from main process as a query param
  const params = new URLSearchParams(window.location.search)
  const phosphorHex = params.get('phosphor') ?? '#4ADE80'

  const [stage, setStage] = useState<'off' | 'igniting' | 'on'>('off');

  // Apply as CSS custom property so Tailwind arbitrary [var(--phosphor)] classes work
  useEffect(() => {
    document.documentElement.style.setProperty('--phosphor', phosphorHex)
  }, [phosphorHex])

  useEffect(() => {
    // CRT Warm-up Sequence
    const sequence = [
      { t: 500, s: 'igniting' },
      { t: 800, s: 'off' },
      { t: 1200, s: 'igniting' },
      { t: 1500, s: 'off' },
      { t: 2000, s: 'igniting' },
      { t: 2800, s: 'on' },
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
        if (onComplete) onComplete();
    }, 4500);
    timeouts.push(readyTimeout);

    return () => {
      timeouts.forEach(clearTimeout);
    };
  }, [onComplete]);

  const imageVariants = {
    off: {
      opacity: 0.1,
      filter: 'grayscale(100%) brightness(0.2) contrast(1.2)',
      scale: 1.05
    },
    igniting: {
      opacity: 0.8,
      filter: 'grayscale(100%) brightness(1.5) contrast(1.5)',
      scale: [1.05, 1.06, 1.05],
      transition: { duration: 0.1, repeat: 1 }
    },
    on: {
      opacity: 1,
      filter: 'grayscale(0%) sepia(1) hue-rotate(90deg) saturate(2.5) brightness(1.1) contrast(1.1)',
      scale: 1,
      transition: {
        duration: 0.8,
        ease: "easeOut"
      }
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-[#050505] overflow-hidden select-none cursor-wait">
      {/* Draggable Title Region */}
      <div className="absolute top-0 left-0 h-8 w-full pl-20 z-[100]" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}></div>

      {/* Scanline Overlay */}
      <div className="absolute inset-0 z-50 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_4px,3px_100%] pointer-events-none"></div>

      {/* Full-bleed Splash Image */}
      <motion.div
        variants={imageVariants}
        initial="off"
        animate={stage}
        className="w-full h-full"
      >
        <img
          src={splashImg}
          alt="Copernicus Splash"
          className="w-full h-full object-cover"
        />
      </motion.div>
    </div>
  );
};

export default SplashScreen;
