'use client'

import { useState } from 'react'
import {
  TrendingUp, TrendingDown, Users, Baby, Repeat, RefreshCw, Clock, UsersRound,
  Info, Activity,
} from 'lucide-react'
import { isReliable, MIN_SAMPLE } from '@/lib/metrics'
import { SectionHeader } from './SectionHeader'

/**
 * Pulso del mes: conducta y ocupación, sin una sola cifra económica.
 *
 * Los ingresos vivían aquí y se han movido a Tendencias. El motivo no es de
 * diseño: el importe del panel sale de sumar lo que se haya registrado en la
 * aplicación, y basta con un cumpleaños cobrado por Bizum sin anotar para que
 * la cifra salga baja. Una cifra de caja equivocada, todos los días y en la
 * primera pantalla, no cae sola: arrastra la credibilidad de todo lo demás.
 *
 * Además compite con el cierre de mes del gestor, que ya lo tiene y lo tiene
 * bien. Lo que sí sabe el CRM con certeza —quién entró y cuándo, quién repite,
 * quién renueva— no lo tiene nadie más. Eso es lo que se muestra.
 */
export type PulseData = {
  visitas: number
  visitasDeltaMes: number | null
  familias: number
  ninos: number
  porVisita: number
  familiasActivas: number
  enRiesgo: number
  repeticion: { rate: number; base: number }
  renovacion: { rate: number; base: number }
  /** Franja de más ocupación del mes; null si aún no hay muestra */
  punta: { dia: string; hora: number; personas: number; pct: number } | null
}

function Delta({ value }: { value: number | null }) {
  if (value == null) return <span className="text-[11px] text-mist">sin base</span>
  const up = value >= 0
  const Icon = up ? TrendingUp : TrendingDown
  return (
    <span className={`inline-flex items-center gap-0.5 text-[11px] font-semibold ${up ? 'text-mint' : 'text-rose'}`}>
      <Icon size={11} />{Math.abs(value * 100).toFixed(0)}%
    </span>
  )
}

/**
 * Tarjeta con dos caras: delante la cifra, detrás qué significa y de dónde
 * sale. Se voltea al pulsar, así la explicación está a mano sin ocupar sitio.
 *
 * El alto sale de la cara más alta (ver `.flip-inner` en globals.css). Las
 * tarjetas de una misma fila se igualan solas porque la rejilla las estira.
 */
function FlipCard({
  icon: Icon, label, value, sub, foot, accent = 'text-fog', desc,
}: {
  icon: React.ElementType
  label: string
  value: string
  sub?: React.ReactNode
  foot?: React.ReactNode
  accent?: string
  desc: string
}) {
  const [flipped, setFlipped] = useState(false)
  return (
    <div className="flip-card h-full" data-flipped={flipped}>
      <div className="flip-inner">
        {/* Frente */}
        <button
          onClick={() => setFlipped(true)}
          aria-hidden={flipped}
          tabIndex={flipped ? -1 : 0}
          aria-label={`${label}: ${value}. Ver explicación`}
          className="flip-face w-full h-full flex flex-col rounded-2xl border border-line bg-surface p-4 text-left hover:border-line2 transition-colors"
        >
          <div className="flex items-center gap-1.5 mb-2">
            <Icon size={13} className={accent} />
            <p className="text-[10px] font-semibold text-fog uppercase tracking-wide truncate flex-1">{label}</p>
            <Info size={11} className="text-mist shrink-0" />
          </div>
          <p className="font-display text-2xl font-bold text-snow leading-none tabular-nums">{value}</p>
          {/* Alto mínimo reservado aunque no haya subtítulo: así la cifra y el
              pie quedan a la misma altura en las seis tarjetas. */}
          <div className="mt-1.5 min-h-[18px] flex items-center gap-2 flex-wrap">{sub}</div>
          <p className="mt-auto pt-1.5 text-[11px] text-mist leading-tight">{foot}</p>
        </button>

        {/* Dorso */}
        <button
          onClick={() => setFlipped(false)}
          aria-hidden={!flipped}
          tabIndex={flipped ? 0 : -1}
          aria-label={`${label}. Volver a la cifra`}
          className="flip-face flip-face--back w-full h-full rounded-2xl border border-line2 bg-surface2 p-4 text-left"
        >
          <p className={`text-[10px] font-semibold uppercase tracking-wide mb-1.5 ${accent}`}>{label}</p>
          <p className="text-[11px] text-fog leading-snug">{desc}</p>
        </button>
      </div>
    </div>
  )
}

