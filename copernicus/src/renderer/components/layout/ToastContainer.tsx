import React, { useEffect } from 'react'
import { useToastStore, Toast } from '../../store/toastStore'

const TOAST_DURATION_MS = 4000

const TYPE_STYLES: Record<Toast['type'], string> = {
  info:    'border-copernicus-steel text-zinc-300',
  success: 'border-copernicus-phosphor/50 text-copernicus-phosphor',
  error:   'border-red-500/50 text-red-400',
  warn:    'border-yellow-500/50 text-yellow-400',
}

const ToastItem: React.FC<{ toast: Toast }> = ({ toast }) => {
  const removeToast = useToastStore(s => s.removeToast)

  useEffect(() => {
    const timer = setTimeout(() => removeToast(toast.id), TOAST_DURATION_MS)
    return () => clearTimeout(timer)
  }, [toast.id, removeToast])

  return (
    <div
      className={`flex items-start gap-2 bg-[#111] border rounded px-3 py-2 text-xs font-mono
        shadow-lg max-w-xs animate-in slide-in-from-right-4 fade-in duration-200
        ${TYPE_STYLES[toast.type]}`}
    >
      <span className="flex-1">{toast.message}</span>
      <button
        onClick={() => removeToast(toast.id)}
        className="text-zinc-500 hover:text-zinc-300 ml-1 shrink-0"
      >
        ✕
      </button>
    </div>
  )
}

export const ToastContainer: React.FC = () => {
  const toasts = useToastStore(s => s.toasts)

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-8 right-4 z-[200] flex flex-col gap-2 items-end">
      {toasts.map(toast => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </div>
  )
}
