/**
 * Segmentación de clientes (Fase 2).
 *
 * La idea central: la frecuencia "normal" no la fija el negocio, la fija cada
 * familia. Una que viene tres veces por semana lleva 10 días sin aparecer y es
 * una alarma; otra que viene una vez al mes, no. Por eso el riesgo se mide
 * contra el RITMO PROPIO (mediana de días entre visitas), no contra un umbral
 * fijo igual para todos.
 */

export type SegmentId =
  | 'campeones'
  | 'fieles'
  | 'prometedores'
  | 'en_riesgo'
  | 'dormidos'
  | 'nuevos_sin_repetir'

export type MemberStat = {
  memberId: string
  name: string
  phone: string | null
  familyName: string | null
  primeraVisita: string | null
  ultimaVisita: string | null
  visitas: number
  /** Mediana de días entre visitas; null si aún no hay suficientes */
  ritmoDias: number | null
  diasDesdeUltima: number | null
  gastoTotal: number
  ticketMedio: number
  /** Meses desde el alta, mínimo 1, para poder proyectar el valor */
  mesesAntiguedad: number
  ltv: number
  segmento: SegmentId
}

export type SegmentDef = {
  id: SegmentId
  label: string
  sub: string
  accent: 'lime' | 'iris' | 'cyan-300' | 'amber' | 'rose' | 'mint'
  /** Qué hacer con este grupo — la razón de que el segmento exista */
  accion: string
  /**
   * Nombre del icono de lucide-react. Como texto y no como componente: este
   * módulo es dominio puro y no debe importar React.
   */
  icono: string
}

export const SEGMENTS: SegmentDef[] = [
  { id: 'campeones',          label: 'Campeones',      sub: 'vienen mucho y gastan', accent: 'lime',     accion: 'Pídeles reseñas y referidos',           icono: 'Crown' },
  { id: 'fieles',             label: 'Fieles',         sub: 'ritmo estable',         accent: 'mint',     accion: 'Sube el ticket: bono mayor o consumos', icono: 'Heart' },
  { id: 'prometedores',       label: 'Prometedores',   sub: 'nuevos que repiten',    accent: 'cyan-300', accion: 'Conviértelos a bono',                   icono: 'Sparkles' },
  { id: 'en_riesgo',          label: 'En riesgo',      sub: 'rompieron su ritmo',    accent: 'amber',    accion: 'Reactiva con un incentivo pequeño',     icono: 'TrendingDown' },
  { id: 'dormidos',           label: 'Dormidos',       sub: '+90 días sin venir',    accent: 'rose',     accion: 'Campaña de vuelta con oferta fuerte',   icono: 'Moon' },
  { id: 'nuevos_sin_repetir', label: 'Sin repetir',    sub: '1 visita, +21 días',    accent: 'iris',     accion: 'Lo más rentable: ya te conocen',        icono: 'UserPlus' },
]

export type VisitInput = {
  member_id: string | null
  checked_in_at: string
  paid_amount: number | null
}

export type MemberInput = {
  id: string
  name: string
  phone: string | null
  created_at: string
  families?: { name: string } | null
}

const DAY = 86_400_000

