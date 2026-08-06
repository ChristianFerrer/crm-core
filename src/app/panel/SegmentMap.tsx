'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  ChevronRight, MessageCircle, Phone, Crown, Heart, Sparkles, TrendingDown,
  Moon, UserPlus, Users,
} from 'lucide-react'
import { SEGMENTS, type MemberStat, type SegmentId } from '@/lib/segments'
import { formatEur } from '@/lib/metrics'
import { waLink, firstName } from '@/lib/campaigns'

/** El dominio guarda el nombre del icono; aquí se resuelve al componente. */
const ICONOS: Record<string, React.ElementType> = {
  Crown, Heart, Sparkles, TrendingDown, Moon, UserPlus,
}

const ACCENT: Record<string, { text: string; border: string; bg: string }> = {
  lime:       { text: 'text-lime',      border: 'border-lime/40',      bg: 'bg-lime/10' },
  mint:       { text: 'text-mint',      border: 'border-mint/40',      bg: 'bg-mint/10' },
  'cyan-300': { text: 'text-cyan-300',  border: 'border-cyan-300/40',  bg: 'bg-cyan-300/10' },
  amber:      { text: 'text-amber',     border: 'border-amber/40',     bg: 'bg-amber/10' },
  rose:       { text: 'text-rose',      border: 'border-rose/40',      bg: 'bg-rose/10' },
  iris:       { text: 'text-iris',      border: 'border-iris/40',      bg: 'bg-iris/10' },
}

function dias(n: number | null): string {
  if (n == null) return '—'
  const d = Math.round(n)
  return d === 0 ? 'hoy' : d === 1 ? 'ayer' : `hace ${d} d`
}

/**
 * Mapa de segmentos: seis grupos con su recuento y, al abrirlos, las familias
 * con su teléfono. El objetivo es que desde aquí se pueda actuar, no solo mirar.
 */
export function SegmentMap({ stats, avgLtv }: { stats: MemberStat[]; avgLtv: number }) {
  const [open, setOpen] = useState<SegmentId | null>(null)
  const total = stats.length || 1

  return (
    <section>
      <div className="flex items-baseline justify-between gap-3 mb-2">
        <p className="text-[10px] font-semibold text-fog uppercase tracking-wide">Tus clientes</p>
        <p className="text-[11px] text-mist">
          Valor medio por familia <span className="text-fog font-semibold">{formatEur(avgLtv)}</span>
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-2.5">
        {SEGMENTS.map(seg => {
          const list = stats.filter(s => s.segmento === seg.id)
          const a = ACCENT[seg.accent]
          const isOpen = open === seg.id
          const SegIcon = ICONOS[seg.icono] ?? Users
          return (
            <button
              key={seg.id}
              onClick={() => setOpen(isOpen ? null : seg.id)}
              aria-expanded={isOpen}
              className={`rounded-2xl border p-4 text-left transition-colors ${
                isOpen ? `${a.border} ${a.bg}` : 'border-line bg-surface hover:border-line2'
              }`}
            >
              <div className={`w-11 h-11 mb-2 rounded-xl flex items-center justify-center ${a.bg}`}>
                <SegIcon size={22} className={a.text} />
              </div>
              <p className={`text-[10px] font-semibold uppercase tracking-wide truncate ${a.text}`}>{seg.label}</p>
              <p className="font-display text-2xl font-bold text-snow leading-none mt-1.5 tabular-nums">{list.length}</p>
              <p className="text-[11px] text-mist mt-1">
                {((list.length / total) * 100).toFixed(0)}% · {seg.sub}
              </p>
            </button>
          )
        })}
      </div>

      {open && (() => {
        const seg = SEGMENTS.find(s => s.id === open)!
        const list = stats
          .filter(s => s.segmento === open)
          .sort((a, b) => b.ltv - a.ltv)
        const a = ACCENT[seg.accent]
        return (
          <div className={`mt-2.5 rounded-2xl border ${a.border} bg-surface overflow-hidden`}>
            <div className={`px-4 py-2.5 ${a.bg} flex items-center justify-between gap-3 flex-wrap`}>
              <p className={`text-xs font-semibold ${a.text} flex items-center gap-2`}>
                {(() => { const I = ICONOS[seg.icono] ?? Users; return <I size={16} /> })()}
                {seg.label} · {list.length}
              </p>
              <p className="text-[11px] text-fog">{seg.accion}</p>
            </div>

            {list.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-mist">Ninguna familia en este grupo.</p>
            ) : (
              <div className="max-h-[22rem] overflow-y-auto divide-y divide-line/60">
                {list.map(s => {
                  const wa = waLink(s.phone, `¡Hola ${firstName(s.name)}! `)
                  return (
                    <div key={s.memberId} className="flex items-center gap-3 px-4 py-2.5">
                      <Link href={`/miembros/${s.memberId}`} className="min-w-0 flex-1 group">
                        <p className="text-sm font-medium text-snow truncate group-hover:text-lime transition-colors">
                          {s.name}
                        </p>
                        <p className="text-[11px] text-mist truncate">
                          {s.visitas} visita{s.visitas !== 1 ? 's' : ''} · última {dias(s.diasDesdeUltima)}
                          {s.ritmoDias != null && ` · ritmo ${Math.round(s.ritmoDias)} d`}
                          {s.ltv > 0 && ` · ${formatEur(s.ltv)}`}
                        </p>
                      </Link>
                      {wa ? (
                        <a href={wa} target="_blank" rel="noopener noreferrer"
                          aria-label={`WhatsApp a ${s.name}`} title={`WhatsApp a ${s.name}`}
                          className="w-8 h-8 shrink-0 flex items-center justify-center rounded-lg border border-line bg-surface2 text-fog hover:text-lime transition-colors">
                          <MessageCircle size={14} />
                        </a>
                      ) : (
                        <span className="w-8 h-8 shrink-0 flex items-center justify-center text-mist" title="Sin teléfono">
                          <Phone size={14} />
                        </span>
                      )}
                      <Link href={`/miembros/${s.memberId}`}
                        className="w-8 h-8 shrink-0 flex items-center justify-center rounded-lg text-mist hover:text-snow transition-colors">
                        <ChevronRight size={15} />
                      </Link>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })()}
    </section>
  )
}
