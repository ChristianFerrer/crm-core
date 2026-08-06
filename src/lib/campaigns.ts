/**
 * Campañas (Fase 3).
 *
 * Cierra el círculo del CRM: del dato a la acción. Aquí viven las plantillas,
 * la resolución de destinatarios y el armado del mensaje; la pantalla solo
 * pinta y guarda.
 *
 * Decisión de canal: se abre WhatsApp con el mensaje ya escrito (`wa.me`).
 * Es manual y de uno en uno, pero es gratis, inmediato y no depende de que
 * Meta apruebe plantillas. Para 50-75 clientes es suficiente; el envío masivo
 * automatizado exigiría WhatsApp Business API, con coste por conversación.
 */

import type { MemberStat, SegmentId } from './segments'

export type PlantillaId =
  | 'cumpleanos'
  | 'bono_bajo'
  | 'renovacion_caducada'
  | 'upsell_bono'
  | 'reactivacion'
  | 'valle'
  | 'segunda_visita'
  | 'manual'

export type CampaignTemplate = {
  id: PlantillaId
  nombre: string
  descripcion: string
  /** Plazo del que habla la campaña, para que se vea la urgencia real */
  horizonte: string
  /** Por qué esta campaña existe: qué mueve */
  porque: string
  mensaje: string
  incentivo: string
  accent: 'lime' | 'iris' | 'cyan-300' | 'amber' | 'rose' | 'mint' | 'grape'
  /**
   * Días que deben pasar para volver a proponer a la MISMA familia por el
   * mismo motivo. Sin esto, quien fue contactado una vez desaparecía para
   * siempre de las sugerencias y el bloque se vaciaba solo.
   */
  reintentoDias: number
}

/**
 * Las cinco de fábrica. Son las que mueven la aguja en una ludoteca, por ese
 * orden de retorno esperado.
 */
export const TEMPLATES: CampaignTemplate[] = [
  {
    id: 'cumpleanos',
    nombre: 'Cumpleaños',
    descripcion: 'Familias con un cumpleaños en los próximos 45 días',
    horizonte: 'Próximos 45 días',
    porque: 'Ticket alto y decisión anticipada: es la campaña de mayor retorno',
    mensaje: '¡Hola {nombre}! 🎂 Se acerca el cumple de {niño} y nos encantaría celebrarlo con vosotros. Tenemos fechas libres — ¿te reservo una?',
    incentivo: 'Tarta de regalo reservando con 3 semanas de antelación',
    accent: 'grape',
    reintentoDias: 300,
  },
  {
    id: 'bono_bajo',
    nombre: 'Bono a punto de agotarse',
    descripcion: 'Bonos con 2 sesiones o menos, o que caducan esta semana',
    horizonte: 'Esta semana',
    porque: 'Renovar antes de agotarlo evita el hueco en el que se pierde al cliente',
    mensaje: '¡Hola {nombre}! Te quedan {sesiones} sesiones del bono. Si lo renuevas antes de que se acabe, te mantenemos el precio actual. ¿Te lo preparo?',
    incentivo: 'Mismo precio al renovar antes de agotarlo',
    accent: 'amber',
    reintentoDias: 30,
  },
  {
    id: 'renovacion_caducada',
    nombre: 'Renovar bono',
    descripcion: 'Bonos agotados o caducados hace menos de 30 días, sin renovar',
    horizonte: 'Este mes',
    porque: 'Quien se queda sin bono deja de venir a las pocas semanas: el hueco es donde se pierde al cliente',
    mensaje: '¡Hola {nombre}! Se os ha terminado el bono. ¿Os preparo uno nuevo para que no perdáis el ritmo?',
    incentivo: 'Renovación sin cambio de precio',
    accent: 'rose',
    reintentoDias: 45,
  },
  {
    id: 'upsell_bono',
    nombre: 'Pasar a bono',
    descripcion: 'Familias que vienen a menudo y pagan cada entrada suelta',
    horizonte: 'Este mes',
    porque: 'Ya vienen lo suficiente para que el bono les salga a cuenta: asegura ingresos por adelantado',
    mensaje: '¡Hola {nombre}! Como venís a menudo, con un bono os saldría cada visita bastante más barato. ¿Os cuento cómo funciona?',
    incentivo: 'Primera sesión de regalo al contratar el bono',
    accent: 'lime',
    reintentoDias: 60,
  },
  {
    id: 'reactivacion',
    nombre: 'Reactivación',
    descripcion: 'Familias que llevan sin venir más del doble de su ritmo',
    horizonte: 'Cuanto antes',
    porque: 'Actuar en la primera señal de fuga cuesta mucho menos que recuperarlas después',
    mensaje: '¡Hola {nombre}! Hace {dias} días que no os vemos y os echamos de menos. Esta semana tenemos hueco por las tardes — ¿os venís?',
    incentivo: 'Segunda entrada a mitad de precio',
    accent: 'cyan-300',
    reintentoDias: 60,
  },
  {
    id: 'valle',
    nombre: 'Llenar el valle',
    descripcion: 'Familias activas, para una franja con poca ocupación',
    horizonte: 'Esta semana',
    porque: 'La sala vacía cuesta lo mismo que la llena: cualquier ingreso ahí es margen',
    mensaje: '¡Hola {nombre}! Esta semana tenemos las tardes de martes más tranquilas y hemos preparado una oferta para esas horas. ¿Os apetece?',
    incentivo: 'Descuento en la franja de menos ocupación',
    accent: 'iris',
    reintentoDias: 21,
  },
  {
    id: 'segunda_visita',
    nombre: 'Segunda visita',
    descripcion: 'Familias con una sola visita, hace más de 21 días',
    horizonte: 'Este mes',
    porque: 'Ya te conocen: convertir la primera visita en la segunda es lo más barato que puedes hacer',
    mensaje: '¡Hola {nombre}! Nos alegró mucho teneros por aquí. Si os apetece repetir, os invitamos a un batido en la próxima visita 🥤',
    incentivo: 'Consumición de regalo en la segunda visita',
    accent: 'mint',
    reintentoDias: 45,
  },
]

