// Estado de bono unificado (umbrales y colores en un solo sitio).
// Usado por el listado de miembros y los flujos de Inicio.

export type BonoLike = {
  sessions_remaining: number | null
  expires_at?: string | null
  created_at?: string
  membership_types?: { name?: string | null } | null
}

/** Devuelve el bono vigente (el más reciente por created_at) de una lista. */
export function activeBono<T>(list: T[] | null | undefined): T | undefined {
  if (!list || list.length === 0) return undefined
  const ts = (x: T) => new Date((x as { created_at?: string }).created_at ?? 0).getTime()
  return [...list].sort((a, b) => ts(b) - ts(a))[0]
}

export type BonoStatus = {
  has: boolean
  unlimited: boolean
  sessions: number | null
  expired: boolean
  depleted: boolean   // agotado o caducado → inservible
  low: boolean        // pocas sesiones (≤2) y aún válido
  ok: boolean         // se puede usar
  color: 'rose' | 'amber' | 'mint' | 'iris' | 'fog'
  label: string       // etiqueta corta para chip/punto
}

/** Calcula el estado de un bono ya resuelto (usa activeBono para elegirlo). */
export function bonoStatus(bono: BonoLike | null | undefined): BonoStatus {
  if (!bono) return { has: false, unlimited: false, sessions: null, expired: false, depleted: true, low: false, ok: false, color: 'rose', label: 'Sin bono' }

  const unlimited = !!bono.membership_types?.name?.toLowerCase().includes('ilimitado')
  const s = bono.sessions_remaining
  const expired = bono.expires_at != null && new Date(bono.expires_at).getTime() < Date.now()
  const depleted = expired || s === 0

  if (unlimited && !expired) return { has: true, unlimited: true, sessions: null, expired: false, depleted: false, low: false, ok: true, color: 'iris', label: '∞' }
  if (expired) return { has: true, unlimited, sessions: s, expired: true, depleted: true, low: false, ok: false, color: 'rose', label: 'Caducado' }
  if (s === 0) return { has: true, unlimited, sessions: 0, expired: false, depleted: true, low: false, ok: false, color: 'rose', label: '0 ses.' }
  if (s != null && s <= 2) return { has: true, unlimited, sessions: s, expired: false, depleted: false, low: true, ok: true, color: 'amber', label: `${s} ses.` }
  if (s != null) return { has: true, unlimited, sessions: s, expired: false, depleted: false, low: false, ok: true, color: 'mint', label: `${s} ses.` }
  return { has: true, unlimited, sessions: s, expired: false, depleted: false, low: false, ok: true, color: 'fog', label: '-' }
}
