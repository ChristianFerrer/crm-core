/**
 * Identidad de los menores.
 *
 * Los menores viven como jsonb dentro de `members.children`, así que dos
 * titulares de la misma familia guardan cada uno su copia del mismo niño.
 * Cada entrada lleva un `id` propio —compartido entre las copias de la misma
 * familia— para poder decir "este menor ya está en sala" sin depender del
 * nombre (dos Pau de familias distintas ya no colisionan).
 */
export type ChildRef = { id?: string; name: string; birth_date?: string }

/** Id nuevo para un menor recién añadido en un formulario. */
export function newChildId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  // Fallback para entornos sin WebCrypto (no debería darse en el navegador)
  return `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

/**
 * Clave con la que se compara un menor. Usa el id cuando existe y cae al
 * nombre para los registros antiguos que aún no lo tengan.
 */
export function childKey(c: ChildRef): string {
  return c.id ? `id:${c.id}` : `name:${c.name}`
}

/** Asegura que toda la lista tenga id, respetando los que ya lo traen. */
export function withChildIds<T extends ChildRef>(children: T[]): T[] {
  return children.map(c => (c.id ? c : { ...c, id: newChildId() }))
}