function median(nums: number[]): number | null {
  if (nums.length === 0) return null
  const s = [...nums].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

/**
 * Ritmo del establecimiento: se usa como referencia para las familias que aún
 * no tienen suficientes visitas como para tener ritmo propio.
 */
export function ritmoGlobal(stats: { ritmoDias: number | null }[]): number {
  const ritmos = stats.map(s => s.ritmoDias).filter((n): n is number => n != null)
  return median(ritmos) ?? 14
}

export type SegmentRefs = {
  /** Mediana de los ritmos del establecimiento */
  ritmo: number
  /** Mediana del valor de vida entre familias con visitas; 0 si no hay base */
  ltv: number
}

/** Un campeón viene más a menudo que la mitad y gasta más que la mitad. */
const CAMPEON_RITMO_MAX = 12
const CAMPEON_VISITAS_MIN = 6

function classify(s: Omit<MemberStat, 'segmento'>, refs: SegmentRefs): SegmentId {
  const dias = s.diasDesdeUltima
  const ritmo = s.ritmoDias ?? refs.ritmo

  if (s.visitas === 0 || dias == null) return 'nuevos_sin_repetir'

  // Perdidos primero: nada de lo demás importa si hace meses que no vienen
  if (dias > 90) return 'dormidos'
  if (s.visitas === 1) return dias > 21 ? 'nuevos_sin_repetir' : 'prometedores'
  if (dias > ritmo * 2) return 'en_riesgo'

  // Activos. El corte campeón/fiel es RELATIVO al resto de familias, no un
  // número inventado: viene más seguido que la mediana y gasta más que ella.
  const vieneMucho = ritmo <= Math.min(refs.ritmo, CAMPEON_RITMO_MAX) && s.visitas >= CAMPEON_VISITAS_MIN
  const gastaMas = refs.ltv <= 0 || s.ltv >= refs.ltv
  if (vieneMucho && gastaMas) return 'campeones'

  if (s.mesesAntiguedad <= 2) return 'prometedores'
  return 'fieles'
}

/** Estadísticas y segmento de cada familia a partir de sus visitas. */
export function buildMemberStats(members: MemberInput[], visits: VisitInput[], now = new Date()): MemberStat[] {
  const byMember = new Map<string, VisitInput[]>()
  for (const v of visits) {
    if (!v.member_id) continue
    const list = byMember.get(v.member_id) ?? []
    list.push(v)
    byMember.set(v.member_id, list)
  }

  const partial = members.map(m => {
    const vs = (byMember.get(m.id) ?? []).sort(
      (a, b) => +new Date(a.checked_in_at) - +new Date(b.checked_in_at)
    )
    const times = vs.map(v => +new Date(v.checked_in_at))
    const gaps: number[] = []
    for (let i = 1; i < times.length; i++) gaps.push((times[i] - times[i - 1]) / DAY)

    const gastoTotal = vs.reduce((s, v) => s + Number(v.paid_amount ?? 0), 0)
    const alta = +new Date(m.created_at)
    const mesesAntiguedad = Math.max(1, Math.round((now.getTime() - alta) / (30 * DAY)))

    return {
      memberId: m.id,
      name: m.name,
      phone: m.phone,
      familyName: m.families?.name ?? null,
      primeraVisita: times.length ? new Date(times[0]).toISOString() : null,
      ultimaVisita: times.length ? new Date(times[times.length - 1]).toISOString() : null,
      visitas: vs.length,
      // Hacen falta 3 visitas (2 intervalos) para que la mediana signifique algo
      ritmoDias: gaps.length >= 2 ? median(gaps) : null,
      diasDesdeUltima: times.length ? (now.getTime() - times[times.length - 1]) / DAY : null,
      gastoTotal,
      ticketMedio: vs.length ? gastoTotal / vs.length : 0,
      mesesAntiguedad,
      ltv: gastoTotal,
    }
  })

  const activos = partial.filter(s => s.visitas > 0)
  const refs: SegmentRefs = {
    ritmo: ritmoGlobal(partial),
    ltv: median(activos.map(s => s.ltv)) ?? 0,
  }
  return partial.map(s => ({ ...s, segmento: classify(s, refs) }))
}

export function countBySegment(stats: MemberStat[]): Record<SegmentId, number> {
  const out = {
    campeones: 0, fieles: 0, prometedores: 0,
    en_riesgo: 0, dormidos: 0, nuevos_sin_repetir: 0,
  } as Record<SegmentId, number>
  for (const s of stats) out[s.segmento]++
  return out
}

/** Valor medio de vida por familia con al menos una visita. */
export function avgLtv(stats: MemberStat[]): number {
  const activos = stats.filter(s => s.visitas > 0)
  if (activos.length === 0) return 0
  return activos.reduce((s, x) => s + x.ltv, 0) / activos.length
}
