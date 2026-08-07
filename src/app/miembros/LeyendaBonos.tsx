'use client'

import { useState } from 'react'
import { Info, RotateCcw } from 'lucide-react'

/**
 * Leyenda de los estados de bono del listado.
 *
 * Los colores de la columna «Estado» son un código que solo conoce quien montó
 * la pantalla: verde, ámbar y rosa no dicen por sí solos dónde está el corte.
 * Se gira para ver la explicación, con el mismo gesto que las tarjetas del
 * pulso, para no ocupar sitio permanente encima de la tabla.
 *
 * Los umbrales están en `lib/bonoStatus.ts`. Si cambian allí, hay que cambiar
 * también este texto: es el precio de explicarlo en palabras.
 */

type Criterio = {
  color: string
  chip: string
  titulo: string
  regla: string
  queHacer: string
}

const CRITERIOS: Criterio[] = [
  {
    color: 'bg-mint', chip: 'text-mint',
    titulo: 'Con bono',
    regla: 'Le quedan 3 sesiones o más y no ha caducado.',
    queHacer: 'Nada. Entra y se le descuenta una sesión.',
  },
  {
    color: 'bg-iris', chip: 'text-iris',
    titulo: 'Ilimitado',
    regla: 'Bono mensual sin límite de sesiones, en vigor.',
    queHacer: 'Entra sin descontar nada hasta que caduque.',
  },
  {
    color: 'bg-amber', chip: 'text-amber',
    titulo: 'Bono bajo',
    regla: 'Le quedan 1 o 2 sesiones.',
    queHacer: 'Ofrécele la renovación ahora, antes de que se agote.',
  },
  {
    color: 'bg-rose', chip: 'text-rose',
    titulo: 'Agotado o caducado',
    regla: 'Cero sesiones, o la fecha de validez ya pasó.',
    queHacer: 'Hoy paga entrada suelta. Es el mejor momento para renovar.',
  },
  {
    color: 'bg-fog', chip: 'text-fog',
    titulo: 'Sin bono',
    regla: 'Nunca ha tenido bono o no le queda ninguno registrado.',
    queHacer: 'Si viene a menudo, proponle uno: le sale más barato.',
  },
]

export function LeyendaBonos() {
  const [girada, setGirada] = useState(false)

  return (
    <div className="flip-card" data-flipped={girada}>
      <div className="flip-inner">
        {/* Frente: el código de color, compacto */}
        <button
          onClick={() => setGirada(true)}
          aria-hidden={girada}
          tabIndex={girada ? -1 : 0}
          aria-label="Ver qué significa cada estado de bono"
          className="flip-face w-full rounded-2xl border border-line bg-surface px-4 py-3 text-left hover:border-line2 transition-colors"
        >
          <div className="flex items-center gap-2 mb-2">
            <p className="text-[10px] font-semibold text-fog uppercase tracking-wide flex-1">
              Estados de bono
            </p>
            <Info size={12} className="text-mist shrink-0" />
          </div>
          <div className="flex items-center gap-x-4 gap-y-1.5 flex-wrap">
            {CRITERIOS.map(c => (
              <span key={c.titulo} className="flex items-center gap-1.5 text-[11px] text-fog">
                <span className={`w-2 h-2 rounded-full shrink-0 ${c.color}`} />
                {c.titulo}
              </span>
            ))}
          </div>
        </button>

        {/* Dorso: qué mide cada uno y qué hacer */}
        <button
          onClick={() => setGirada(false)}
          aria-hidden={!girada}
          tabIndex={girada ? 0 : -1}
          aria-label="Volver a la leyenda"
          className="flip-face flip-face--back w-full rounded-2xl border border-line2 bg-surface2 px-4 py-3 text-left"
        >
          <div className="flex items-center gap-2 mb-2">
            <p className="text-[10px] font-semibold text-fog uppercase tracking-wide flex-1">
              Qué significa cada estado
            </p>
            <RotateCcw size={11} className="text-mist shrink-0" />
          </div>
          <div className="grid gap-1.5 sm:grid-cols-2 xl:grid-cols-3">
            {CRITERIOS.map(c => (
              <div key={c.titulo} className="flex items-start gap-2">
                <span className={`w-2 h-2 rounded-full shrink-0 mt-1.5 ${c.color}`} />
                <p className="text-[11px] leading-snug min-w-0">
                  <span className={`font-semibold ${c.chip}`}>{c.titulo}</span>
                  <span className="text-fog"> · {c.regla}</span>
                  <span className="text-mist block">{c.queHacer}</span>
                </p>
              </div>
            ))}
          </div>
        </button>
      </div>
    </div>
  )
}
