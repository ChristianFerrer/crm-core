'use client'

import { useState } from 'react'
import { AlertTriangle, Gift, X, Bell } from 'lucide-react'
import { useLanguage } from '@/lib/i18n'

type Alert = {
  id: string
  type: 'bono' | 'birthday'
  message: string
}

export function UrgentAlerts({ alerts: initial }: { alerts: Alert[] }) {
  const { t } = useLanguage()
  const [open, setOpen] = useState(false)
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const visible = initial.filter(a => !dismissed.has(a.id))

  return (
    <div className="relative shrink-0">
      <button
        onClick={() => setOpen(o => !o)}
        className={`relative flex items-center justify-center w-10 h-10 rounded-xl border transition-colors ${
          visible.length > 0 ? 'border-amber/40 bg-amber/10 text-amber hover:bg-amber/20' : 'border-line bg-surface text-fog hover:text-snow hover:bg-surface2'
        }`}
      >
        <Bell size={16} />
        {visible.length > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 bg-rose border-2 border-carbon text-white text-xs font-bold rounded-full flex items-center justify-center px-1">
            {visible.length}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-0 z-[60]" onClick={() => setOpen(false)}>
          <div
            className="absolute right-4 top-16 sm:top-auto sm:right-0 sm:mt-2 w-[calc(100vw-2rem)] max-w-sm rounded-2xl border border-amber/30 bg-surface shadow-2xl flex flex-col max-h-[70vh]"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-line shrink-0">
              <div className="flex items-center gap-2">
                <Bell size={14} className="text-amber" />
                <span className="text-sm font-semibold text-snow">{t('panelres_alertas_activas')}</span>
                <span className="text-xs font-bold bg-rose border-2 border-surface text-white px-1.5 py-0.5 rounded-full">{visible.length}</span>
              </div>
              <button onClick={() => setOpen(false)} className="text-fog hover:text-snow transition-colors p-1">
                <X size={16} />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 px-4 py-3 space-y-2">
              {visible.map(a => (
                <div
                  key={a.id}
                  className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${
                    a.type === 'birthday'
                      ? 'border-iris/30 bg-iris/10'
                      : 'border-amber/30 bg-amber/10'
                  }`}
                >
                  {a.type === 'birthday'
                    ? <Gift size={13} className="text-iris shrink-0" />
                    : <AlertTriangle size={13} className="text-amber shrink-0" />
                  }
                  <p className={`flex-1 text-xs font-medium ${a.type === 'birthday' ? 'text-iris' : 'text-amber'}`}>
                    {a.message}
                  </p>
                  <button
                    onClick={() => setDismissed(prev => new Set([...prev, a.id]))}
                    className="text-fog hover:text-snow transition-colors shrink-0"
                  >
                    <X size={13} />
                  </button>
                </div>
              ))}
              {visible.length === 0 && (
                <p className="text-xs text-mist text-center py-4">{t('panelres_todas_cerradas')}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
