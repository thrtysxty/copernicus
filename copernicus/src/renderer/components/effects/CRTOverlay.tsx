import React from 'react'

interface CRTOverlayProps {
  enabled: boolean
  anyAgentActive: boolean
  heavyLoad: boolean
}

export const CRTOverlay: React.FC<CRTOverlayProps> = ({ enabled, anyAgentActive, heavyLoad }) => {
  if (!enabled) return null

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes flicker {
          0%, 100% { opacity: 0.30; }
          50% { opacity: 0.28; }
        }
        .animate-flicker {
          animation: flicker 0.1s ease-in-out infinite;
        }
      `}} />
      <div className={`fixed inset-0 pointer-events-none z-[300] overflow-hidden transition-opacity duration-500 ${anyAgentActive ? 'opacity-[0.30]' : 'opacity-[0.15]'} ${heavyLoad ? 'animate-flicker' : ''}`}>
        {/* Scanlines */}
        <div 
          className="absolute inset-0"
          style={{
            background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.15) 2px, rgba(0,0,0,0.15) 4px)'
          }}
        />
        {/* Vignette */}
        <div 
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(ellipse at center, transparent 60%, rgba(0,0,0,0.4) 100%)'
          }}
        />
        {/* Edge Glow */}
        {anyAgentActive && (
          <div 
            className="absolute inset-0"
            style={{
              boxShadow: 'inset 0 0 60px rgba(99,102,241,0.12)'
            }}
          />
        )}
      </div>
    </>
  )
}
