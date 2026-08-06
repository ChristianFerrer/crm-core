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
  | 'reactivacion'
  | 'valle'
  | 'segunda_visita'
  | 'manual'

export type CampaignTemplate = {
  id: PlantillaId
  nombre: string
  descripcion: string
  /** Por qué esta campaña existe: qué mueve */
  porque: string
  mensaje: string
  incentivo: string
  accent: 'lime' | 'iris' | 'cyan-300' | 'amber' | 'rose' | 'mint' | 'grape'
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
    porque: 'Ticket alto y decisión anticipada: es la campaña de mayor retorno',
    mensaje: '¡Hola {nombre}! 🎂 Se acerca el cumple de {niño} y nos encantaría celebrarlo con vosotros. Tenemos fechas libres — ¿te reservo una?',
    incentivo: 'Tarta de regalo reservando con 3 semanas de antelación',
    accent: 'grape',
  },
  {
    id: 'bono_bajo',
    nombre: 'Bono a punto de agotarse',
    descripcion: 'Bonos con 2 sesiones o menos, o que caducan esta semana',
    porque: 'Renovar antes de agotarlo evita el hueco en el que se pierde al cliente',
    mensaje: '¡Hola {nombre}! Te quedan {sesiones} sesiones del bono. Si lo renuevas antes de que se acabe, te mantenemos el precio actual. ¿Te lo preparo?',
    incentivo: 'Mismo precio al renovar antes de agotarlo',
    accent: 'amber',
  },
  {
    id: 'reactivacion',
    nombre: 'Reactivación',
    descripcion: 'Familias que llevan sin venir más del doble de su ritmo',
    porque: 'Actuar en la primera señal de fuga cuesta mucho menos que recuperarlas después',
    mensaje: '¡Hola {nombre}! Hace {dias} días que no os vemos y os echamos de menos. Esta semana tenemos hueco por las tardes — ¿os venís?',
    incentivo: 'Segunda entrada a mitad de precio',
    accent: 'cyan-300',
  },
  {
    id: 'valle',
    nombre: 'Llenar el valle',
    descripcion: 'Familias activas, para una franja con poca ocupación',
    porque: 'La sala vacía cuesta lo mismo que la llena: cualquier ingreso ahí es margen',
    mensaje: '¡Hola {nombre}! Esta semana tenemos las tardes de martes más tranquilas y hemos preparado una oferta para esas horas. ¿Os apetece?',
    incentivo: 'Descuento en la franja de menos ocupación',
    accent: 'iris',
  },
  {
    id: 'segunda_visita',
    nombre: 'Segunda visita',
    descripcion: 'Familias con una sola visita, hace más de 21 días',
    porque: 'Ya te conocen: convertir la primera visita en la segunda es lo más barato que puedes hacer',
    mensaje: '¡Hola {nombre}! Nos alegró mucho teneros por aquí. Si os apetece repetir, os invitamos a un batido en la próxima visita 🥤',
    incentivo: 'Consumición de regalo en la segunda visita',
    accent: 'mint',
  },
]

export function templateById(id: string): CampaignTemplate | undefined {
  return TEMPLATES.find(t => t.id === id)
}

export type BirthdayLead = { member_id: string; member_name: string; child_name: string; birthday_day: number }
export type BonoLead = { member_id: string; member_name: string; sessions: number | null; expires_at: string | null }

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
    ticketMedio: number
    precioCumple: number
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
  destinatarios: number
  valor: number
  accent: CampaignTemplate['accent']
}

/**
 * Las tres acciones del día, ordenadas por EUROS EN JUEGO y no por urgencia:
 * si hay cuarenta cosas que hacer no se hace ninguna.
 */
export function suggestedActions(
  ctx: Parameters<typeof resolveRecipients>[1],
  yaContactados: Set<string>,
  max = 3,
): ActionSuggestion[] {
  const out: ActionSuggestion[] = []

  for (const tpl of TEMPLATES) {
    const pendientes = resolveRecipients(tpl.id, ctx)
      .filter(r => !yaContactados.has(`${tpl.id}:${r.memberId}`))
    if (pendientes.length === 0) continue

    out.push({
      plantilla: tpl.id,
      titulo: tituloAccion(tpl.id, pendientes.length),
      detalle: tpl.descripcion,
      destinatarios: pendientes.length,
      valor: pendientes.reduce((s, r) => s + r.valor, 0),
      accent: tpl.accent,
    })
  }

  return out.sort((a, b) => b.valor - a.valor).slice(0, max)
}

function tituloAccion(id: PlantillaId, n: number): string {
  const plural = n !== 1
  switch (id) {
    case 'cumpleanos':     return `${n} cumpleaños en los próximos 45 días`
    case 'bono_bajo':      return `${n} bono${plural ? 's' : ''} a punto de agotarse`
    case 'reactivacion':   return `${n} familia${plural ? 's' : ''} rompió su ritmo`
    case 'segunda_visita': return `${n} familia${plural ? 's' : ''} sin repetir visita`
    case 'valle':          return `${n} familia${plural ? 's' : ''} para llenar el valle`
    default:               return `${n} contacto${plural ? 's' : ''}`
  }
}
