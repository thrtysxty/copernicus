import React from 'react'
import { UIComponentProps } from '../types'

export const ParagraphTile: React.FC<{ props: UIComponentProps }> = ({ props }) => {
  // We can differentiate paragraph and label by checking if the default text says 'LABEL' or if it's meant to be a label
  // Let's rely on props.text or default.
  // Actually, wait, the story says "For paragraph... For label...". The canvas adds default `props.text` to "PARAGRAPH" or "LABEL".
  // Let's use that check.
  const text = props.text || ''
  const isLabel = text.toUpperCase() === 'LABEL' || text === 'Label' || text === ''

  if (isLabel && text !== 'PARAGRAPH') {
    return (
      <div className="w-full h-full overflow-hidden pointer-events-none select-none flex items-center px-3 text-zinc-300 text-sm font-medium truncate">
        {props.text || 'Label'}
      </div>
    )
  }

  return (
    <div className="w-full h-full overflow-hidden pointer-events-none select-none flex flex-col justify-center px-3 text-zinc-400 text-sm leading-relaxed">
      <span className="w-full truncate">The quick brown fox jumps</span>
      <span className="w-5/6 truncate">The quick brown fox jumps</span>
      <span className="w-2/3 truncate">The quick brown fox jumps</span>
    </div>
  )
}
