'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  ChevronRight, MessageCircle, Phone, Crown, Heart, Sparkles, TrendingDown,
  Moon, UserPlus, Users, Trophy,
} from 'lucide-react'
import { SEGMENTS, type MemberStat, type SegmentId } from '@/lib/segments'
import { waLink, firstName, renderMessage } from '@/lib/campaigns'
import { SectionHeader } from './SectionHeader'

/** El dominio guarda el nombre del icono; aquí se resuelve al componente. */
const ICONOS: Record<string, React.ElementType> = {
  Crown, Heart, Sparkles, TrendingDown, Moon, UserPlus,
}

type Acento = {
  text: string; border: string; bg: string
  /** Fondo de cabecera y tinte de las filas al pasar por encima */
  head: string; hover: string; divide: string
  /**
   * Literal a propósito: Tailwind escanea el código fuente, así que una clase
   * compuesta en tiempo de ejecución (`group-hover:${x}`) nunca se genera.
   */
  nombreHover: string
}

const ACCENT: Record<string, Acento> = {
  lime:       { text: 'text-lime',     border: 'border-lime/40',     bg: 'bg-lime/10',     head: 'bg-lime/15',     hover: 'hover:bg-lime/5',     divide: 'divide-lime/15', nombreHover: 'group-hover:text-lime' },
  mint:       { text: 'text-mint',     border: 'border-mint/40',     bg: 'bg-mint/10',     head: 'bg-mint/15',     hover: 'hover:bg-mint/5',     divide: 'divide-mint/15', nombreHover: 'group-hover:text-mint' },
  'cyan-300': { text: 'text-cyan-300', border: 'border-cyan-300/40', bg: 'bg-cyan-300/10', head: 'bg-cyan-300/15', hover: 'hover:bg-cyan-300/5', divide: 'divide-cyan-300/15', nombreHover: 'group-hover:text-cyan-300' },
  amber:      { text: 'text-amber',    border: 'border-amber/40',    bg: 'bg-amber/10',    head: 'bg-amber/15',    hover: 'hover:bg-amber/5',    divide: 'divide-amber/15', nombreHover: 'group-hover:text-amber' },
  rose:       { text: 'text-rose',     border: 'border-rose/40',     bg: 'bg-rose/10',     head: 'bg-rose/15',     hover: 'hover:bg-rose/5',     divide: 'divide-rose/15', nombreHover: 'group-hover:text-rose' },
  iris:       { text: 'text-iris',     border: 'border-iris/40',     bg: 'bg-iris/10',     head: 'bg-iris/15',     hover: 'hover:bg-iris/5',     divide: 'divide-iris/15', nombreHover: 'group-hover:text-iris' },
}

function dias(n: number | null): string {
  if (n == null) return '—'
  const d = Math.round(n)
  return d === 0 ? 'hoy' : d === 1 ? 'ayer' : `hace ${d} d`
}

/**
 * Mapa de segmentos: seis grupos y, debajo, la lista de familias del que esté
 * seleccionado, con su teléfono. Se puede actuar desde aquí, no solo mirar.
 *
 * La lista está SIEMPRE visible y con alto fijo. Antes salía solo al pulsar un
 * grupo, así que la parte útil de la sección había que descubrirla; y al
 * aparecer y desaparecer empujaba el resto de la página, que es lo que hace que
 * acabes pulsando donde no querías.
 */
