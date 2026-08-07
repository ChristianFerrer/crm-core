/**
 * Lectura de una visita. Dominio puro: sin React, para poder comprobarlo con
 * `npm run test:dominio`.
 */

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
 * Con quién vino, con nombre y apellido siempre que se sepa.
 *
 * El check-in guarda en `children_present` a quien está identificado: los hijos
 * marcados y los co-titulares de la casa (la pareja). Los contadores
 * `adults_count` / `children_count` incluyen ADEMÁS al titular y a los invitados
 * que entraron sin nombre. La resta entre ambos es, exactamente, el número de
 * invitados anónimos:
 *
 *   invitados adultos = adults_count − 1 (el titular) − adultos con nombre
 *   invitados niños   = children_count − niños con nombre
 *
 * Así, «Martina · +2 invitados (1 adulto, 1 niño)» dice quién vino sin inventar
 * a nadie, que es lo que se necesita para reconocer a la familia en el mostrador.
 */
export function acompanantes(v: VisitaHistorial): string | null {
  const presentes = (v.children_present ?? []).filter(p => p.name?.trim())
  const ninos = presentes.filter(p => !p.is_adult).map(p => p.name.trim())
  const adultos = presentes.filter(p => p.is_adult).map(p => p.name.trim())

  // El titular ya es de quien es la ficha, así que no cuenta como acompañante.
  const invA = Math.max(0, (v.adults_count ?? 0) - 1 - adultos.length)
  const invN = Math.max(0, (v.children_count ?? 0) - ninos.length)

  const partes: string[] = []
  // Primero los hijos: es lo que se busca al mirar el historial.
  if (ninos.length) partes.push(ninos.join(', '))
  if (adultos.length) partes.push(adultos.join(', '))

  if (invA + invN > 0) {
    const detalle: string[] = []
    if (invA > 0) detalle.push(`${invA} adulto${invA === 1 ? '' : 's'}`)
    if (invN > 0) detalle.push(`${invN} niño${invN === 1 ? '' : 's'}`)
    const total = invA + invN
    partes.push(`${total} invitado${total === 1 ? '' : 's'} (${detalle.join(', ')})`)
  }

  return partes.length ? partes.join(' · ') : null
}