export function templateById(id: string): CampaignTemplate | undefined {
  return TEMPLATES.find(t => t.id === id)
}

/**
 * Campañas que son publicidad y por tanto exigen consentimiento de marketing.
 *
 * La línea está en de qué habla el mensaje: escribir por SU bono o SU reserva
 * es gestión del servicio contratado; ofrecer un producto o un descuento es
 * publicidad. Renovar un bono agotado es lo primero; proponer contratar uno
 * nuevo a quien nunca lo tuvo es lo segundo.
 */
const PUBLICIDAD: PlantillaId[] = ['valle', 'segunda_visita', 'upsell_bono']

export function requiereConsentimiento(id: PlantillaId): boolean {
  return PUBLICIDAD.includes(id)
}

export type BirthdayLead = { member_id: string; member_name: string; child_name: string; birthday_day: number }
export type BonoLead = { member_id: string; member_name: string; sessions: number | null; expires_at: string | null }

/** Bono que ya no sirve: agotado (0 sesiones) o con la fecha pasada. */
export type CaducadoLead = {
  member_id: string
  member_name: string
  motivo: 'agotado' | 'caducado'
  /** Días desde que dejó de servir, para ordenar por frescura */
  dias: number
}

/** Familia que viene a menudo y paga cada entrada suelta. */
export type SinBonoLead = { member_id: string; member_name: string; visitas: number }

/** Fila mínima de `memberships` que necesitan los constructores. */
type MembershipRow = { member_id: string; sessions_remaining: number | null; expires_at: string | null }
type MemberRow = { id: string; name: string }
type VisitRow = { member_id: string; checked_in_at: string }

const DIA = 86_400_000

/** ¿Este bono sigue sirviendo hoy? Ni agotado ni con la fecha pasada. */
function bonoVigente(m: MembershipRow, hoy: string): boolean {
  const quedanSesiones = m.sessions_remaining == null || m.sessions_remaining > 0
  const enFecha = !m.expires_at || m.expires_at >= hoy
  return quedanSesiones && enFecha
}

