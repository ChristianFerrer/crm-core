'use client'

import { useEffect, useState } from 'react'
import { CheckCircle, X, AlertCircle } from 'lucide-react'

export type ToastType = 'success' | 'error'

export interface ToastData {
  id: number
  message: string
  type: ToastType
}

let toastId = 0
const listeners: Array<(t: ToastData) => void> = []

export function showToast(message: string, type: ToastType = 'success') {
  const toast: ToastData = { id: ++toastId, message, type }
  listeners.forEach(fn => fn(toast))
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastData[]>([])

  useEffect(() => {
    const handler = (t: ToastData) => {
      setToasts(prev => [...prev, t])
      setTimeout(() => setToasts(prev => prev.filter(x => x.id !== t.id)), 3500)
    }
    listeners.push(handler)
    return () => { const i = listeners.indexOf(handler); if (i >= 0) listeners.splice(i, 1) }
  }, [])

  if (toasts.length === 0) return null

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[200] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-lg text-sm font-semibold pointer-events-auto backdrop-blur-md border ${
            t.type === 'success'
              ? 'bg-lime/90 text-ink border-lime/60'
              : 'bg-rose/90 text-snow border-rose/60'
          }`}
        >
          {t.type === 'success' ? <CheckCircle size={15} strokeWidth={2.5} /> : <AlertCircle size={15} strokeWidth={2.5} />}
          {t.message}
          <button
            onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))}
            className="ml-1 opacity-60 hover:opacity-100"
          >
            <X size={13} />
          </button>
        </div>
      ))}
    </div>
  )
}
