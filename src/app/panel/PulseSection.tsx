'use client'

import { useState } from 'react'
import { TrendingUp, TrendingDown, Euro, Receipt, Repeat, RefreshCw, Clock, Users, Info } from 'lucide-react'
import { formatEur, isReliable, MIN_SAMPLE } from '@/lib/metrics'

export type PulseData = {
  ingresos: number
  ingresosDeltaMes: number | null
  ingresosDeltaAno: number | null
  desglose: { visitas: number; consumos: number; adelantos: number; bonos: number }
  ticketMedio: number
  numVisitas: number
  repeticion: { rate: number; base: number }
  renovacion: { rate: number; base: number }
  pendiente: number
  familiasActivas: number
  enRiesgo: number
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
    <div className="flip-card" data-flipped={flipped}>
      <div className="flip-inner">
        {/* Frente */}
        <button
          onClick={() => setFlipped(true)}
          aria-hidden={flipped}
          tabIndex={flipped ? -1 : 0}
          aria-label={`${label}: ${value}. Ver explicación`}
          className="flip-face w-full rounded-2xl border border-line bg-surface p-4 text-left hover:border-line2 transition-colors"
        >
          <div className="flex items-center gap-1.5 mb-2">
            <Icon size={13} className={accent} />
            <p className="text-[10px] font-semibold text-fog uppercase tracking-wide truncate flex-1">{label}</p>
            <Info size={11} className="text-mist shrink-0" />
          </div>
          <p className="font-display text-2xl font-bold text-snow leading-none tabular-nums">{value}</p>
          {sub && <div className="mt-1.5 flex items-center gap-2 flex-wrap">{sub}</div>}
          {foot && <p className="mt-1.5 text-[11px] text-mist leading-tight">{foot}</p>}
        </button>

        {/* Dorso */}
        <button
          onClick={() => setFlipped(false)}
          aria-hidden={!flipped}
          tabIndex={flipped ? 0 : -1}
          aria-label={`${label}. Volver a la cifra`}
          className="flip-face flip-face--back w-full rounded-2xl border border-line2 bg-surface2 p-4 text-left"
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

/**
 * Pulso del mes: las seis cifras con las que se decide. Cada una lleva su
 * comparación o su base, porque un número suelto no informa.
 */
export function PulseSection({ data }: { data: PulseData }) {
  const d = data
  return (
    <section>
      <div className="flex items-baseline justify-between gap-3 mb-2">
        <p className="text-[10px] font-semibold text-fog uppercase tracking-wide">Pulso del mes</p>
        <p className="text-[11px] text-mist">Toca una tarjeta para ver qué mide</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-2.5">
        <FlipCard
          icon={Euro}
          label="Ingresos"
          value={formatEur(d.ingresos)}
          accent="text-lime"
          sub={<><span className="text-[11px] text-mist">vs. mes ant.</span><Delta value={d.ingresosDeltaMes} /></>}
          foot={<>{formatEur(d.desglose.visitas)} entradas · {formatEur(d.desglose.consumos)} tienda<br />{formatEur(d.desglose.adelantos)} señales · {formatEur(d.desglose.bonos)} bonos</>}
          desc="Todo lo cobrado este mes: entradas y tarifas de sala, consumos de la tienda, señales de reserva y bonos vendidos. Se compara con el mes anterior para ver si vas mejor o peor."
        />

        <FlipCard
          icon={Receipt}
          label="Ticket medio"
          value={`${d.ticketMedio.toFixed(2)}€`}
          sub={<span className="text-[11px] text-fog">{d.numVisitas} visitas</span>}
          foot={<>vs. año pasado <Delta value={d.ingresosDeltaAno} /></>}
          desc="Cuánto deja de media cada visita. Si sube, estás vendiendo más por familia; si baja con las mismas visitas, se está gastando menos en tienda o en extras. La comparación con el año pasado descuenta la estacionalidad."
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
          desc="De los bonos que se agotaron o caducaron, cuántos titulares compraron otro en el mes siguiente. Mide la retención en dinero, no en visitas: es la cifra que sostiene los ingresos recurrentes."
        />

        <FlipCard
          icon={Clock}
          label="Pendiente de pago"
          value={formatEur(d.pendiente)}
          accent={d.pendiente > 0 ? 'text-amber' : 'text-mint'}
          foot="Reservas del mes sin cobrar"
          desc="Dinero ya comprometido en reservas de este mes que todavía no ha entrado en caja: el total menos la señal. Cuanto más alto, más cobros pendientes de reclamar."
        />

        <FlipCard
          icon={Users}
          label="Familias activas"
          value={String(d.familiasActivas)}
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
