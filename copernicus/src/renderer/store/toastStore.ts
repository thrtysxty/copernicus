import { create } from 'zustand'

export type ToastType = 'info' | 'success' | 'error' | 'warn'

export interface Toast {
  id: string
  message: string
  type: ToastType
}

interface ToastState {
  toasts: Toast[]
  addToast: (message: string, type?: ToastType) => void
  removeToast: (id: string) => void
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],

  addToast: (message, type = 'info') => {
    const id = `toast-${crypto.randomUUID()}`
    set(state => ({ toasts: [...state.toasts, { id, message, type }] }))
  },

  removeToast: (id) => {
    set(state => ({ toasts: state.toasts.filter(t => t.id !== id) }))
  },
}))
