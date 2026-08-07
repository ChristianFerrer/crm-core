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

/**
 * Una fila = UN HOGAR, no un adulto.
 *
 * Laia y Pau García son matrimonio y comparten a Martina. Contándolos por
 * separado, el panel decía que Laia era «campeona» (43 visitas, la última hace
 * 5 días) y Pau «en riesgo» (24 visitas, la última hace 46) — siendo la misma
 * puerta. Peor: Pau salía en la campaña de reactivación, así que el sistema
 * proponía escribirle «hace 46 días que no os vemos» a un padre cuya hija había
 * estado el domingo.
 *
 * El cliente de una ludoteca es la casa. Se agrupa por `family_id`; quien no
 * está agrupado es su propio hogar.
 */
export type MemberStat = {
  /** Id del adulto con el que se contacta (el que tiene teléfono) */
  memberId: string
  /** `family_id` si está agrupado, o el propio id del miembro si no */
  hogarId: string
  /** Nombre de la familia, o del adulto si no está agrupado */
  name: string
  phone: string | null
  familyName: string | null
  /** Adultos de la casa. Uno solo cuando el alta no está agrupada. */
  miembros: { id: string; name: string }[]
  /** Nombre del adulto de contacto, para el saludo de los mensajes */
  titularNombre: string
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
  /**
   * Mensaje que se precarga en WhatsApp, con {nombre} como variable.
   *
   * Antes solo se mandaba el saludo, y eso no es un mensaje: obligaba a
   * escribirlo entero desde el móvil, que es justo el trabajo que el botón
   * decía ahorrar. Cada segmento pide una cosa distinta, así que el texto
   * sale de la acción del propio segmento.
   */
  mensaje: string
}

export const SEGMENTS: SegmentDef[] = [
  {
    id: 'campeones', label: 'Campeones', sub: 'vienen mucho y gastan', accent: 'lime',
    accion: 'Pídeles reseñas y referidos', icono: 'Crown',
    mensaje: '¡Hola {nombre}! Sois de la casa y se nota 😊 ¿Nos harías el favor de dejarnos una reseña? Nos ayuda muchísimo a que otras familias nos encuentren.',
  },
  {
    id: 'fieles', label: 'Fieles', sub: 'ritmo estable', accent: 'mint',
    accion: 'Sube el ticket: bono mayor o consumos', icono: 'Heart',
    mensaje: '¡Hola {nombre}! Como venís a menudo, con el bono grande cada visita os sale bastante más barata. ¿Te lo preparo para la próxima?',
  },
  {
    id: 'prometedores', label: 'Prometedores', sub: 'nuevos que repiten', accent: 'cyan-300',
    accion: 'Conviértelos a bono', icono: 'Sparkles',
    mensaje: '¡Hola {nombre}! Nos alegra mucho que hayáis repetido 😊 Si os va bien venir, con un bono cada entrada os sale más a cuenta. ¿Os lo explico?',
  },
  {
    id: 'en_riesgo', label: 'En riesgo', sub: 'rompieron su ritmo', accent: 'amber',
    accion: 'Reactiva con un incentivo pequeño', icono: 'TrendingDown',
    mensaje: '¡Hola {nombre}! Hace unos días que no os vemos y os echamos de menos. Esta semana tenemos hueco por las tardes, ¿os venís?',
  },
  {
    id: 'dormidos', label: 'Dormidos', sub: '+90 días sin venir', accent: 'rose',
    accion: 'Campaña de vuelta con oferta fuerte', icono: 'Moon',
    mensaje: '¡Hola {nombre}! Hace tiempo que no os vemos por aquí. Hemos cambiado unas cuantas cosas y nos encantaría enseñároslas: la próxima entrada os la invitamos.',
  },
  {
    id: 'nuevos_sin_repetir', label: 'Sin repetir', sub: '1 visita, +21 días', accent: 'iris',
    accion: 'Lo más rentable: ya te conocen', icono: 'UserPlus',
    mensaje: '¡Hola {nombre}! Nos alegró mucho teneros por aquí. Si os apetece repetir, os invitamos a un batido en la próxima visita 🥤',
  },
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
  /** Hogar al que pertenece. Null = adulto sin agrupar, que es su propio hogar. */
  family_id?: string | null
  families?: { name: string } | null
}

/**
 * A qué hogar pertenece cada adulto. Lo usan las campañas para no proponer dos
 * veces la misma casa, una por cada padre.
 */
