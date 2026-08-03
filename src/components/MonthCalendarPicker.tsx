'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useLanguage } from '@/lib/i18n'

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const LOCALE_MAP: Record<string, string> = { es: 'es-ES', en: 'en-GB', ca: 'ca-ES', de: 'de-DE' }

export function MonthCalendarPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { lang } = useLanguage()
  const [viewDate, setViewDate] = useState(value || todayStr())

  const d = new Date((viewDate || todayStr()) + 'T12:00:00')
  const year = d.getFullYear()
  const month = d.getMonth()
  const monthLabel = d.toLocaleDateString(LOCALE_MAP[lang], { month: 'long', year: 'numeric' })
  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const cells: (string | null)[] = []
  for (let i = 0; i < firstWeekday; i++) cells.push(null)
  for (let day = 1; day <= daysInMonth; day++) cells.push(`${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`)
  while (cells.length % 7 !== 0) cells.push(null)

  function shiftMonth(delta: number) {
    const next = new Date(year, month + delta, 1)
    setViewDate(`${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-01`)
  }

  const today = todayStr()

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <button type="button" onClick={() => shiftMonth(-1)} className="w-8 h-8 flex items-center justify-center rounded-lg text-fog hover:text-snow hover:bg-surface2 transition-colors">
          <ChevronLeft size={16} />
        </button>
        <p className="text-sm font-semibold text-snow capitalize">{monthLabel}</p>
        <button type="button" onClick={() => shiftMonth(1)} className="w-8 h-8 flex items-center justify-center rounded-lg text-fog hover:text-snow hover:bg-surface2 transition-colors">
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="grid grid-cols-7 mb-1">
        {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map(w => (
          <div key={w} className="h-7 flex items-center justify-center text-xs font-semibold text-mist">{w}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-y-1">
        {cells.map((cell, i) => {
          if (!cell) return <div key={i} className="h-9" />
          const isSelected = cell === value
          const isToday = cell === today
          return (
            <div key={i} className="h-9 flex items-center justify-center">
              <button
                type="button"
                onClick={() => onChange(cell)}
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                  isSelected ? 'bg-lime text-carbon font-bold' :
                  isToday ? 'text-lime border border-lime/50' :
                  'text-snow hover:bg-surface2'
                }`}
              >
                {parseInt(cell.split('-')[2], 10)}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
