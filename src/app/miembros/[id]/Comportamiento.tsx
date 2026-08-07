'use client'

import { useState } from 'react'
import { CalendarCheck, Timer, Clock, CalendarHeart, Info } from 'lucide-react'
import type { MemberStat } from '@/lib/segments'

/**
 * Comportamiento de la familia, en cuatro tarjetas que se giran.
 *
 * Las cuatro cifras necesitan explicación: «ritmo 4 d» no dice si eso es bueno,
 * y «valor 82 €» no dice si es lo gastado o lo previsto. Antes eran cuatro
 * números sueltos dentro de una caja, sin forma de preguntar qué significaban.
 * Mismo gesto que las tarjetas del pulso del resumen.
 */

type Tarjeta = {
  icon: React.ElementType
  label: string
  value: string
  accent: string
  desc: string
}

export function Comportamiento({
  stat, segmento, accion, segClass,
}: {
  stat: MemberStat
  segmento: string
  /** Qué hacer con este grupo; viene de la definición del segmento */
  accion: string
  segClass: string
}) {
  const ritmo = stat.ritmoDias != null ? Math.round(stat.ritmoDias) : null
  const ultima = stat.diasDesdeUltima != null ? Math.round(stat.diasDesdeUltima) : null

  const tarjetas: Tarjeta[] = [
    {
      icon: CalendarCheck,
      label: 'Visitas',
      value: String(stat.visitas),
      accent: 'text-fog',
      desc: 'Veces que esta familia ha entrado, desde su alta. Cuenta la visita, no cuántos niños vinieron en cada una.',
    },
    {
      icon: Timer,
      label: 'Ritmo',
      value: ritmo != null ? `${ritmo} d` : '—',
      accent: 'text-cyan-300',
      desc: ritmo != null
        ? `Suelen venir cada ${ritmo} días. Es la mediana entre visitas, no el promedio: una visita rara no la distorsiona. Hacen falta 3 visitas para calcularlo.`
        : 'Aún no hay suficientes visitas para saber cada cuánto vienen. Hacen falta 3.',
    },
    {
      icon: Clock,
      label: 'Última',
      value: ultima != null ? `${ultima} d` : '—',
      accent: ritmo != null && ultima != null && ultima > ritmo * 2 ? 'text-amber' : 'text-fog',
      desc: ritmo != null && ultima != null
        ? `Días desde la última visita. Pasado el doble de su ritmo (${ritmo * 2} días) se considera que lo ha roto y entra en «en riesgo».`
        : 'Días desde la última visita.',
    },
    {
      // Aquí estaba el valor de vida en euros. Salía de sumar los cobros
      // registrados en la aplicación, así que una familia que paga en efectivo
      // sin marcar aparecía como si no gastara nada — un juicio equivocado
      // sobre un cliente concreto es peor que no tener el dato.
      icon: CalendarHeart,
      label: 'Antigüedad',
      value: stat.mesesAntiguedad >= 12
        ? `${Math.floor(stat.mesesAntiguedad / 12)} a`
        : `${stat.mesesAntiguedad} m`,
      accent: 'text-lime',
      desc: `Tiempo desde el alta. ${
        stat.visitas > 0 && stat.mesesAntiguedad > 0
          ? `En ese tiempo han venido ${stat.visitas} ${stat.visitas === 1 ? 'vez' : 'veces'}, unas ${(stat.visitas / stat.mesesAntiguedad).toFixed(1)} al mes.`
          : 'Aún no han venido.'
      }`,
    },
  ]

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-2">
        <p className="text-[10px] font-semibold text-fog uppercase tracking-wide">Comportamiento</p>
        <span className={`text-xs font-semibold ${segClass}`}>{segmento}</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 items-stretch">
        {tarjetas.map(t => <TarjetaGiratoria key={t.label} {...t} />)}
      </div>

      <p className="text-[11px] text-mist mt-2">{accion}</p>
    </div>
  )
}

function TarjetaGiratoria({ icon: Icon, label, value, accent, desc }: Tarjeta) {
  const [girada, setGirada] = useState(false)

  return (
    <div className="flip-card h-full" data-flipped={girada}>
      <div className="flip-inner">
        <button
          onClick={() => setGirada(true)}
          aria-hidden={girada}
          tabIndex={girada ? -1 : 0}
          aria-label={`${label}: ${value}. Ver explicación`}
          className="flip-face w-full h-full flex flex-col rounded-2xl border border-line bg-surface p-3.5 text-left hover:border-line2 transition-colors"
        >
          <div className="flex items-center gap-1.5 mb-1.5">
            <Icon size={12} className={accent} />
            <p className="text-[10px] font-semibold text-mist uppercase tracking-wide truncate flex-1">{label}</p>
            <Info size={10} className="text-mist shrink-0" />
          </div>
          <p className={`text-lg font-bold tabular-nums leading-none ${accent === 'text-fog' ? 'text-snow' : accent}`}>
            {value}
          </p>
        </button>

        <button
          onClick={() => setGirada(false)}
          aria-hidden={!girada}
          tabIndex={girada ? 0 : -1}
          aria-label={`${label}. Volver a la cifra`}
          className="flip-face flip-face--back w-full h-full rounded-2xl border border-line2 bg-surface2 p-3.5 text-left"
        >
          <p className={`text-[10px] font-semibold uppercase tracking-wide mb-1 ${accent}`}>{label}</p>
          <p className="text-[11px] text-fog leading-snug">{desc}</p>
        </button>
      </div>
    </div>
  )
}
