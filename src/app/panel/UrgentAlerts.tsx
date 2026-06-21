'use client'

import { useState } from 'react'
import { AlertTriangle, Gift, X } from 'lucide-react'

type Alert = {
  id: string
  type: 'bono' | 'birthday'
  message: string
}

export function UrgentAlerts({ alerts: initial }: { alerts: Alert[] }) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const visible = initial.filter(a => !dismissed.has(a.id))
  if (visible.length === 0) return null

  return (
    <div className="space-y-2">
      {visible.map(a => (
        <div
          key={a.id}
          className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${
            a.type === 'birthday'
              ? 'border-iris/30 bg-iris/10'
              : 'border-amber/30 bg-amber/10'
          }`}
        >
          {a.type === 'birthday'
            ? <Gift size={14} className="text-iris shrink-0" />
            : <AlertTriangle size={14} className="text-amber shrink-0" />
          }
          <p className={`flex-1 text-xs font-medium ${a.type === 'birthday' ? 'text-iris' : 'text-amber'}`}>
            {a.message}
          </p>
          <button
            onClick={() => setDismissed(prev => new Set([...prev, a.id]))}
            className="text-fog hover:text-snow transition-colors"
          >
            <X size={13} />
          </button>
        </div>
      ))}
    </div>
  )
}
