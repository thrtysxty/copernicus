import { motion } from 'framer-motion'
import { ReactNode } from 'react'

interface FlippablePanelProps {
  front: ReactNode
  back: ReactNode
  isFlipped: boolean
  className?: string
  direction?: 'horizontal' | 'vertical'
}

export function FlippablePanel({ front, back, isFlipped, className = '', direction = 'horizontal' }: FlippablePanelProps) {
  const rotateValue = 180
  const rotateProperty = direction === 'horizontal' ? 'rotateY' : 'rotateX'

  return (
    <div 
      className={`relative w-full h-full ${className}`} 
      style={{ perspective: '1000px' }}
    >
      <motion.div
        className="w-full h-full relative"
        initial={false}
        animate={{ [rotateProperty]: isFlipped ? rotateValue : 0 }}
        transition={{ duration: 0.6, type: 'spring', damping: 20 }}
        style={{ transformStyle: 'preserve-3d' }}
      >
        <div 
          className="absolute w-full h-full bg-copernicus-bg" 
          style={{ backfaceVisibility: 'hidden' }}
        >
          {front}
        </div>

        <div 
          className="absolute w-full h-full bg-copernicus-bg" 
          style={{ 
            backfaceVisibility: 'hidden', 
            transform: direction === 'horizontal' ? 'rotateY(180deg)' : 'rotateX(180deg)' 
          }}
        >
          {back}
        </div>
      </motion.div>
    </div>
  )
}