export function hogaresPorMiembro(members: MemberInput[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (const m of members) out[m.id] = m.family_id ?? m.id
  return out
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

/** Estadísticas y segmento de cada HOGAR a partir de las visitas de sus adultos. */
export function buildMemberStats(members: MemberInput[], visits: VisitInput[], now = new Date()): MemberStat[] {
  const byMember = new Map<string, VisitInput[]>()
  for (const v of visits) {
    if (!v.member_id) continue
    const list = byMember.get(v.member_id) ?? []
    list.push(v)
    byMember.set(v.member_id, list)
  }

  // Adultos agrupados por hogar. Sin `family_id`, cada uno es su propio hogar.
  const hogares = new Map<string, MemberInput[]>()
  for (const m of members) {
    const id = m.family_id ?? m.id
    const list = hogares.get(id) ?? []
    list.push(m)
    hogares.set(id, list)
  }

  const partial = [...hogares.entries()].map(([hogarId, adultos]) => {
    // Se contacta a quien tenga teléfono; si ninguno lo tiene, al más antiguo.
    const orden = [...adultos].sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at))
    const titular = orden.find(m => m.phone) ?? orden[0]

    // Las visitas del hogar son las de TODOS sus adultos, juntas y ordenadas:
    // si los padres se turnan, el ritmo real solo se ve al unirlas.
    const vs = adultos
      .flatMap(m => byMember.get(m.id) ?? [])
      .sort((a, b) => +new Date(a.checked_in_at) - +new Date(b.checked_in_at))

    const times = vs.map(v => +new Date(v.checked_in_at))
    const gaps: number[] = []
    for (let i = 1; i < times.length; i++) gaps.push((times[i] - times[i - 1]) / DAY)

    const gastoTotal = vs.reduce((s, v) => s + Number(v.paid_amount ?? 0), 0)
    // El alta del hogar es la del adulto que llegó primero
    const alta = +new Date(orden[0].created_at)
    const mesesAntiguedad = Math.max(1, Math.round((now.getTime() - alta) / (30 * DAY)))

    const familyName = adultos.find(m => m.families?.name)?.families?.name ?? null
    const agrupado = adultos.length > 1 || !!titular.family_id

    return {
      memberId: titular.id,
      hogarId,
      // Con dos adultos, el nombre de la casa; con uno, el suyo — «Familia
      // Puig» para un alta suelta sonaría a que hay más gente de la que hay.
      name: agrupado && familyName ? familyName : titular.name,
      phone: titular.phone,
      familyName,
      miembros: orden.map(m => ({ id: m.id, name: m.name })),
      titularNombre: titular.name,
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
/**
 * Las familias que más han venido en los últimos N días.
 *
 * Es un ranking, no un segmento: «campeones» dice quién se comporta como
 * cliente fiel, esto dice quién ha pisado más la ludoteca este mes. Sirve para
 * reconocerlas por su nombre en el mostrador.
 */
export function topVisitantes(
  stats: MemberStat[],
  visits: VisitInput[],
  now = new Date(),
  dias = 30,
  max = 5,
): { memberId: string; name: string; visitas: number }[] {
  const desde = now.getTime() - dias * DAY
  // Cada adulto apunta a su hogar: si los dos padres traen al niño, las visitas
  // suman en la misma fila en vez de partirse en dos.
  const hogarDe = new Map<string, MemberStat>()
  for (const s of stats) for (const m of s.miembros) hogarDe.set(m.id, s)

  const cuenta = new Map<string, number>()
  for (const v of visits) {
    if (!v.member_id || !v.checked_in_at) continue
    if (new Date(v.checked_in_at).getTime() < desde) continue
    const hogar = hogarDe.get(v.member_id)
    if (!hogar) continue
    cuenta.set(hogar.hogarId, (cuenta.get(hogar.hogarId) ?? 0) + 1)
  }

  const porHogar = new Map(stats.map(s => [s.hogarId, s]))
  return [...cuenta.entries()]
    .map(([hogarId, visitas]) => {
      const s = porHogar.get(hogarId)!
      return { memberId: s.memberId, name: s.name, visitas }
    })
    .sort((a, b) => b.visitas - a.visitas || a.name.localeCompare(b.name))
    .slice(0, max)
}

export function avgLtv(stats: MemberStat[]): number {
  const activos = stats.filter(s => s.visitas > 0)
  if (activos.length === 0) return 0
  return activos.reduce((s, x) => s + x.ltv, 0) / activos.length
}
