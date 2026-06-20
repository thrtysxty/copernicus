import React from 'react'
import { motion } from 'framer-motion'
import { Brain, ArrowRight } from 'lucide-react'

interface RetroCardProps {
  retroId: string
  status: 'pending_review'
  itemCounts: {
    memory_facts: number
    file_patches: number
    story_queues: number
    conventions: number
  }
  priorInflectionCount: number
  sessionsRange: {
    from_ts: number
    to_ts: number
    session_count: number
  }
  pendingCount?: number
  onReview: (id: string) => void
}

const formatDate = (ts: number) => {
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export const RetroCard = React.memo(({
  retroId,
  itemCounts,
  priorInflectionCount,
  sessionsRange,
  pendingCount = 0,
  onReview
}: RetroCardProps) => {
  const dateStr = `${formatDate(sessionsRange.from_ts)} – ${formatDate(sessionsRange.to_ts)}`

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-3 bg-indigo-950/20 border border-indigo-500/30 rounded flex flex-col justify-between shrink-0 relative overflow-hidden group hover:border-indigo-400/50 transition-colors"
      style={{ height: 140 }}
    >
      <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-2xl -mr-16 -mt-16 pointer-events-none" />
      
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5 text-indigo-400">
            <Brain size={12} />
            <span className="text-[11px] font-bold uppercase tracking-widest">Retrospective Ready</span>
          </div>
          {pendingCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-[2px] bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[11px] font-bold uppercase">
              {pendingCount} more pending
            </span>
          )}
        </div>

        <div className="space-y-1.5">
          <div className="text-[11px] text-zinc-300 font-medium">
            {dateStr}
          </div>
          <div className="text-[11px] text-zinc-500">
            {itemCounts.memory_facts} memory {itemCounts.memory_facts === 1 ? 'fact' : 'facts'} ·{' '}
            {itemCounts.file_patches} file {itemCounts.file_patches === 1 ? 'patch' : 'patches'} ·{' '}
            {itemCounts.story_queues} {itemCounts.story_queues === 1 ? 'story' : 'stories'} ·{' '}
            {itemCounts.conventions} {itemCounts.conventions === 1 ? 'convention' : 'conventions'}
          </div>
          {priorInflectionCount > 0 && (
            <div className="text-[11px] text-indigo-500/70 uppercase font-bold tracking-wider">
              Built on {priorInflectionCount} prior {priorInflectionCount === 1 ? 'retro' : 'retros'}
            </div>
          )}
        </div>
      </div>

      <button
        onClick={() => onReview(retroId)}
        className="mt-auto w-full py-1.5 flex items-center justify-center gap-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/20 rounded transition-colors text-[11px] font-bold uppercase tracking-widest"
      >
        Review <ArrowRight size={10} />
      </button>
    </motion.div>
  )
})
RetroCard.displayName = 'RetroCard'
