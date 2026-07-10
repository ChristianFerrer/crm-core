'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { BarChart2, Tag, ShoppingBag, Building2, CalendarDays, ChevronDown, Check } from 'lucide-react'

const ITEMS = [
  { href: '/panel', label: 'Resumen', icon: BarChart2 },
  { href: '/panel/servicios', label: 'Servicios', icon: Tag },
  { href: '/panel/tienda', label: 'Tienda', icon: ShoppingBag },
  { href: '/panel/perfil', label: 'Perfil', icon: Building2 },
  { href: '/checkin', label: 'Visitas', icon: CalendarDays },
]

export function PanelNav() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const current = ITEMS.find(i => i.href === pathname) ?? ITEMS[0]
  const Cur = current.icon

  return (
    <div className="mb-6">
      {/* Escritorio: tabs horizontales */}
      <div className="hidden sm:inline-flex gap-1 bg-surface rounded-xl p-1 border border-line">
        {ITEMS.map(it => {
          const active = it.href === pathname
          const Icon = it.icon
          return (
            <Link
              key={it.href}
              href={it.href}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${
                active ? 'bg-lime text-ink' : 'text-fog hover:text-snow'
              }`}
            >
              <Icon size={13} /> {it.label}
            </Link>
          )
        })}
      </div>

      {/* Móvil: dropdown */}
      <div className="relative sm:hidden">
        <button
          onClick={() => setOpen(o => !o)}
          className="flex w-full items-center gap-2.5 bg-surface border border-line rounded-xl px-4 py-2.5 text-sm font-semibold text-snow"
        >
          <Cur size={14} className="text-lime shrink-0" />
          <span className="flex-1 text-left">{current.label}</span>
          <ChevronDown size={14} className={`text-fog shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>

        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <div className="absolute left-0 z-50 mt-1 w-full rounded-xl border border-line bg-surface shadow-2xl overflow-hidden py-1">
              {ITEMS.map(it => {
                const active = it.href === pathname
                const Icon = it.icon
                return (
                  <Link
                    key={it.href}
                    href={it.href}
                    onClick={() => setOpen(false)}
                    className={`flex items-center gap-2.5 px-4 py-2.5 text-sm font-semibold transition-colors ${
                      active ? 'bg-lime/10 text-lime' : 'text-fog hover:text-snow hover:bg-surface2'
                    }`}
                  >
                    <Icon size={14} className="shrink-0" />
                    <span className="flex-1">{it.label}</span>
                    {active && <Check size={14} className="shrink-0" />}
                  </Link>
                )
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