export function SegmentMap({
  stats, top,
}: {
  stats: MemberStat[]
  /** Ranking de quién más ha venido este mes; ver `topVisitantes` */
  top: { memberId: string; name: string; visitas: number }[]
}) {
  const [abierto, setAbierto] = useState<SegmentId>('campeones')
  const total = stats.length || 1

  const seg = SEGMENTS.find(s => s.id === abierto) ?? SEGMENTS[0]
  const a = ACCENT[seg.accent]
  const Icono = ICONOS[seg.icono] ?? Users
  // Ordenadas por visitas: sin cifras económicas, quien más viene es quien más
  // pesa, y además es una cifra que el CRM sí conoce con certeza.
  const lista = stats
    .filter(s => s.segmento === seg.id)
    .sort((x, y) => y.visitas - x.visitas)

  return (
    <section>
      <SectionHeader
        icon={Users}
        iconClass="text-iris"
        title="Tus clientes"
        right={
          <p className="text-[11px] text-mist">
            {stats.length} familia{stats.length === 1 ? '' : 's'}
          </p>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-2.5">
        {SEGMENTS.map(s => {
          const list = stats.filter(x => x.segmento === s.id)
          const ac = ACCENT[s.accent]
          const activo = abierto === s.id
          const SegIcon = ICONOS[s.icono] ?? Users
          return (
            <button
              key={s.id}
              onClick={() => setAbierto(s.id)}
              aria-pressed={activo}
              className={`rounded-2xl border p-3.5 text-left transition-colors ${
                activo ? `${ac.border} ${ac.bg}` : 'border-line bg-surface hover:border-line2'
              }`}
            >
              {/* Icono a la izquierda con el rótulo y la cifra al lado: en
                  vertical, la tarjeta crecía a lo alto y sobraba la mitad. */}
              <div className="flex items-center gap-2.5">
                <div className={`w-11 h-11 shrink-0 rounded-xl flex items-center justify-center ${ac.bg}`}>
                  <SegIcon size={22} className={ac.text} />
                </div>
                <div className="min-w-0">
                  <p className={`text-[10px] font-semibold uppercase tracking-wide truncate ${ac.text}`}>
                    {s.label}
                  </p>
                  <p className="font-display text-2xl font-bold text-snow leading-none mt-0.5 tabular-nums">
                    {list.length}
                  </p>
                </div>
              </div>
              <p className="text-[11px] text-mist mt-2 leading-snug">
                {((list.length / total) * 100).toFixed(0)}% · {s.sub}
              </p>
            </button>
          )
        })}
      </div>

      {/* Alto fijo: al cambiar de grupo la lista no crece ni encoge, así que
          nada de debajo se mueve bajo el cursor. */}
      <div className={`mt-2.5 rounded-2xl border ${a.border} bg-surface overflow-hidden flex flex-col h-[24rem] transition-colors`}>
        <div className={`px-4 py-2.5 ${a.head} flex items-center justify-between gap-3 flex-wrap shrink-0 transition-colors`}>
          <p className={`text-xs font-semibold ${a.text} flex items-center gap-2`}>
            <Icono size={16} />
            {seg.label} · {lista.length}
          </p>
          <p className={`text-[11px] ${a.text} opacity-80`}>{seg.accion}</p>
        </div>

        {lista.length === 0 ? (
          <div className="flex-1 flex items-center justify-center px-4">
            <p className="text-sm text-mist text-center">Ninguna familia en este grupo.</p>
          </div>
        ) : (
          <div className={`flex-1 overflow-y-auto min-h-0 divide-y ${a.divide}`}>
            {lista.map(s => {
              // El mensaje sale del segmento: a un campeón se le pide una
              // reseña y a un dormido se le ofrece volver, no el mismo hola.
              const wa = waLink(s.phone, renderMessage(seg.mensaje, { nombre: firstName(s.name) }))
              return (
                <div key={s.memberId} className={`flex items-center gap-3 px-4 py-2.5 transition-colors ${a.hover}`}>
                  <Link href={`/miembros/${s.memberId}`} className="min-w-0 flex-1 group">
                    <p className={`text-sm font-medium text-snow truncate transition-colors ${a.nombreHover}`}>
                      {s.name}
                    </p>
                    <p className="text-[11px] text-mist truncate">
                      {s.visitas} visita{s.visitas !== 1 ? 's' : ''} · última {dias(s.diasDesdeUltima)}
                      {s.ritmoDias != null && ` · ritmo ${Math.round(s.ritmoDias)} d`}
                      {/* Con dos adultos, a cuál se le escribe */}
                      {s.miembros.length > 1 && ` · escribir a ${firstName(s.titularNombre)}`}
                    </p>
                  </Link>
                  {wa ? (
                    <a href={wa} target="_blank" rel="noopener noreferrer"
                      aria-label={`WhatsApp a ${s.name}`} title={`WhatsApp a ${s.name}`}
                      className={`w-8 h-8 shrink-0 flex items-center justify-center rounded-lg border ${a.border} ${a.bg} ${a.text} hover:brightness-125 transition-all`}>
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

      {/* Ranking del mes. No es un segmento: «campeones» dice quién se comporta
          como cliente fiel, esto dice quién ha pisado más la ludoteca, que es
          lo que sirve para reconocerlas por su nombre en el mostrador. */}
      {top.length > 0 && (
        <div className="mt-2.5 rounded-2xl border border-line bg-surface p-4">
          <p className="text-[10px] font-semibold text-fog uppercase tracking-wide flex items-center gap-1.5 mb-2.5">
            <Trophy size={12} className="text-lime" /> Más activos · últimos 30 días
          </p>
          <div className="grid gap-1.5 sm:grid-cols-2 xl:grid-cols-3">
            {top.map((m, i) => (
              <Link
                key={m.memberId}
                href={`/miembros/${m.memberId}`}
                className="flex items-center gap-2.5 rounded-xl bg-surface2 px-3 py-2 hover:brightness-110 transition-all group"
              >
                <span className={`w-6 h-6 shrink-0 rounded-full flex items-center justify-center text-[11px] font-bold ${
                  i === 0 ? 'bg-lime text-carbon' : 'bg-line2 text-snow'
                }`}>
                  {i + 1}
                </span>
                <span className="flex-1 min-w-0 text-sm text-snow truncate group-hover:text-lime transition-colors">
                  {m.name}
                </span>
                <span className="shrink-0 text-xs font-semibold text-fog tabular-nums">
                  {m.visitas} vis.
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
