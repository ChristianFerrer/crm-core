// Búsqueda de miembros unificada (nombre sin acentos + teléfono por dígitos).
// Fuente única usada por el listado de miembros, el histórico y los flujos de Inicio.

/** Normaliza texto: minúsculas y sin diacríticos (para comparar nombres). */
export function normalizeSearch(str: string): string {
  return str.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

/**
 * ¿El miembro coincide con la búsqueda? Casa por nombre (sin acentos) o,
 * si la consulta tiene dígitos, por teléfono comparando solo dígitos.
 */
export function memberMatchesQuery(
  query: string,
  member: { name?: string | null; phone?: string | null }
): boolean {
  const q = normalizeSearch(query.trim())
  if (!q) return false
  const name = normalizeSearch(member.name ?? '')
  const qDigits = q.replace(/\D/g, '')
  const phone = (member.phone ?? '').replace(/\D/g, '')
  return name.includes(q) || (qDigits.length > 0 && phone.includes(qDigits))
}