/**
 * Familias sin ningún bono vigente cuyo último bono murió hace poco.
 *
 * Cuenta tanto el que caducó por fecha como el que se quedó a cero sesiones.
 * Mirar solo `expires_at`, como hacía el panel viejo, dejaba fuera los bonos
 * agotados con fecha futura, que son justo los más fáciles de renovar.
 */
export function buildCaducados(
  memberships: MembershipRow[],
  members: MemberRow[],
  now = new Date(),
  ventanaDias = 30,
): CaducadoLead[] {
  const hoy = now.toISOString().split('T')[0]
  const nombrePorId = new Map(members.map(m => [m.id, m.name]))
  const conVigente = new Set(memberships.filter(m => bonoVigente(m, hoy)).map(m => m.member_id))

  const mejorPorMiembro = new Map<string, CaducadoLead>()
  for (const m of memberships) {
    if (conVigente.has(m.member_id)) continue
    if (bonoVigente(m, hoy)) continue
    const nombre = nombrePorId.get(m.member_id)
    if (!nombre) continue

    // El agotado no tiene fecha de muerte: se cuenta como reciente, porque lo
    // que importa es que hoy no puede entrar.
    const agotado = m.sessions_remaining != null && m.sessions_remaining <= 0
    const dias = agotado || !m.expires_at
      ? 0
      : Math.floor((now.getTime() - new Date(m.expires_at + 'T00:00:00').getTime()) / DIA)
    if (dias < 0 || dias > ventanaDias) continue

    const lead: CaducadoLead = {
      member_id: m.member_id,
      member_name: nombre,
      motivo: agotado ? 'agotado' : 'caducado',
      dias,
    }
    // Si tiene varios bonos muertos, vale el más reciente
    const prev = mejorPorMiembro.get(m.member_id)
    if (!prev || lead.dias < prev.dias) mejorPorMiembro.set(m.member_id, lead)
  }
  return [...mejorPorMiembro.values()].sort((a, b) => a.dias - b.dias)
}

/**
 * Familias que vienen a menudo pero pagan suelto: candidatas a bono.
 *
 * El mínimo de visitas importa. El panel viejo listaba a cualquiera que hubiera
 * pasado una vez en el mes, y con una sola visita no hay hábito que convertir.
 */
export function buildSinBono(
  memberships: MembershipRow[],
  visits: VisitRow[],
  members: MemberRow[],
  now = new Date(),
  ventanaDias = 60,
  minVisitas = 2,
): SinBonoLead[] {
  const hoy = now.toISOString().split('T')[0]
  const desde = now.getTime() - ventanaDias * DIA
  const conVigente = new Set(memberships.filter(m => bonoVigente(m, hoy)).map(m => m.member_id))
  const nombrePorId = new Map(members.map(m => [m.id, m.name]))

  const cuenta = new Map<string, number>()
  for (const v of visits) {
    if (!v.checked_in_at || new Date(v.checked_in_at).getTime() < desde) continue
    if (conVigente.has(v.member_id)) continue
    if (!nombrePorId.has(v.member_id)) continue
    cuenta.set(v.member_id, (cuenta.get(v.member_id) ?? 0) + 1)
  }

  return [...cuenta.entries()]
    .filter(([, n]) => n >= minVisitas)
    .map(([id, n]) => ({ member_id: id, member_name: nombrePorId.get(id)!, visitas: n }))
    .sort((a, b) => b.visitas - a.visitas)
}

export type Recipient = {
  memberId: string
  name: string
  phone: string | null
  /** Variables para la plantilla */
  vars: Record<string, string>
  /** Euros que hay en juego con esta familia, para priorizar */
  valor: number
}

/** Primer nombre: en un mensaje corto el nombre completo suena a circular. */
export function firstName(full: string): string {
  return full.trim().split(/\s+/)[0] ?? full
}

/**
 * Destinatarios de cada plantilla, a partir de lo que ya sabe el panel.
 * El ticket medio del establecimiento sirve para estimar el valor en juego.
 */
