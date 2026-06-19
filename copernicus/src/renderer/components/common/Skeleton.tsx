import React from 'react'

interface SkeletonProps {
  width?: string | number
  height?: string | number
  className?: string
  rounded?: 'none' | 'sm' | 'md' | 'lg' | 'full'
}

const ROUNDED_MAP = {
  none: 'rounded-none',
  sm: 'rounded-sm',
  md: 'rounded-md',
  lg: 'rounded-lg',
  full: 'rounded-full',
}

export const Skeleton = ({
  width = '100%',
  height = '1rem',
  className = '',
  rounded = 'md',
}: SkeletonProps) => {
  return (
    <div
      className={`bg-zinc-800 animate-pulse ${ROUNDED_MAP[rounded]} ${className}`}
      style={{ width, height }}
    />
  )
}
