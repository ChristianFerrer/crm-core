'use client'

import { TrendingUp, TrendingDown, Euro, Receipt, Repeat, RefreshCw, Clock, Users } from 'lucide-react'
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

function Card({
  icon: Icon, label, value, sub, foot, accent = 'text-fog',
}: {
  icon: React.ElementType
  label: string
  value: string
  sub?: React.ReactNode
  foot?: React.ReactNode
  accent?: string
}) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4 min-w-0">
      <div className="flex items-center gap-1.5 mb-2">
        <Icon size={13} className={accent} />
        <p className="text-[10px] font-semibold text-fog uppercase tracking-wide truncate">{label}</p>
      </div>
      <p className="font-display text-2xl font-bold text-snow leading-none tabular-nums">{value}</p>
      {sub && <div className="mt-1.5 flex items-center gap-2 flex-wrap">{sub}</div>}
      {foot && <p className="mt-1.5 text-[11px] text-mist leading-tight">{foot}</p>}
    </div>
  )
}

/** Aviso cuando el porcentaje se calcula sobre muy pocos casos. */
function Rate({ rate, base }: { rate: number; base: number }) {
  if (!isReliable(base)) {
    return <span className="text-[11px] text-mist">pocos datos ({base})</span>
  }
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
      <p className="text-[10px] font-semibold text-fog uppercase tracking-wide mb-2">Pulso del mes</p>
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-2.5">
        <Card
          icon={Euro}
          label="Ingresos"
          value={formatEur(d.ingresos)}
          accent="text-lime"
          sub={
            <>
              <span className="text-[11px] text-mist">vs. mes ant.</span>
              <Delta value={d.ingresosDeltaMes} />
            </>
          }
          foot={
            <>
              {formatEur(d.desglose.visitas)} entradas · {formatEur(d.desglose.consumos)} tienda
              <br />
              {formatEur(d.desglose.adelantos)} señales · {formatEur(d.desglose.bonos)} bonos
            </>
          }
        />

        <Card
          icon={Receipt}
          label="Ticket medio"
          value={`${d.ticketMedio.toFixed(2)}€`}
          sub={<span className="text-[11px] text-fog">{d.numVisitas} visitas</span>}
          foot={<>vs. año pasado <Delta value={d.ingresosDeltaAno} /></>}
        />

        <Card
          icon={Repeat}
          label="Repetición 30d"
          value={isReliable(d.repeticion.base) ? `${(d.repeticion.rate * 100).toFixed(0)}%` : '—'}
          accent="text-cyan-300"
          sub={<Rate rate={d.repeticion.rate} base={d.repeticion.base} />}
          foot="Familias nuevas que volvieron"
        />

        <Card
          icon={RefreshCw}
          label="Renueva bono"
          value={isReliable(d.renovacion.base) ? `${(d.renovacion.rate * 100).toFixed(0)}%` : '—'}
          accent="text-iris"
          sub={<Rate rate={d.renovacion.rate} base={d.renovacion.base} />}
          foot="Bonos agotados que se renovaron"
        />

        <Card
          icon={Clock}
          label="Pendiente de pago"
          value={formatEur(d.pendiente)}
          accent={d.pendiente > 0 ? 'text-amber' : 'text-mint'}
          foot="Reservas del mes sin cobrar"
        />

        <Card
          icon={Users}
          label="Familias activas"
          value={String(d.familiasActivas)}
          sub={
            d.enRiesgo > 0
              ? <span className="text-[11px] font-semibold text-amber">{d.enRiesgo} en riesgo</span>
              : <span className="text-[11px] text-mist">ninguna en riesgo</span>
          }
          foot="Han venido en los últimos 60 días"
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
