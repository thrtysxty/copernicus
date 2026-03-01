interface Story {
  id: string
  title: string
  type: string
}

interface EpicBadgeProps {
  epicId: string | null
  stories: Story[]
}

export function EpicBadge({ epicId, stories }: EpicBadgeProps) {
  if (!epicId) return null
  const epic = stories.find(s => s.id === epicId)
  if (!epic) return null
  return (
    <p className="mt-1 text-[9px] text-amber-400/70 italic truncate">
      ⬡ {epic.title}
    </p>
  )
}