export function resolveRecipients(
  plantilla: PlantillaId,
  ctx: {
    stats: MemberStat[]
    birthdays: BirthdayLead[]
    bonos: BonoLead[]
    caducados: CaducadoLead[]
    sinBono: SinBonoLead[]
    ticketMedio: number
    precioCumple: number
    /** Precio medio real de los bonos: mejor estimación que inventar múltiplos */
    precioBono: number
  },
): Recipient[] {
  const statById = new Map(ctx.stats.map(s => [s.memberId, s]))

  switch (plantilla) {
    case 'cumpleanos':
      return ctx.birthdays.map(b => ({
        memberId: b.member_id,
        name: b.member_name,
        phone: statById.get(b.member_id)?.phone ?? null,
        vars: { nombre: firstName(b.member_name), niño: b.child_name, dia: String(b.birthday_day) },
        valor: ctx.precioCumple,
      }))

    case 'bono_bajo':
      return ctx.bonos.map(b => ({
        memberId: b.member_id,
        name: b.member_name,
        phone: statById.get(b.member_id)?.phone ?? null,
        vars: {
          nombre: firstName(b.member_name),
          sesiones: b.sessions != null ? String(b.sessions) : 'pocas',
          caduca: b.expires_at ?? '',
        },
        valor: ctx.ticketMedio * 8,
      }))

    case 'renovacion_caducada':
      return ctx.caducados.map(c => ({
        memberId: c.member_id,
        name: c.member_name,
        phone: statById.get(c.member_id)?.phone ?? null,
        vars: {
          nombre: firstName(c.member_name),
          motivo: c.motivo === 'agotado' ? 'se agotó' : 'caducó',
          dias: String(c.dias),
        },
        valor: ctx.precioBono,
      }))

    case 'upsell_bono':
      return ctx.sinBono.map(s => ({
        memberId: s.member_id,
        name: s.member_name,
        phone: statById.get(s.member_id)?.phone ?? null,
        vars: { nombre: firstName(s.member_name), visitas: String(s.visitas) },
        valor: ctx.precioBono,
      }))

    case 'reactivacion':
      return bySegment(ctx.stats, 'en_riesgo').map(s => toRecipient(s, ctx.ticketMedio))

    case 'segunda_visita':
      return bySegment(ctx.stats, 'nuevos_sin_repetir').map(s => toRecipient(s, ctx.ticketMedio))

    case 'valle':
      return [...bySegment(ctx.stats, 'fieles'), ...bySegment(ctx.stats, 'campeones')]
        .map(s => toRecipient(s, ctx.ticketMedio))

    default:
      return []
  }
}

function bySegment(stats: MemberStat[], seg: SegmentId): MemberStat[] {
  return stats.filter(s => s.segmento === seg)
}

function toRecipient(s: MemberStat, ticketMedio: number): Recipient {
  return {
    memberId: s.memberId,
    name: s.name,
    phone: s.phone,
    vars: {
      nombre: firstName(s.name),
      dias: s.diasDesdeUltima != null ? String(Math.round(s.diasDesdeUltima)) : '',
      visitas: String(s.visitas),
    },
    valor: s.ticketMedio > 0 ? s.ticketMedio : ticketMedio,
  }
}

/**
 * Sustituye {variables} de la plantilla; lo que no exista se deja vacío.
 *
 * El patrón usa \p{L} y no \w porque \w es ASCII: con `{niño}` la variable no
 * se reconocía y el mensaje salía con la llave literal.
 */
export function renderMessage(mensaje: string, vars: Record<string, string>): string {
  return mensaje.replace(/\{([\p{L}\p{N}_]+)\}/gu, (_, key: string) => vars[key] ?? '')
}

/** Enlace de WhatsApp con el mensaje ya escrito. Null si el móvil no sirve. */
export function waLink(phone: string | null, text: string): string | null {
  if (!phone) return null
  const clean = phone.replace(/[^0-9]/g, '')
  if (clean.length < 9) return null
  const intl = clean.length === 9 ? `34${clean}` : clean
  return `https://wa.me/${intl}?text=${encodeURIComponent(text)}`
}

