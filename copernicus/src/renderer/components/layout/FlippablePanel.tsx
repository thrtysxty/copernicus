import React from 'react'
import { motion } from 'framer-motion'
import { useLayoutStore } from '../../store/layout'

interface FlippablePanelProps {
  id: string
  front: React.ReactNode
  back: React.ReactNode
  className?: string
}

export const FlippablePanel: React.FC<FlippablePanelProps> = ({ id, front, back, className = '' }) => {
  const { flippedPanes } = useLayoutStore()
  const isFlipped = flippedPanes.includes(id)

  return (
    <div 
      className={`relative w-full h-full ${className}`}
      style={{ perspective: 1000 }}
    >
      <motion.div
        className="relative w-full h-full"
        initial={false}
        animate={{ rotateY: isFlipped ? 180 : 0 }}
        transition={{ duration: 0.4, ease: 'easeInOut' }}
        style={{ transformStyle: 'preserve-3d' }}
      >
        <div
          className="absolute inset-0 w-full h-full bg-copernicus-bg"
          style={{ backfaceVisibility: 'hidden' }}
        >
          {front}
        </div>

        <div
          className="absolute inset-0 w-full h-full bg-copernicus-bg"
          style={{ 
            backfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)' 
          }}
        >
          {back}
        </div>
      </motion.div>
    </div>
  )
}
