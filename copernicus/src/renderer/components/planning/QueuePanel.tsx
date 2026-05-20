import React, { useState } from 'react'
import { useQueueStore, QueueEntry } from '../../store/queueStore'

export const QueuePanel: React.FC = () => {
  const { queue, addToQueue, markDone, markFailed, pendingReadyStories, clearPendingReady } = useQueueStore()
  const [showForm, setShowForm] = useState(false)
  const [newStoryNum, setNewStoryNum] = useState('')
  const [newTitle, setNewTitle] = useState('')
  const [newBlockedBy, setNewBlockedBy] = useState('')

  const handleAdd = () => {
    const num = parseInt(newStoryNum, 10)
    if (isNaN(num) || !newTitle.trim()) return
    const blockedBy = newBlockedBy.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n))
    addToQueue(num, blockedBy, newTitle)
    setNewStoryNum('')
    setNewTitle('')
    setNewBlockedBy('')
    setShowForm(false)
  }

  const getStatusColor = (status: QueueEntry['status']) => {
    switch (status) {
      case 'waiting': return 'bg-zinc-600'
      case 'ready':   return 'bg-copernicus-phosphor'
      case 'running': return 'bg-blue-400'
      case 'done':    return 'bg-green-500'
      case 'failed':  return 'bg-red-500'
      default:        return 'bg-zinc-400'
    }
  }

  return (
    <div data-testid="panel-queue" className="flex flex-col h-full bg-[#050505] text-zinc-300 font-sans p-4">
      {pendingReadyStories.length > 0 && (
        <div className="border-l-2 border-copernicus-phosphor bg-zinc-900 border border-copernicus-phosphor/30 p-3 mb-4 flex justify-between items-center rounded">
          <span className="text-copernicus-phosphor font-medium">
            {pendingReadyStories.length} stories unblocked — dispatch?
          </span>
          <button 
            onClick={clearPendingReady}
            className="text-[10px] uppercase tracking-wider bg-zinc-800 hover:bg-zinc-700 px-2 py-1 rounded"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto space-y-2">
        {queue.map((entry) => (
          <div key={entry.storyNumber} className="bg-zinc-900/50 border border-zinc-800 p-3 rounded flex items-center gap-3">
            <div className="bg-zinc-800 text-[10px] font-mono px-1.5 py-0.5 rounded text-zinc-400">
              #{entry.storyNumber}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{entry.title}</div>
              {entry.blockedBy.length > 0 && entry.status === 'waiting' && (
                <div className="flex flex-wrap gap-1 mt-1">
                  <span className="text-[10px] text-zinc-500">Blocked by:</span>
                  {entry.blockedBy.map(dep => (
                    <span key={dep} className="text-[9px] bg-zinc-800 px-1 rounded text-zinc-500">
                      #{dep}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="flex items-center gap-3">
              <div className={`w-2 h-2 rounded-full ${getStatusColor(entry.status)}`} />
              
              {(entry.status === 'ready' || entry.status === 'running') && (
                <div className="flex gap-1">
                  <button 
                    onClick={() => markDone(entry.storyNumber)}
                    className="text-[10px] bg-green-900/30 hover:bg-green-900/50 text-green-400 px-2 py-1 rounded border border-green-900/50"
                  >
                    Done
                  </button>
                  <button 
                    onClick={() => markFailed(entry.storyNumber)}
                    className="text-[10px] bg-red-900/30 hover:bg-red-900/50 text-red-400 px-2 py-1 rounded border border-red-900/50"
                  >
                    Fail
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 border-t border-zinc-800 pt-4">
        {showForm ? (
          <div className="bg-zinc-900 p-3 rounded border border-zinc-800 space-y-3">
            <div className="grid grid-cols-4 gap-2">
              <input 
                placeholder="Story #" 
                className="col-span-1 bg-zinc-800 border border-zinc-700 p-1.5 text-xs rounded outline-none focus:border-copernicus-phosphor/50"
                value={newStoryNum}
                onChange={e => setNewStoryNum(e.target.value)}
              />
              <input 
                placeholder="Title" 
                className="col-span-3 bg-zinc-800 border border-zinc-700 p-1.5 text-xs rounded outline-none focus:border-copernicus-phosphor/50"
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
              />
            </div>
            <input 
              placeholder="Blocked by (comma separated, e.g. 101, 102)" 
              className="w-full bg-zinc-800 border border-zinc-700 p-1.5 text-xs rounded outline-none focus:border-copernicus-phosphor/50"
              value={newBlockedBy}
              onChange={e => setNewBlockedBy(e.target.value)}
            />
            <div className="flex gap-2 justify-end">
              <button 
                onClick={() => setShowForm(false)}
                className="text-xs text-zinc-500 hover:text-zinc-300 px-2 py-1"
              >
                Cancel
              </button>
              <button 
                onClick={handleAdd}
                className="text-xs bg-copernicus-phosphor text-[#050505] font-medium px-3 py-1 rounded"
              >
                Add Story
              </button>
            </div>
          </div>
        ) : (
          <button 
            onClick={() => setShowForm(true)}
            className="w-full border border-dashed border-zinc-700 hover:border-zinc-500 text-zinc-500 hover:text-zinc-400 py-2 rounded text-sm transition-colors"
          >
            + Add to Queue
          </button>
        )}
      </div>
    </div>
  )
}