export type ActionSuggestion = {
  plantilla: PlantillaId
  titulo: string
  detalle: string
  horizonte: string
  destinatarios: number
  valor: number
  accent: CampaignTemplate['accent']
}

/** Fecha del último contacto por plantilla y familia: `plantilla:memberId`. */
export type ContactLog = Record<string, string>

/**
 * ¿Se puede volver a proponer a esta familia por este motivo?
 *
 * Cada plantilla tiene su ventana: un cumpleaños es anual, un bono a punto de
 * agotarse se puede repetir al mes. Sin esta comprobación, contactar una vez
 * excluía a la familia para siempre.
 */
export function puedeReproponer(
  tpl: CampaignTemplate,
  memberId: string,
  log: ContactLog,
  now: Date,
): boolean {
  const last = log[`${tpl.id}:${memberId}`]
  if (!last) return true
  const dias = (now.getTime() - new Date(last).getTime()) / 86_400_000
  return dias >= tpl.reintentoDias
}

/**
 * Las acciones de la semana, ordenadas por EUROS EN JUEGO y no por urgencia:
 * si hay cuarenta cosas que hacer no se hace ninguna.
 *
 * La revisión es semanal a propósito: diaria se queda vacía casi siempre y
 * mensual llega tarde para los bonos que caducan y para quien está fugándose.
 *
 * Se muestran TODAS las plantillas con gente pendiente, no un top 3. Solo hay
 * cinco, así que el bloque sigue siendo corto, y recortar escondía justo la
 * campaña de más margen: un cumpleaños suma pocos euros totales porque son dos
 * familias, pero convierte muchísimo mejor que veinte contactos de relleno.
 */
export function suggestedActions(
  ctx: Parameters<typeof resolveRecipients>[1],
  contactLog: ContactLog,
  now = new Date(),
  max = TEMPLATES.length,
): ActionSuggestion[] {
  const out: ActionSuggestion[] = []

  for (const tpl of TEMPLATES) {
    const pendientes = resolveRecipients(tpl.id, ctx)
      .filter(r => puedeReproponer(tpl, r.memberId, contactLog, now))
    if (pendientes.length === 0) continue

    out.push({
      plantilla: tpl.id,
      titulo: tituloAccion(tpl.id, pendientes.length),
      detalle: tpl.descripcion,
      horizonte: tpl.horizonte,
      destinatarios: pendientes.length,
      valor: pendientes.reduce((s, r) => s + r.valor, 0),
      accent: tpl.accent,
    })
  }

  return out.sort((a, b) => b.valor - a.valor).slice(0, max)
}

/** Lunes de la semana en curso: ancla de la revisión semanal. */
export function inicioSemana(now = new Date()): Date {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const dow = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - dow)
  return d
}

/** Próximo lunes, para decir cuándo toca la siguiente revisión. */
export function proximaRevision(now = new Date()): Date {
  const d = inicioSemana(now)
  d.setDate(d.getDate() + 7)
  return d
}

function tituloAccion(id: PlantillaId, n: number): string {
  const plural = n !== 1
  switch (id) {
    case 'cumpleanos':     return `${n} cumpleaños en los próximos 45 días`
    case 'bono_bajo':      return `${n} bono${plural ? 's' : ''} a punto de agotarse`
    case 'renovacion_caducada': return `${n} bono${plural ? 's' : ''} sin renovar`
    case 'upsell_bono':    return `${n} familia${plural ? 's' : ''} ${plural ? 'vienen' : 'viene'} sin bono`
    case 'reactivacion':   return `${n} familia${plural ? 's' : ''} rompió su ritmo`
    case 'segunda_visita': return `${n} familia${plural ? 's' : ''} sin repetir visita`
    case 'valle':          return `${n} familia${plural ? 's' : ''} para llenar el valle`
    default:               return `${n} contacto${plural ? 's' : ''}`
  }
}
