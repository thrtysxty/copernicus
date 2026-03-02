interface EpicBadgeProps {
  epicId: string
}

export function EpicBadge({ epicId }: EpicBadgeProps) {
  if (!epicId || epicId === '(none)') return null
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded-sm bg-copernicus-phosphor/10 border border-copernicus-phosphor/30 text-[9px] font-bold text-copernicus-phosphor uppercase tracking-wider">
      {epicId}
    </span>
  )
}
