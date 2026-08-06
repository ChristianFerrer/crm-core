'use client'

import Link from 'next/link'
import { Zap, ChevronRight, CheckCircle2 } from 'lucide-react'
import type { ActionSuggestion } from '@/lib/campaigns'
import { formatEur } from '@/lib/metrics'

const ACCENT: Record<string, { text: string; border: string; bg: string }> = {
  lime:       { text: 'text-lime',      border: 'border-lime/40',      bg: 'bg-lime/10' },
  mint:       { text: 'text-mint',      border: 'border-mint/40',      bg: 'bg-mint/10' },
  'cyan-300': { text: 'text-cyan-300',  border: 'border-cyan-300/40',  bg: 'bg-cyan-300/10' },
  amber:      { text: 'text-amber',     border: 'border-amber/40',     bg: 'bg-amber/10' },
  rose:       { text: 'text-rose',      border: 'border-rose/40',      bg: 'bg-rose/10' },
  iris:       { text: 'text-iris',      border: 'border-iris/40',      bg: 'bg-iris/10' },
  grape:      { text: 'text-grape',     border: 'border-grape/40',     bg: 'bg-grape/10' },
}

function fechaCorta(iso: string): string {
  return new Date(iso).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
}

/**
 * «Esta semana»: como mucho tres acciones, ordenadas por euros en juego.
 * Cada una lleva su botón: de aquí se sale contactando, no anotando.
 *
 * La cadencia es semanal a propósito. Diaria se queda vacía casi siempre y se
 * deja de mirar; mensual llega tarde para un bono que caduca el viernes o para
 * una familia que acaba de romper su ritmo.
 */
export function ActionsSection({
  actions, contactadosEstaSemana, proximaRevision,
}: {
  actions: ActionSuggestion[]
  contactadosEstaSemana: number
  proximaRevision: string
}) {
  if (actions.length === 0) {
    return (
      <section className="rounded-2xl border border-line bg-surface p-4 flex items-start gap-3">
        <CheckCircle2 size={16} className="text-mint shrink-0 mt-0.5" />
        <div>
          <p className="text-sm text-fog">
            Semana cerrada: no queda nadie a quien escribir.
            {contactadosEstaSemana > 0 && ` Has contactado a ${contactadosEstaSemana} ${contactadosEstaSemana === 1 ? 'familia' : 'familias'}.`}
          </p>
          <p className="text-[11px] text-mist mt-0.5">
            Próxima revisión: {fechaCorta(proximaRevision)}
          </p>
        </div>
      </section>
    )
  }

  return (
    <section>
      <div className="flex items-baseline justify-between gap-3 mb-2">
        <p className="text-[10px] font-semibold text-fog uppercase tracking-wide flex items-center gap-1.5">
          <Zap size={12} className="text-amber" /> Campañas de esta semana
        </p>
        <p className="text-[11px] text-mist">
          {contactadosEstaSemana > 0
            ? `${contactadosEstaSemana} contactada${contactadosEstaSemana === 1 ? '' : 's'} · por dinero en juego`
            : 'Ordenado por dinero en juego'}
        </p>
      </div>

      {/* «Esta semana» es cuándo te toca revisarlo, no el plazo de cada campaña:
          un cumpleaños se prepara con 45 días y un bono caduca el viernes. */}
      <p className="text-[11px] text-mist -mt-1 mb-2">
        Lo que toca mover esta semana. Cada campaña lleva su propio plazo.
      </p>

      <div className="space-y-2">
        {actions.map(a => {
          const c = ACCENT[a.accent] ?? ACCENT.lime
          return (
            <Link
              key={a.plantilla}
              href={`/panel/campanas/${a.plantilla}`}
              className={`flex items-center gap-3 rounded-2xl border ${c.border} ${c.bg} px-4 py-3 hover:brightness-110 transition-all`}
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-snow truncate">{a.titulo}</p>
                <p className="text-[11px] text-fog truncate">
                  <span className={`font-semibold ${c.text}`}>{a.horizonte}</span> · {a.detalle}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className={`text-sm font-bold ${c.text} tabular-nums`}>~{formatEur(a.valor)}</p>
                <p className="text-[10px] text-mist">en juego</p>
              </div>
              <ChevronRight size={16} className="text-fog shrink-0" />
            </Link>
          )
        })}
      </div>
    </section>
  )
}
