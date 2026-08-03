'use client'

import { useState } from 'react'
import { Users, TrendingUp, RotateCw } from 'lucide-react'

export function StatFlipCards({
  totalMembers,
  todayCount,
  monthCount,
}: {
  totalMembers: number
  todayCount: number
  monthCount: number
}) {
  const cards = [
    { icon: Users,      label: 'Miembros', value: totalMembers, accent: 'text-lime', bg: 'bg-lime/10', desc: 'Total de miembros registrados en tu ludoteca.' },
    { icon: TrendingUp, label: 'Hoy',      value: todayCount,   accent: 'text-iris', bg: 'bg-iris/10', desc: 'Visitas (entradas) registradas hoy.' },
    { icon: TrendingUp, label: 'Este mes', value: monthCount,   accent: 'text-mint', bg: 'bg-mint/10', desc: 'Visitas acumuladas en el mes en curso.' },
  ]
  const [flipped, setFlipped] = useState<Record<number, boolean>>({})

  return (
    <div className="grid grid-cols-3 gap-2">
      {cards.map((c, i) => {
        const Icon = c.icon
        const isF = !!flipped[i]
        return (
          <button
            key={c.label}
            onClick={() => setFlipped(f => ({ ...f, [i]: !f[i] }))}
            className="relative h-[96px] text-left"
            style={{ perspective: '1000px' }}
            title="Toca para ver la descripción"
          >
            <div
              className="absolute inset-0 transition-transform duration-500"
              style={{ transformStyle: 'preserve-3d', transform: isF ? 'rotateY(180deg)' : 'rotateY(0deg)' }}
            >
              {/* Frente */}
              <div
                className="absolute inset-0 rounded-2xl border border-line bg-surface p-3 flex flex-col gap-2"
                style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}
              >
                <div className="flex items-start justify-between">
                  <div className={`w-7 h-7 rounded-lg ${c.bg} flex items-center justify-center shrink-0`}>
                    <Icon size={13} className={c.accent} />
                  </div>
                  <RotateCw size={11} className="text-mist" />
                </div>
                <div>
                  <div className={`font-display text-2xl font-bold leading-none ${c.accent}`}>{c.value}</div>
                  <div className="text-xs text-fog mt-1 leading-tight">{c.label}</div>
                </div>
              </div>
              {/* Reverso */}
              <div
                className="absolute inset-0 rounded-2xl border border-line bg-surface2 p-3 flex flex-col justify-center"
                style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
              >
                <p className={`text-xs font-semibold uppercase tracking-wide mb-1 ${c.accent}`}>{c.label}</p>
                <p className="text-xs text-fog leading-snug">{c.desc}</p>
              </div>
            </div>
          </button>
        )
      })}
    </div>
  )
}