function Rate({ base }: { base: number }) {
  if (!isReliable(base)) return <span className="text-[11px] text-mist">pocos datos ({base})</span>
  return <span className="text-[11px] text-fog">sobre {base} casos</span>
}

export function PulseSection({ data }: { data: PulseData }) {
  const d = data
  return (
    <section>
      <SectionHeader
        icon={Activity}
        iconClass="text-lime"
        title="Pulso del mes"
        right={<p className="text-[11px] text-mist">Toca una tarjeta para ver qué mide</p>}
      />

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-2.5 items-stretch">
        <FlipCard
          icon={Activity}
          label="Visitas"
          value={String(d.visitas)}
          accent="text-lime"
          sub={<><span className="text-[11px] text-mist">vs. mes ant.</span><Delta value={d.visitasDeltaMes} /></>}
          foot={<>{d.familias} familias distintas</>}
          desc="Entradas registradas este mes. Es la cifra más fiable del panel: una visita queda registrada siempre, porque es la que abre la puerta. Se compara con el mismo tramo del mes anterior."
        />

        <FlipCard
          icon={Baby}
          label="Niños atendidos"
          value={String(d.ninos)}
          accent="text-grape"
          sub={<span className="text-[11px] text-fog">{d.porVisita.toFixed(1)} personas por visita</span>}
          foot="Suma de niños de cada entrada"
          desc="Cuántos niños han pasado por la sala este mes, sumando los de cada entrada. Un mismo niño que viene cuatro veces cuenta cuatro: mide carga de trabajo y de aforo, no clientes distintos."
        />

        <FlipCard
          icon={Repeat}
          label="Repetición 30d"
          value={isReliable(d.repeticion.base) ? `${(d.repeticion.rate * 100).toFixed(0)}%` : '—'}
          accent="text-cyan-300"
          sub={<Rate base={d.repeticion.base} />}
          foot="Familias nuevas que volvieron"
          desc="De las familias que vinieron por primera vez, cuántas volvieron en los 30 días siguientes. Es el mejor indicador de si la experiencia gusta: si cae, el problema está dentro, no en la captación."
        />

        <FlipCard
          icon={RefreshCw}
          label="Renueva bono"
          value={isReliable(d.renovacion.base) ? `${(d.renovacion.rate * 100).toFixed(0)}%` : '—'}
          accent="text-iris"
          sub={<Rate base={d.renovacion.base} />}
          foot="Bonos agotados que se renovaron"
          desc="De los bonos que se agotaron o caducaron, cuántos titulares contrataron otro en el mes siguiente. Mide la retención de quien ya se comprometió, que es la que sostiene la ocupación."
        />

        <FlipCard
          icon={Clock}
          label="Franja punta"
          value={d.punta ? `${d.punta.hora}h` : '—'}
          accent="text-amber"
          sub={d.punta
            ? <span className="text-[11px] text-fog">{d.punta.dia} · {d.punta.personas.toFixed(0)} personas</span>
            : <span className="text-[11px] text-mist">sin muestra</span>}
          foot={d.punta && d.punta.pct > 0 ? `${(d.punta.pct * 100).toFixed(0)}% del aforo` : 'Momento de más ocupación'}
          desc="El día y la hora con más gente en sala de media este mes. Sirve para dos cosas: saber cuándo hace falta más personal, y saber qué franjas están vacías para llenarlas con una oferta."
        />

        <FlipCard
          icon={Users}
          label="Familias activas"
          value={String(d.familiasActivas)}
          accent="text-mint"
          sub={d.enRiesgo > 0
            ? <span className="text-[11px] font-semibold text-amber">{d.enRiesgo} en riesgo</span>
            : <span className="text-[11px] text-mist">ninguna en riesgo</span>}
          foot="Han venido en los últimos 60 días"
          desc="Familias que han venido en los últimos 60 días. «En riesgo» son las que llevan sin aparecer más del doble de su ritmo habitual: para una que viene cada semana, dos semanas; para una mensual, dos meses."
        />
      </div>

      {(!isReliable(d.repeticion.base) || !isReliable(d.renovacion.base)) && (
        <p className="mt-2 text-[11px] text-mist">
          Los porcentajes calculados sobre menos de {MIN_SAMPLE} casos no se muestran: con tan pocos
          datos oscilan demasiado como para decidir con ellos.
        </p>
      )}
    </section>
  )
}
