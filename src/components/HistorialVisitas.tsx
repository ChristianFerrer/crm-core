import { Clock, Users } from 'lucide-react'

export type VisitaHistorial = {
  id: string
  checked_in_at: string
  adults_count?: number | null
  children_count?: number | null
  children_present?: { id?: string; name: string; is_adult?: boolean }[] | null
  /** Nombre del adulto que registró la entrada; solo se pinta en la vista de familia */
  titular?: string | null
}

/**
 * Con quién vino. El check-in guarda los nombres en `children_present`, así que
 * se pueden nombrar: «con Martina y Pau» dice mucho más que «3 personas», y es
 * lo que permite reconocer a la familia en el mostrador.
 *
 * Cuando la visita es antigua y no se guardó el detalle, se cae a los contadores
 * —no se inventa ningún nombre.
 */
export function acompanantes(v: VisitaHistorial): string | null {
  const presentes = (v.children_present ?? []).filter(p => p.name?.trim())
  const ninos = presentes.filter(p => !p.is_adult).map(p => p.name.trim())
  const adultos = presentes.filter(p => p.is_adult).map(p => p.name.trim())

  const partes: string[] = []
  if (ninos.length) partes.push(ninos.join(', '))
  if (adultos.length) partes.push(adultos.join(', '))
  if (partes.length) return partes.join(' · ')

  const nA = v.adults_count ?? 0
  const nN = v.children_count ?? 0
  if (nA + nN === 0) return null
  const c: string[] = []
  if (nN > 0) c.push(`${nN} niñ${nN === 1 ? 'o' : 'os'}`)
  if (nA > 0) c.push(`${nA} adult${nA === 1 ? 'o' : 'os'}`)
  return c.join(' · ')
}

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
