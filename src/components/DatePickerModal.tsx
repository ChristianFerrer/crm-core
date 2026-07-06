'use client'
import { useState } from 'react'
import { ScrollDatePicker } from './ScrollDatePicker'
import { Calendar, X } from 'lucide-react'

function fmt(d: string) {
  if (!d) return null
  return new Date(d + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
}

export function DatePickerModal({ value, onChange, placeholder = 'Seleccionar fecha', className }: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(value)

  function handleOpen() { setDraft(value); setOpen(true) }
  function handleConfirm() { onChange(draft || value); setOpen(false) }

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className={`w-full bg-surface2 border border-line rounded-xl px-4 py-3 text-sm text-left flex items-center gap-3 hover:border-line2 transition-colors ${className ?? ''}`}
      >
        <Calendar size={14} className="text-mist shrink-0" />
        <span className={value ? 'text-snow' : 'text-mist'}>{fmt(value) ?? placeholder}</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center pb-16 lg:pb-0" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div
            className="relative w-full max-w-sm rounded-t-3xl border-t border-x border-line bg-surface flex flex-col"
            style={{ maxHeight: '85vh' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex-none px-5 pt-4 pb-3">
              <div className="mx-auto w-10 h-1 rounded-full bg-line2 mb-3" />
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-snow">Fecha de nacimiento</p>
                <button type="button" onClick={() => setOpen(false)} className="text-mist hover:text-fog p-1">
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Carousel */}
            <div className="flex-none px-5">
              <ScrollDatePicker value={draft || value} onChange={setDraft} />
            </div>

            {/* Confirm — always pinned at bottom */}
            <div className="flex-none px-5 pt-3 pb-5">
              <button
                type="button"
                onClick={handleConfirm}
                className="w-full rounded-xl bg-lime py-3.5 text-sm font-semibold text-ink hover:bg-lime-deep transition-colors active:scale-[0.99]"
                style={{ boxShadow: 'var(--shadow-lime)' }}
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
