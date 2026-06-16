'use client'
import { useEffect, useRef, useState } from 'react'

const ITEM_H = 44
const MONTHS_ES = ['Enero', 'Feb', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Sep', 'Oct', 'Nov', 'Dic']
const CUR_YEAR = new Date().getFullYear()
const YEARS = Array.from({ length: 80 }, (_, i) => CUR_YEAR - i)

function daysInMonth(m: number, y: number) {
  return new Date(y, m, 0).getDate()
}

function Col({ items, selectedIdx, onChange }: {
  items: string[]
  selectedIdx: number
  onChange: (i: number) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const userScrolling = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => {
    if (userScrolling.current) return
    ref.current?.scrollTo({ top: selectedIdx * ITEM_H })
  }, [selectedIdx])

  function onScroll() {
    userScrolling.current = true
    clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      const el = ref.current
      if (!el) return
      const raw = Math.round(el.scrollTop / ITEM_H)
      const idx = Math.max(0, Math.min(items.length - 1, raw))
      el.scrollTo({ top: idx * ITEM_H, behavior: 'smooth' })
      userScrolling.current = false
      onChange(idx)
    }, 120)
  }

  return (
    <div className="relative flex-1 overflow-hidden" style={{ height: 220 }}>
      {/* fade top */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10" style={{ height: 88, background: 'linear-gradient(to bottom, var(--color-surface2), transparent)' }} />
      {/* fade bottom */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10" style={{ height: 88, background: 'linear-gradient(to top, var(--color-surface2), transparent)' }} />
      {/* selection band */}
      <div className="pointer-events-none absolute inset-x-3 z-10 rounded-lg border border-white/10 bg-white/5" style={{ top: '50%', transform: 'translateY(-50%)', height: ITEM_H }} />
      <div
        ref={ref}
        onScroll={onScroll}
        className="scrollbar-hide h-full overflow-y-scroll"
        style={{ scrollSnapType: 'y mandatory' }}
      >
        <div style={{ height: ITEM_H * 2 }} />
        {items.map((item, i) => (
          <div
            key={i}
            style={{ height: ITEM_H, scrollSnapAlign: 'center' }}
            className="flex items-center justify-center"
          >
            <span className={`text-sm transition-all duration-100 ${i === selectedIdx ? 'text-snow font-semibold' : 'text-mist'}`}>
              {item}
            </span>
          </div>
        ))}
        <div style={{ height: ITEM_H * 2 }} />
      </div>
    </div>
  )
}

export function ScrollDatePicker({ value, onChange, className }: {
  value: string
  onChange: (v: string) => void
  className?: string
}) {
  const parsed = value ? new Date(value + 'T12:00:00') : null
  const [day, setDay] = useState(parsed ? parsed.getDate() : 1)
  const [month, setMonth] = useState(parsed ? parsed.getMonth() + 1 : 1)
  const [year, setYear] = useState(parsed ? parsed.getFullYear() : CUR_YEAR - 30)

  useEffect(() => {
    if (!value) return
    const d = new Date(value + 'T12:00:00')
    setDay(d.getDate())
    setMonth(d.getMonth() + 1)
    setYear(d.getFullYear())
  }, [value])

  const maxDay = daysInMonth(month, year)
  const days = Array.from({ length: maxDay }, (_, i) => String(i + 1).padStart(2, '0'))
  const months = MONTHS_ES
  const years = YEARS.map(String)

  const dayIdx = Math.min(day - 1, maxDay - 1)
  const monthIdx = month - 1
  const yearIdx = Math.max(0, YEARS.indexOf(year))

  function emit(d: number, m: number, y: number) {
    onChange(`${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`)
  }

  function handleDay(i: number) { const d = i + 1; setDay(d); emit(d, month, year) }
  function handleMonth(i: number) {
    const m = i + 1
    const max = daysInMonth(m, year)
    const d = Math.min(day, max)
    setMonth(m); setDay(d); emit(d, m, year)
  }
  function handleYear(i: number) {
    const y = YEARS[i]
    const max = daysInMonth(month, y)
    const d = Math.min(day, max)
    setYear(y); setDay(d); emit(d, month, y)
  }

  return (
    <div className={`rounded-xl border border-line bg-surface2 overflow-hidden ${className ?? ''}`}>
      <div className="flex divide-x divide-line">
        <Col items={days} selectedIdx={dayIdx} onChange={handleDay} />
        <Col items={months} selectedIdx={monthIdx} onChange={handleMonth} />
        <Col items={years} selectedIdx={yearIdx} onChange={handleYear} />
      </div>
    </div>
  )
}
