'use client'

import { TrendingUp, TrendingDown, Euro, Info } from 'lucide-react'
import { formatEur } from '@/lib/metrics'

/**
 * Ingresos del mes.
 *
 * Vivían en el Resumen y se han traído aquí a propósito. El motivo no es de
 * diseño: esta cifra sale de sumar lo que se haya registrado en la aplicación,
 * y basta con un cumpleaños cobrado por Bizum sin anotar para que salga baja.
 * Una cifra de caja equivocada, todos los días y en la primera pantalla, no
 * cae sola: arrastra la credibilidad del resto del panel.
 *
 * Tendencias es una pantalla a la que se entra queriendo, así que aquí sí cabe
 * — con el aviso de qué incluye y qué no.
 */
export type Ingresos = {
  total: number
  deltaMes: number | null
  deltaAno: number | null
  desglose: { visitas: number; consumos: number; adelantos: number; bonos: number }
  ticketMedio: number
  numVisitas: number
  pendiente: number
}

function Delta({ value, label }: { value: number | null; label: string }) {
  if (value == null) return <span className="text-[11px] text-mist">{label}: sin base</span>
  const up = value >= 0
  const Icon = up ? TrendingUp : TrendingDown
  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-mist">
      {label}
      <span className={`inline-flex items-center gap-0.5 font-semibold ${up ? 'text-mint' : 'text-rose'}`}>
        <Icon size={11} />{Math.abs(value * 100).toFixed(0)}%
      </span>
    </span>
  )
}

export function IngresosDelMes({ data }: { data: Ingresos }) {
  const d = data
  return (
    <section className="rounded-2xl border border-line bg-surface p-4">
      <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
        <div className="flex items-center gap-2.5">
          <Euro size={16} className="text-lime" />
          <div>
            <p className="text-[10px] font-semibold text-fog uppercase tracking-wide">Ingresos del mes</p>
            <p className="font-display text-3xl font-bold text-snow leading-none mt-1 tabular-nums">
              {formatEur(d.total)}
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Delta value={d.deltaMes} label="vs. mes anterior" />
          <Delta value={d.deltaAno} label="vs. año pasado" />
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-3">
        {[
          { label: 'Entradas', value: d.desglose.visitas },
          { label: 'Tienda', value: d.desglose.consumos },
          { label: 'Señales', value: d.desglose.adelantos },
          { label: 'Bonos', value: d.desglose.bonos },
        ].map(x => (
          <div key={x.label} className="rounded-xl bg-surface2 px-3 py-2">
            <p className="text-[10px] text-mist uppercase tracking-wide">{x.label}</p>
            <p className="text-sm font-bold text-snow tabular-nums mt-0.5">{formatEur(x.value)}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-4 flex-wrap text-[11px] text-fog mb-3">
        <span>Ticket medio <span className="font-semibold text-snow">{d.ticketMedio.toFixed(2)} €</span> sobre {d.numVisitas} visitas</span>
        {d.pendiente > 0 && (
          <span>Pendiente de pago <span className="font-semibold text-amber">{formatEur(d.pendiente)}</span></span>
        )}
      </div>

      {/* El aviso no es letra pequeña por cumplir: es la diferencia entre una
          cifra útil y una que induce a error. */}
      <div className="flex items-start gap-2 rounded-xl border border-line bg-surface2 px-3 py-2.5">
        <Info size={13} className="text-mist shrink-0 mt-0.5" />
        <p className="text-[11px] text-mist leading-snug">
          Suma solo lo registrado en la aplicación: entradas cobradas aquí, consumos de tienda,
          señales de reserva y bonos vendidos. <span className="text-fog">Un cobro hecho por fuera
          —Bizum, efectivo sin marcar— no aparece</span>, así que esta cifra es un mínimo, no tu
          cierre de caja.
        </p>
      </div>
    </section>
  )
}
