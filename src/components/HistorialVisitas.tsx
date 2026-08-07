import { Clock, Users } from 'lucide-react'
import { acompanantes, type VisitaHistorial } from '@/lib/visitas'

export type { VisitaHistorial }

export function HistorialVisitas({
  visitas, vacio, mostrarTitular = false,
}: {
  visitas: VisitaHistorial[]
  vacio: string
  /** En la ficha de familia importa quién trajo al niño; en la del miembro, no */
  mostrarTitular?: boolean
}) {
  if (visitas.length === 0) {
    return (
      <div className="rounded-2xl border border-line bg-surface p-4 text-center text-sm text-mist">
        {vacio}
      </div>
    )
  }

  return (
    <div className="space-y-1">
      {visitas.map(v => {
        const d = new Date(v.checked_in_at)
        const con = acompanantes(v)
        return (
          <div key={v.id} className="rounded-xl border border-line bg-surface px-4 py-2.5">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-sm text-fog truncate min-w-0">
                {d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })}
                {mostrarTitular && v.titular && (
                  <span className="text-snow font-medium"> · {v.titular}</span>
                )}
              </span>
              <span className="text-xs text-mist shrink-0 flex items-center gap-1 tabular-nums">
                <Clock size={11} />
                {d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            {con && (
              <p className="text-[11px] text-mist mt-1 flex items-center gap-1.5 min-w-0">
                <Users size={11} className="shrink-0" />
                <span className="truncate">con {con}</span>
              </p>
            )}
          </div>
        )
      })}
    </div>
  )
}
